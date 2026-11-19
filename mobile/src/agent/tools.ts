/**
 * Ferramentas do Coach no celular: mapeiam linguagem natural -> repos do SQLite local.
 * Espelha as tools do backend (app/agent/tools.py), mas lendo/escrevendo no aparelho.
 */
import { exercisesRepo, sessionsRepo, workoutsRepo, profileRepo, measurementsRepo } from "../db/repos";
import type { Exercise, SetLogIn, Workout, WorkoutExerciseIn } from "../types";
import { searchEvidence } from "./evidence";
import type { ToolDef } from "./groq";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

async function findExercise(name: string): Promise<Exercise | null> {
  const alvo = norm(name);
  const exs = await exercisesRepo.list(false);
  for (const e of exs) if (norm(e.name) === alvo) return e;
  for (const e of exs) if (alvo.includes(norm(e.name)) || norm(e.name).includes(alvo)) return e;
  return null;
}

async function findOrCreateExercise(name: string): Promise<Exercise> {
  return (await findExercise(name)) ?? exercisesRepo.create({ name: name.trim() });
}

async function findWorkout(name: string): Promise<Workout | null> {
  const alvo = norm(name);
  const ws = await workoutsRepo.list(true);
  for (const w of ws) if (norm(w.name) === alvo) return w;
  for (const w of ws) if (alvo.includes(norm(w.name)) || norm(w.name).includes(alvo)) return w;
  return null;
}

type Result = { content: unknown; action: string | null };

interface DiarioItem {
  exercicio?: string;
  series?: { reps?: number; peso?: number; weight_kg?: number }[];
}

const IMPL: Record<string, (args: Record<string, unknown>) => Promise<Result>> = {
  async listar_treinos() {
    const ws = await workoutsRepo.list(true);
    const treinos = [];
    for (const w of ws) {
      const d = await workoutsRepo.detail(w.id);
      treinos.push({ id: w.id, nome: w.name, ativo: !w.archived, exercicios: d?.exercises.length ?? 0 });
    }
    return { content: { treinos }, action: null };
  },

  async listar_exercicios() {
    const exs = await exercisesRepo.list(false);
    return {
      content: { exercicios: exs.map((e) => ({ id: e.id, nome: e.name, grupo: e.muscle_group })) },
      action: null,
    };
  },

  async criar_exercicio(args) {
    const nome = String(args.nome ?? "").trim();
    const grupo = args.grupo_muscular != null ? String(args.grupo_muscular) : null;
    if (await findExercise(nome)) {
      return { content: { ok: false, motivo: `Exercicio '${nome}' ja existe` }, action: null };
    }
    const e = await exercisesRepo.create({ name: nome, muscle_group: grupo });
    return { content: { ok: true, id: e.id, nome: e.name }, action: `Exercício criado: ${e.name}` };
  },

  async criar_treino(args) {
    const nome = String(args.nome ?? "").trim();
    const exercicios = Array.isArray(args.exercicios) ? (args.exercicios as string[]) : [];
    const links: WorkoutExerciseIn[] = [];
    const nomes: string[] = [];
    for (const exName of exercicios) {
      const e = await findOrCreateExercise(String(exName));
      links.push({ exercise_id: e.id });
      nomes.push(e.name);
    }
    const w = await workoutsRepo.create({ name: nome, exercises: links });
    return {
      content: { ok: true, id: w.id, nome: w.name, exercicios: nomes },
      action: `Treino criado: ${w.name}` + (nomes.length ? ` (${nomes.length} exercícios)` : ""),
    };
  },

  async adicionar_exercicio_ao_treino(args) {
    const treino = String(args.treino ?? "");
    const exercicio = String(args.exercicio ?? "");
    const series = args.series != null ? Number(args.series) : null;
    const w = await findWorkout(treino);
    if (!w) return { content: { ok: false, motivo: `Treino '${treino}' nao encontrado` }, action: null };
    const e = await findOrCreateExercise(exercicio);
    const detail = await workoutsRepo.detail(w.id);
    const items: WorkoutExerciseIn[] = (detail?.exercises ?? []).map((we) => ({
      exercise_id: we.exercise_id,
      target_sets: we.target_sets,
    }));
    if (items.some((it) => it.exercise_id === e.id)) {
      return { content: { ok: false, motivo: `${e.name} ja esta no treino` }, action: null };
    }
    items.push({ exercise_id: e.id, target_sets: series ?? 6 });
    await workoutsRepo.update(w.id, w.name, items);
    return { content: { ok: true, treino: w.name, exercicio: e.name }, action: `${e.name} adicionado ao ${w.name}` };
  },

  async registrar_diario(args) {
    const itens = Array.isArray(args.itens) ? (args.itens as DiarioItem[]) : [];
    const treinoNome = args.treino != null ? String(args.treino) : null;
    let w = treinoNome ? await findWorkout(treinoNome) : null;
    if (!w) {
      const ativos = (await workoutsRepo.list(false)); // list(false) ja exclui arquivados
      if (ativos.length === 1) {
        w = ativos[0];
      } else {
        return {
          content: { ok: false, motivo: "Preciso saber em qual treino registrar.", treinos_ativos: ativos.map((x) => x.name) },
          action: null,
        };
      }
    }
    let sess = await sessionsRepo.todayForWorkout(w.id);
    if (!sess) sess = await sessionsRepo.create(w.id);
    const registrados: string[] = [];
    for (const item of itens) {
      const e = await findOrCreateExercise(String(item.exercicio ?? "").trim());
      const series = item.series ?? [];
      const sets: SetLogIn[] = series.map((s, i) => ({
        set_number: i + 1,
        reps: s.reps ?? null,
        weight_kg: s.peso != null ? s.peso : s.weight_kg ?? null,
      }));
      await sessionsRepo.saveSets(sess.id, e.id, sets);
      registrados.push(`${e.name} (${sets.length} série(s))`);
    }
    return {
      content: { ok: true, treino: w.name, sessao_id: sess.id, registrados },
      action: `Registrado no diário (${w.name}): ${registrados.join(", ")}`,
    };
  },

  async consultar_perfil() {
    const p = await profileRepo.get();
    const meds = await measurementsRepo.list();
    return {
      content: {
        perfil: {
          altura_cm: p.height_cm,
          sexo: p.sex,
          nascimento: p.birth_date,
          metas: p.goals,
          objetivos: p.objectives,
          observacoes: p.notes,
        },
        medidas: meds.slice(0, 20).map((m) => ({
          data: m.measured_on,
          peso_kg: m.weight_kg,
          gordura_pct: m.body_fat_pct,
          massa_muscular_kg: m.muscle_mass_kg,
          gordura_visceral: m.visceral_fat,
          agua_pct: m.body_water_pct,
          tmb_kcal: m.bmr_kcal,
        })),
      },
      action: null,
    };
  },

  async consultar_historico(args) {
    const exercicio = String(args.exercicio ?? "");
    const limite = args.limite != null ? Number(args.limite) : 10;
    const e = await findExercise(exercicio);
    if (!e) return { content: { ok: false, motivo: `Exercicio '${exercicio}' nao encontrado` }, action: null };
    const rows = await sessionsRepo.history(e.id, undefined, undefined, limite);
    return {
      content: {
        exercicio: e.name,
        historico: rows.map((r) => ({
          data: r.performed_at,
          series: r.sets.map((s) => ({ reps: s.reps, peso: s.weight_kg })),
        })),
      },
      action: null,
    };
  },

  async buscar_evidencia(args) {
    const query = String(args.query ?? "");
    const hits = searchEvidence(query, 4);
    return {
      content: {
        evidencias: hits.map((h) => ({ titulo: h.title, ano: h.year, url: h.url, trecho: h.text })),
      },
      action: null,
    };
  },
};

/** Executa a ferramenta. Retorna (json_para_o_LLM, rotulo_de_acao|null). */
export async function callTool(name: string, args: Record<string, unknown>): Promise<[string, string | null]> {
  const fn = IMPL[name];
  if (!fn) return [JSON.stringify({ erro: `ferramenta desconhecida: ${name}` }), null];
  try {
    const res = await fn(args);
    return [JSON.stringify(res.content), res.action];
  } catch (e) {
    return [JSON.stringify({ erro: String(e) }), null];
  }
}

export const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: { name: "listar_treinos", description: "Lista os treinos do usuario (ativos e inativos).", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: { name: "listar_exercicios", description: "Lista os exercicios do catalogo.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: {
      name: "criar_exercicio",
      description: "Cria um exercicio no catalogo.",
      parameters: { type: "object", properties: { nome: { type: "string" }, grupo_muscular: { type: "string" } }, required: ["nome"] },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_treino",
      description: "Cria um treino. Pode ja incluir uma lista de exercicios (por nome); os que nao existirem sao criados.",
      parameters: { type: "object", properties: { nome: { type: "string" }, exercicios: { type: "array", items: { type: "string" } } }, required: ["nome"] },
    },
  },
  {
    type: "function",
    function: {
      name: "adicionar_exercicio_ao_treino",
      description: "Adiciona um exercicio a um treino existente.",
      parameters: {
        type: "object",
        properties: { treino: { type: "string" }, exercicio: { type: "string" }, series: { type: "integer", description: "numero de series alvo (padrao 6)" } },
        required: ["treino", "exercicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_diario",
      description: "Registra no diario os exercicios feitos hoje (reps e peso por serie). Reusa a sessao do dia se ja existir.",
      parameters: {
        type: "object",
        properties: {
          treino: { type: "string", description: "nome do treino; se omitido e houver so 1 ativo, usa ele" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exercicio: { type: "string" },
                series: { type: "array", items: { type: "object", properties: { reps: { type: "integer" }, peso: { type: "number" } } } },
              },
              required: ["exercicio", "series"],
            },
          },
        },
        required: ["itens"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_perfil",
      description: "Dados pessoais do usuario: altura, sexo, metas/objetivos e o historico de medidas corporais (peso, % gordura, massa muscular, etc.). Use para diagnosticos e analise de progressao corporal.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_evidencia",
      description: "Busca na base de estudos cientificos (hipertrofia, emagrecimento, nutricao). Use ANTES de responder perguntas de treino/dieta e CITE as fontes retornadas (titulo/ano/url).",
      parameters: { type: "object", properties: { query: { type: "string", description: "pergunta/tema a buscar" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_historico",
      description: "Historico recente de um exercicio (datas, reps e peso).",
      parameters: { type: "object", properties: { exercicio: { type: "string" }, limite: { type: "integer" } }, required: ["exercicio"] },
    },
  },
];
