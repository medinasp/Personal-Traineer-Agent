/**
 * Orquestrador do Coach rodando no celular: loop de tool-calling com a Groq +
 * historico da conversa no SQLite local. Equivalente a app/agent/runner.py,
 * mas 100% no aparelho (so a chamada ao modelo sai pra internet).
 */
import { all, nowIso, run } from "../db/index";
import { emitChange, syncNow } from "../db/sync";
import { qc } from "../queryClient";
import {
  chatCompletion,
  CoachConfigError,
  CoachOfflineError,
  CoachRateLimitError,
  isConfigured,
  type ChatMessage,
} from "./groq";
import { callTool, TOOLS } from "./tools";

export { CoachConfigError, CoachOfflineError, CoachRateLimitError, isConfigured };

const SYSTEM_PROMPT =
  "Voce e o Coach, um assistente de treino de musculacao dentro de um app pessoal. " +
  "Responda SEMPRE em portugues do Brasil, de forma clara, pratica e baseada em evidencia. " +
  "Voce PODE agir no app usando as ferramentas: criar treinos e exercicios, adicionar exercicios " +
  "a treinos e registrar o diario de treino. Quando o usuario pedir uma acao, execute-a com a " +
  "ferramenta e depois confirme em uma frase o que foi feito. " +
  "Se faltar informacao essencial (ex.: em qual treino registrar), pergunte antes de agir. " +
  "Para diagnosticos e analises de progressao, use consultar_perfil (dados corporais e metas) e " +
  "consultar_historico (evolucao de carga nos exercicios), cruzando os dois ao longo do tempo. " +
  "Para perguntas de treino/dieta, use a ferramenta buscar_evidencia ANTES de responder e CITE as " +
  "fontes retornadas (titulo e ano). Se a base nao tiver nada relevante, responda com conhecimento " +
  "geral e deixe claro que e recomendacao geral. Nao invente numeros nem estudos. " +
  "Saude/dieta e informativo e nao substitui um profissional. Seja conciso.";

const MAX_TOOL_LOOPS = 12;
const MAX_HISTORY = 20;

export interface ChatRow {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function getHistory(): Promise<ChatRow[]> {
  return all<ChatRow>("SELECT id, role, content, created_at FROM chat_message ORDER BY id");
}

async function addMessage(role: "user" | "assistant", content: string): Promise<void> {
  await run("INSERT INTO chat_message (role, content, created_at) VALUES (?,?,?)", [role, content, nowIso()]);
}

export async function clearHistory(): Promise<void> {
  await run("DELETE FROM chat_message");
}

export interface CoachReply {
  reply: string;
  actions: string[];
}

export async function runChat(userText: string): Promise<CoachReply> {
  if (!isConfigured()) {
    return { reply: "O Coach não está configurado (falta a chave da Groq no app).", actions: [] };
  }

  // contexto: ultimas mensagens + a nova do usuario
  const prior = (await getHistory()).slice(-MAX_HISTORY);
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of prior) messages.push({ role: m.role, content: m.content });
  messages.push({ role: "user", content: userText });

  await addMessage("user", userText);

  const actions: string[] = [];
  let reply = "";
  let modelIdx = 0; // elo da cadeia em uso; se cair pra um fallback, fixa nele no resto do turno

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const choice = await chatCompletion(messages, TOOLS, modelIdx);
    modelIdx = choice.modelIndex;
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      messages.push({ role: "assistant", content: choice.content || "", tool_calls: choice.tool_calls });
      for (const tc of choice.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        const [content, action] = await callTool(tc.function.name, args);
        if (action) actions.push(action);
        messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content });
      }
      continue;
    }
    reply = choice.content || "";
    break;
  }
  if (!reply) reply = "Me enrolei processando isso. Pode reformular?";

  await addMessage("assistant", reply);

  // o agente pode ter mexido em treinos/exercicios/sessoes -> refaz leituras locais e sincroniza
  if (actions.length > 0) {
    qc.invalidateQueries();
    emitChange();
    void syncNow();
  }

  return { reply, actions };
}
