"""Ferramentas do agente Coach: mapeiam linguagem natural -> services do app."""
from __future__ import annotations

import json
import secrets
import unicodedata
from datetime import date, datetime, time
from typing import Any

from sqlalchemy.orm import Session

from app.models import Exercise, Workout, WorkoutSession
from app.schemas.exercise import ExerciseCreate
from app.schemas.session import SessionCreate, SetLogIn
from app.schemas.workout import WorkoutCreate, WorkoutExerciseIn
from app.services import exercise as exercise_svc
from app.services import session as session_svc
from app.services import workout as workout_svc


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


def _find_exercise(db: Session, name: str) -> Exercise | None:
    alvo = _norm(name)
    exs = exercise_svc.list_all(db, include_archived=False)
    # exato, depois "contém"
    for e in exs:
        if _norm(e.name) == alvo:
            return e
    for e in exs:
        if alvo in _norm(e.name) or _norm(e.name) in alvo:
            return e
    return None


def _find_or_create_exercise(db: Session, name: str) -> Exercise:
    found = _find_exercise(db, name)
    if found:
        return found
    return exercise_svc.create(db, ExerciseCreate(name=name.strip()))


def _find_workout(db: Session, name: str) -> Workout | None:
    alvo = _norm(name)
    ws = workout_svc.list_all(db, include_archived=True)
    for w in ws:
        if _norm(w.name) == alvo:
            return w
    for w in ws:
        if alvo in _norm(w.name) or _norm(w.name) in alvo:
            return w
    return None


def _today_session(db: Session, workout_id: int) -> WorkoutSession | None:
    today = date.today()
    for s in session_svc.list_all(db, workout_id):
        if s.performed_at.date() == today:
            return s
    return None


# ---------------- implementacoes ----------------

def _listar_treinos(db: Session, **_: Any) -> dict[str, Any]:
    ws = workout_svc.list_all(db, include_archived=True)
    data = [
        {"id": w.id, "nome": w.name, "ativo": not w.archived, "exercicios": len(w.exercises)}
        for w in ws
    ]
    return {"content": {"treinos": data}, "action": None}


def _listar_exercicios(db: Session, **_: Any) -> dict[str, Any]:
    exs = exercise_svc.list_all(db, include_archived=False)
    return {"content": {"exercicios": [{"id": e.id, "nome": e.name, "grupo": e.muscle_group} for e in exs]}, "action": None}


def _criar_exercicio(db: Session, nome: str, grupo_muscular: str | None = None, **_: Any) -> dict[str, Any]:
    if _find_exercise(db, nome):
        return {"content": {"ok": False, "motivo": f"Exercicio '{nome}' ja existe"}, "action": None}
    e = exercise_svc.create(db, ExerciseCreate(name=nome.strip(), muscle_group=grupo_muscular))
    return {"content": {"ok": True, "id": e.id, "nome": e.name}, "action": f"Exercício criado: {e.name}"}


def _criar_treino(db: Session, nome: str, exercicios: list[str] | None = None, **_: Any) -> dict[str, Any]:
    exercicios = exercicios or []
    links: list[WorkoutExerciseIn] = []
    nomes: list[str] = []
    for ex_name in exercicios:
        e = _find_or_create_exercise(db, ex_name)
        links.append(WorkoutExerciseIn(exercise_id=e.id))
        nomes.append(e.name)
    w = workout_svc.create(db, WorkoutCreate(name=nome.strip(), exercises=links))
    return {
        "content": {"ok": True, "id": w.id, "nome": w.name, "exercicios": nomes},
        "action": f"Treino criado: {w.name}" + (f" ({len(nomes)} exercícios)" if nomes else ""),
    }


def _adicionar_exercicio_ao_treino(
    db: Session, treino: str, exercicio: str, series: int | None = None, **_: Any
) -> dict[str, Any]:
    w = _find_workout(db, treino)
    if not w:
        return {"content": {"ok": False, "motivo": f"Treino '{treino}' nao encontrado"}, "action": None}
    e = _find_or_create_exercise(db, exercicio)
    detail = workout_svc.get_detail(db, w.id)
    items = [
        WorkoutExerciseIn(exercise_id=we.exercise_id, target_sets=we.target_sets)
        for we in detail.exercises
    ]
    if any(it.exercise_id == e.id for it in items):
        return {"content": {"ok": False, "motivo": f"{e.name} ja esta no treino"}, "action": None}
    items.append(WorkoutExerciseIn(exercise_id=e.id, target_sets=series or 6))
    workout_svc.set_exercises(db, w.id, items)
    return {"content": {"ok": True, "treino": w.name, "exercicio": e.name}, "action": f"{e.name} adicionado ao {w.name}"}


def _registrar_diario(
    db: Session, itens: list[dict[str, Any]], treino: str | None = None, data: str | None = None, **_: Any
) -> dict[str, Any]:
    # resolve o treino
    w: Workout | None = _find_workout(db, treino) if treino else None
    if w is None:
        ativos = [x for x in workout_svc.list_all(db) if not x.archived]
        if len(ativos) == 1:
            w = ativos[0]
        else:
            return {
                "content": {
                    "ok": False,
                    "motivo": "Preciso saber em qual treino registrar.",
                    "treinos_ativos": [x.name for x in ativos],
                },
                "action": None,
            }
    # sessao do dia (reusa ou cria, idempotente)
    sess = _today_session(db, w.id)
    performed_at = None
    if data:
        try:
            performed_at = datetime.combine(date.fromisoformat(data), time(12, 0))
        except ValueError:
            performed_at = None
    if sess is None:
        sess = session_svc.create(
            db,
            SessionCreate(
                workout_id=w.id,
                client_token="agent_" + secrets.token_hex(8),
                performed_at=performed_at,
            ),
        )
    registrados: list[str] = []
    for item in itens:
        ex = _find_or_create_exercise(db, str(item.get("exercicio", "")).strip())
        series = item.get("series", []) or []
        sets = [
            SetLogIn(
                set_number=i + 1,
                reps=s.get("reps"),
                weight_kg=s.get("peso") if s.get("peso") is not None else s.get("weight_kg"),
            )
            for i, s in enumerate(series)
        ]
        session_svc.save_sets(db, sess.id, ex.id, sets)
        registrados.append(f"{ex.name} ({len(sets)} série(s))")
    return {
        "content": {"ok": True, "treino": w.name, "sessao_id": sess.id, "registrados": registrados},
        "action": f"Registrado no diário ({w.name}): " + ", ".join(registrados),
    }


def _consultar_perfil(db: Session, **_: Any) -> dict[str, Any]:
    from app.services import profile as profile_svc

    p = profile_svc.get_or_create_profile(db)
    meds = profile_svc.list_measurements(db, limit=20)
    return {
        "content": {
            "perfil": {
                "altura_cm": p.height_cm,
                "sexo": p.sex,
                "nascimento": p.birth_date.date().isoformat() if p.birth_date else None,
                "metas": p.goals,
                "objetivos": p.objectives,
                "observacoes": p.notes,
            },
            "medidas": [
                {
                    "data": m.measured_on.date().isoformat(),
                    "peso_kg": float(m.weight_kg) if m.weight_kg is not None else None,
                    "gordura_pct": float(m.body_fat_pct) if m.body_fat_pct is not None else None,
                    "massa_muscular_kg": float(m.muscle_mass_kg) if m.muscle_mass_kg is not None else None,
                    "gordura_visceral": float(m.visceral_fat) if m.visceral_fat is not None else None,
                    "agua_pct": float(m.body_water_pct) if m.body_water_pct is not None else None,
                    "tmb_kcal": m.bmr_kcal,
                }
                for m in meds
            ],
        },
        "action": None,
    }


def _buscar_evidencia(db: Session, query: str, **_: Any) -> dict[str, Any]:
    from app.agent import rag

    try:
        hits = rag.search(db, query, k=4)
    except Exception as e:  # noqa: BLE001
        return {"content": {"erro": f"RAG indisponivel: {e}"}, "action": None}
    return {"content": {"evidencias": hits}, "action": None}


def _consultar_historico(db: Session, exercicio: str, limite: int = 10, **_: Any) -> dict[str, Any]:
    e = _find_exercise(db, exercicio)
    if not e:
        return {"content": {"ok": False, "motivo": f"Exercicio '{exercicio}' nao encontrado"}, "action": None}
    rows = session_svc.get_exercise_history(db, e.id, limit=limite, offset=0, start=None, end=None)
    out = []
    for sess, sets in rows:
        out.append(
            {
                "data": sess.performed_at.date().isoformat(),
                "series": [
                    {"reps": s.reps, "peso": float(s.weight_kg) if s.weight_kg is not None else None}
                    for s in sets
                ],
            }
        )
    return {"content": {"exercicio": e.name, "historico": out}, "action": None}


# ---------------- registro / dispatch ----------------

_IMPL = {
    "listar_treinos": _listar_treinos,
    "listar_exercicios": _listar_exercicios,
    "criar_exercicio": _criar_exercicio,
    "criar_treino": _criar_treino,
    "adicionar_exercicio_ao_treino": _adicionar_exercicio_ao_treino,
    "registrar_diario": _registrar_diario,
    "consultar_historico": _consultar_historico,
    "consultar_perfil": _consultar_perfil,
    "buscar_evidencia": _buscar_evidencia,
}


def call_tool(db: Session, name: str, args: dict[str, Any]) -> tuple[str, str | None]:
    """Executa a ferramenta. Retorna (conteudo_json_para_o_LLM, rotulo_de_acao|None)."""
    fn = _IMPL.get(name)
    if fn is None:
        return json.dumps({"erro": f"ferramenta desconhecida: {name}"}), None
    try:
        res = fn(db, **args)
    except Exception as e:  # noqa: BLE001 — devolve o erro pro agente se virar
        return json.dumps({"erro": str(e)}), None
    content = res.get("content", {})
    return json.dumps(content, ensure_ascii=False, default=str), res.get("action")


# JSON Schema das ferramentas (formato OpenAI / Groq)
TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "listar_treinos",
            "description": "Lista os treinos do usuario (ativos e inativos).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_exercicios",
            "description": "Lista os exercicios do catalogo.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "criar_exercicio",
            "description": "Cria um exercicio no catalogo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": {"type": "string"},
                    "grupo_muscular": {"type": "string"},
                },
                "required": ["nome"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "criar_treino",
            "description": "Cria um treino. Pode ja incluir uma lista de exercicios (por nome); os que nao existirem sao criados.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": {"type": "string"},
                    "exercicios": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["nome"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "adicionar_exercicio_ao_treino",
            "description": "Adiciona um exercicio a um treino existente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "treino": {"type": "string"},
                    "exercicio": {"type": "string"},
                    "series": {"type": "integer", "description": "numero de series alvo (padrao 6)"},
                },
                "required": ["treino", "exercicio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_diario",
            "description": "Registra no diario os exercicios feitos hoje (reps e peso por serie). Reusa a sessao do dia se ja existir.",
            "parameters": {
                "type": "object",
                "properties": {
                    "treino": {"type": "string", "description": "nome do treino; se omitido e houver so 1 ativo, usa ele"},
                    "data": {"type": "string", "description": "data YYYY-MM-DD; padrao hoje"},
                    "itens": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "exercicio": {"type": "string"},
                                "series": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "reps": {"type": "integer"},
                                            "peso": {"type": "number"},
                                        },
                                    },
                                },
                            },
                            "required": ["exercicio", "series"],
                        },
                    },
                },
                "required": ["itens"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_perfil",
            "description": "Dados pessoais do usuario: altura, sexo, metas/objetivos e o historico de medidas corporais (peso, % gordura, massa muscular, etc.). Use para diagnosticos e analise de progressao corporal.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_evidencia",
            "description": "Busca na base de estudos cientificos (hipertrofia, emagrecimento, nutricao). Use ANTES de responder perguntas de treino/dieta e CITE as fontes retornadas (titulo/ano/url).",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "pergunta/tema a buscar"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_historico",
            "description": "Historico recente de um exercicio (datas, reps e peso).",
            "parameters": {
                "type": "object",
                "properties": {
                    "exercicio": {"type": "string"},
                    "limite": {"type": "integer"},
                },
                "required": ["exercicio"],
            },
        },
    },
]
