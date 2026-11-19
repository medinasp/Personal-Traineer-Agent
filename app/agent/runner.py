"""Orquestrador do agente Coach: loop de tool-calling com a Groq + persistencia."""
from __future__ import annotations

import json
from typing import Any

from groq import Groq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.tools import TOOLS, call_tool
from app.config import settings
from app.models import ChatConversation, ChatMessage

SYSTEM_PROMPT = (
    "Voce e o Coach, um assistente de treino de musculacao dentro de um app pessoal. "
    "Responda SEMPRE em portugues do Brasil, de forma clara, pratica e baseada em evidencia. "
    "Voce PODE agir no app usando as ferramentas: criar treinos e exercicios, adicionar exercicios "
    "a treinos e registrar o diario de treino. Quando o usuario pedir uma acao, execute-a com a "
    "ferramenta e depois confirme em uma frase o que foi feito. "
    "Se faltar informacao essencial (ex.: em qual treino registrar), pergunte antes de agir. "
    "Para diagnosticos e analises de progressao, use consultar_perfil (dados corporais e metas) e "
    "consultar_historico (evolucao de carga nos exercicios), cruzando os dois ao longo do tempo. "
    "Para perguntas de treino/dieta, use a ferramenta buscar_evidencia ANTES de responder e CITE as "
    "fontes retornadas (titulo e ano). Se a base nao tiver nada relevante, responda com conhecimento "
    "geral e deixe claro que e recomendacao geral. Nao invente numeros nem estudos. "
    "Saude/dieta e informativo e nao substitui um profissional. Seja conciso."
)

MAX_TOOL_LOOPS = 12  # pedidos multi-passo (ex.: criar varios exercicios + treino) precisam de folga
MAX_HISTORY = 20  # ultimas N mensagens user/assistant como contexto


def _get_or_create_conversation(db: Session) -> ChatConversation:
    conv = db.execute(select(ChatConversation).order_by(ChatConversation.id).limit(1)).scalar_one_or_none()
    if conv is None:
        conv = ChatConversation(title="Coach")
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def _add_message(db: Session, conv_id: int, role: str, content: str | None) -> ChatMessage:
    m = ChatMessage(conversation_id=conv_id, role=role, content=content)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def _tool_calls_to_dict(tool_calls: Any) -> list[dict[str, Any]]:
    out = []
    for tc in tool_calls:
        out.append(
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
            }
        )
    return out


def run_chat(db: Session, user_text: str) -> dict[str, Any]:
    if not settings.groq_api_key.strip():
        return {"reply": "O agente nao esta configurado (falta GROQ_API_KEY).", "actions": [], "conversation_id": None}

    conv = _get_or_create_conversation(db)

    # contexto: ultimas mensagens user/assistant
    prior = [m for m in conv.messages if m.role in ("user", "assistant") and m.content]
    prior = prior[-MAX_HISTORY:]
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in prior]
    messages.append({"role": "user", "content": user_text})

    _add_message(db, conv.id, "user", user_text)

    client = Groq(api_key=settings.groq_api_key)
    actions: list[str] = []
    reply = ""

    for _ in range(MAX_TOOL_LOOPS):
        resp = client.chat.completions.create(
            model=settings.groq_model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.4,
            max_tokens=1024,
        )
        choice = resp.choices[0].message
        if choice.tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": choice.content or "",
                    "tool_calls": _tool_calls_to_dict(choice.tool_calls),
                }
            )
            for tc in choice.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                content, action = call_tool(db, tc.function.name, args)
                if action:
                    actions.append(action)
                messages.append(
                    {"role": "tool", "tool_call_id": tc.id, "name": tc.function.name, "content": content}
                )
            continue
        reply = choice.content or ""
        break
    else:
        reply = "Me enrolei processando isso. Pode reformular?"

    _add_message(db, conv.id, "assistant", reply)
    return {"reply": reply, "actions": actions, "conversation_id": conv.id}


def get_history(db: Session) -> list[dict[str, Any]]:
    conv = db.execute(select(ChatConversation).order_by(ChatConversation.id).limit(1)).scalar_one_or_none()
    if conv is None:
        return []
    return [
        {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in conv.messages
        if m.role in ("user", "assistant") and m.content
    ]


def clear_history(db: Session) -> None:
    conv = db.execute(select(ChatConversation).order_by(ChatConversation.id).limit(1)).scalar_one_or_none()
    if conv is not None:
        db.delete(conv)
        db.commit()
