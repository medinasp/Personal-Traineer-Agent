/**
 * Cliente da Groq rodando no proprio celular (API compativel com OpenAI).
 * Chat com tool-calling + transcricao de audio (Whisper). Sem backend no meio.
 *
 * Cadeia de modelos (GROQ_MODELS): tenta o primario; se bater limite (429) ou der
 * erro transitorio, cai pro proximo. Erros viram mensagens amigaveis em pt-BR,
 * inclusive "limite atingido, volta em ~X".
 */
import { GROQ_API_KEY, GROQ_MODELS, GROQ_WHISPER_MODEL } from "../config";

const BASE = "https://api.groq.com/openai/v1";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function isConfigured(): boolean {
  return GROQ_API_KEY.trim().length > 0;
}

// ---- erros tipados (mensagem ja amigavel em pt-BR) ----
export class CoachOfflineError extends Error {
  constructor() {
    super("O Coach precisa de internet. Tente de novo quando estiver conectado.");
  }
}
export class CoachRateLimitError extends Error {
  constructor(public retryAfterSec: number | null, message: string) {
    super(message);
  }
}
export class CoachConfigError extends Error {}

function friendlyWait(sec: number | null): string {
  if (sec == null) return "daqui a pouco";
  if (sec < 90) return `em ~${Math.ceil(sec)}s`;
  if (sec < 3600) return `em ~${Math.max(1, Math.round(sec / 60))} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `em ~${h}h${m}min` : `em ~${h}h`;
}

/** Extrai o tempo de espera de um 429: header retry-after ou texto "try again in 2m30s". */
function parseRetryAfter(res: Response, body: string): number | null {
  const h = res.headers.get("retry-after");
  if (h && !Number.isNaN(Number(h))) return Number(h);
  const m = body.match(/try again in\s+([0-9hms.\s]+)/i);
  if (m) {
    let sec = 0;
    const hh = m[1].match(/([\d.]+)\s*h/);
    const mm = m[1].match(/([\d.]+)\s*m(?!s)/);
    const ss = m[1].match(/([\d.]+)\s*s/);
    if (hh) sec += parseFloat(hh[1]) * 3600;
    if (mm) sec += parseFloat(mm[1]) * 60;
    if (ss) sec += parseFloat(ss[1]);
    if (sec > 0) return Math.round(sec);
  }
  return null;
}

interface Completion {
  content: string;
  tool_calls?: ToolCall[];
}

/** Uma tentativa num modelo especifico. Lanca erro tipado em falha. */
async function callOne(model: string, messages: ChatMessage[], tools: ToolDef[]): Promise<Completion> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.4, max_tokens: 1024 }),
    });
  } catch {
    throw new CoachOfflineError();
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => "");
    throw new CoachRateLimitError(parseRetryAfter(res, body), "rate-limit");
  }
  if (res.status === 401 || res.status === 403 || res.status === 400 || res.status === 404) {
    throw new CoachConfigError(`Coach com problema de configuração (erro ${res.status}). Confira a chave/modelo.`);
  }
  if (!res.ok) {
    // 5xx e afins: transitorio -> deixa a cadeia tentar o proximo modelo
    throw new Error(`Groq ${res.status}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? "", tool_calls: msg?.tool_calls };
}

export interface ChatResult extends Completion {
  modelIndex: number; // qual elo da cadeia respondeu (pra fixar no resto do turno)
}

/** Tenta os modelos da cadeia a partir de `fromIndex`. Erros amigaveis se todos falharem. */
export async function chatCompletion(
  messages: ChatMessage[],
  tools: ToolDef[],
  fromIndex = 0,
): Promise<ChatResult> {
  let soonest: number | null = null;
  let sawRateLimit = false;
  let sawOffline = false;

  for (let i = fromIndex; i < GROQ_MODELS.length; i++) {
    try {
      const r = await callOne(GROQ_MODELS[i], messages, tools);
      return { ...r, modelIndex: i };
    } catch (e) {
      if (e instanceof CoachConfigError) throw e; // bug de config: falha alto, nao mascara
      if (e instanceof CoachRateLimitError) {
        sawRateLimit = true;
        if (e.retryAfterSec != null && (soonest == null || e.retryAfterSec < soonest)) soonest = e.retryAfterSec;
      } else if (e instanceof CoachOfflineError) {
        sawOffline = true;
      }
      // transitorio/429/offline -> proximo elo
    }
  }

  // todos os elos falharam
  if (sawRateLimit) {
    throw new CoachRateLimitError(
      soonest,
      `O Coach atingiu o limite de uso gratuito por agora. Tente novamente ${friendlyWait(soonest)}.`,
    );
  }
  if (sawOffline) throw new CoachOfflineError();
  throw new Error("O Coach está instável no momento. Tente de novo em instantes.");
}

/** Transcreve audio (m4a) via Whisper na Groq -> texto pt-BR. */
export async function transcribe(uri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as unknown as Blob);
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("language", "pt");
  let res: Response;
  try {
    res = await fetch(`${BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
    });
  } catch {
    throw new CoachOfflineError();
  }
  if (res.status === 429) {
    const body = await res.text().catch(() => "");
    const retry = parseRetryAfter(res, body);
    throw new CoachRateLimitError(retry, `Limite de transcrição de áudio atingido por agora. Tente ${friendlyWait(retry)}.`);
  }
  if (!res.ok) throw new Error(`transcrição falhou (${res.status})`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
