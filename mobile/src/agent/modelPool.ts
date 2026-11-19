/**
 * Pool de modelos auto-regeneravel ("self-healing").
 *
 * A cadeia de fallback deixa de ser const fixa e passa a ser um pool persistido
 * no SQLite (meta.model_pool). Quando a cadeia inteira falha num turno, o pool:
 *   1) audita os modelos contra o catalogo vivo (GET /models): os que sumiram
 *      do catalogo sao removidos; os que ainda existem (ex.: so deram 429) ficam;
 *   2) descobre candidatos novos e faz um PROBE (1 request minimo forcando
 *      tool-calling) pra confirmar que servem; adiciona os aprovados;
 *   3) garante pelo menos TARGET modelos, sempre com suporte a tools.
 *
 * Custo controlado por THROTTLE (frequencia) + MAX_PROBES (teto por manutencao).
 * Limite honesto: /models nao expoe qualidade nem cota -> o ranqueio de
 * candidatos e heuristico (familia conhecida + tamanho), nao "o melhor".
 */
import { GROQ_API_KEY, GROQ_MODELS } from "../config";
import { first, run } from "../db/index";

const BASE = "https://api.groq.com/openai/v1";
const META_KEY = "model_pool";
const TARGET = 3; // sempre mirar >= 3 modelos disponiveis
const MAX_POOL = 5; // teto pra nao crescer sem limite
const MAX_PROBES = 4; // teto de probes por manutencao (controla gasto de cota)
const THROTTLE_LAZY = 60 * 60 * 1000; // rotina (foreground): no max 1x/h
const THROTTLE_FORCED = 10 * 60 * 1000; // disparada por falha da cadeia: no max 1x/10min

interface PoolState {
  models: string[];
  lastMaintain: number;
}

async function readState(): Promise<PoolState> {
  const r = await first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [META_KEY]);
  if (r?.value) {
    try {
      const s = JSON.parse(r.value) as Partial<PoolState>;
      if (Array.isArray(s.models) && s.models.length) {
        return { models: s.models, lastMaintain: s.lastMaintain ?? 0 };
      }
    } catch {
      /* corrompido -> cai no seed */
    }
  }
  return { models: [...GROQ_MODELS], lastMaintain: 0 };
}

async function writeState(s: PoolState): Promise<void> {
  await run(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [META_KEY, JSON.stringify(s)],
  );
}

/** Cadeia atual em ordem de prioridade (semeada com GROQ_MODELS na 1a vez). */
export async function getPool(): Promise<string[]> {
  return (await readState()).models;
}

// ---------------- catalogo + filtro ----------------
// exclui o que nao e chat de texto (audio/guard/embeddings/arabe) pra nao gastar probe a toa
const EXCLUDE = /whisper|tts|orpheus|guard|embed|embedding|allam|safeguard|moderation/i;
const isChatCandidate = (id: string) => !EXCLUDE.test(id);

async function listCatalog(): Promise<string[] | null> {
  try {
    const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } });
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: { id: string }[] };
    return (d.data ?? []).map((m) => m.id);
  } catch {
    return null;
  }
}

// ---------------- probe ----------------
type ProbeResult = "ok" | "no-tools" | "gone" | "ratelimited" | "error";

async function probe(model: string): Promise<ProbeResult> {
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: "Teste: chame a ferramenta ping agora." }],
    tools: [
      { type: "function", function: { name: "ping", description: "responde ping", parameters: { type: "object", properties: {} } } },
    ],
    tool_choice: "auto",
    max_tokens: 64,
    temperature: 0,
  });
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body,
    });
  } catch {
    return "error";
  }
  if (res.status === 429) return "ratelimited";
  if (res.status === 404 || res.status === 400) return "gone"; // modelo inexistente/aposentado
  if (!res.ok) return "error";
  try {
    const d = (await res.json()) as { choices?: { message?: { tool_calls?: unknown[] } }[] };
    const tc = d.choices?.[0]?.message?.tool_calls;
    return tc && tc.length > 0 ? "ok" : "no-tools";
  } catch {
    return "error";
  }
}

// ---------------- ranqueio heuristico (API nao da qualidade/cota) ----------------
const PREFER = ["gpt-oss-120b", "gpt-oss", "qwen", "llama-3.3", "llama-3", "llama", "mixtral", "kimi", "deepseek", "gemma"];
function score(id: string): number {
  const i = PREFER.findIndex((p) => id.includes(p));
  const base = i === -1 ? 0 : PREFER.length - i;
  const m = id.match(/(\d+)\s*b/i); // bonus leve por tamanho (120b > 70b > 32b...)
  const size = m ? Math.min(parseInt(m[1], 10), 999) / 1000 : 0;
  return base + size;
}

function dedupe(a: string[]): string[] {
  return [...new Set(a)];
}

export interface MaintainResult {
  models: string[];
  added: string[]; // modelos novos descobertos nesta passada (pro coach tentar primeiro)
}

let maintaining = false;

/**
 * Audita + descobre + refila o pool. `forced` = disparado por falha da cadeia
 * (quer capacidade fresca agora); senao e manutencao de rotina (so poda os que
 * sumiram, sem gastar probe se ja houver TARGET).
 */
export async function maintain(forced: boolean): Promise<MaintainResult> {
  const s = await readState();
  const now = Date.now();
  const limit = forced ? THROTTLE_FORCED : THROTTLE_LAZY;
  if (maintaining || now - s.lastMaintain < limit) return { models: s.models, added: [] };

  maintaining = true;
  try {
    const catalog = await listCatalog();
    if (!catalog) return { models: s.models, added: [] }; // offline/erro -> nao mexe no pool
    const inCatalog = new Set(catalog);

    // 1) auditoria: mantem os que ainda existem; descarta os aposentados
    const kept = s.models.filter((m) => inCatalog.has(m));

    // 2) descoberta/refill: precisa repor ate TARGET e, se forcado, achar >=1 fresco pra responder agora
    const added: string[] = [];
    const needFresh = forced;
    if (TARGET - kept.length > 0 || needFresh) {
      const candidates = catalog
        .filter(isChatCandidate)
        .filter((id) => !kept.includes(id))
        .sort((a, b) => score(b) - score(a));
      let probes = 0;
      for (const c of candidates) {
        if (probes >= MAX_PROBES) break;
        if (kept.length + added.length >= TARGET && (!needFresh || added.length >= 1)) break;
        probes++;
        if ((await probe(c)) === "ok") added.push(c);
      }
    }

    // prioridade preservada: mantidos na ordem antiga, novos no fim (o coach ainda
    // comeca a tentativa de retry pelo novo via o indice de `added`)
    const models = dedupe([...kept, ...added]).slice(0, MAX_POOL);
    const next: PoolState = { models: models.length ? models : s.models, lastMaintain: now };
    await writeState(next);
    return { models: next.models, added };
  } finally {
    maintaining = false;
  }
}
