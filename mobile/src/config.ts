// URL base da API. Defina EXPO_PUBLIC_API_URL no .env (ver .env.example).
// No emulador/celular use o IP da sua maquina na LAN, nao "localhost".
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Token de acesso a API (deve bater com API_TOKEN do backend em producao).
// Vazio em dev local (auth desligada).
export const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? "";

// ===== Coach rodando no proprio celular (chama a Groq direto) =====
// A chave fica embarcada no app (EXPO_PUBLIC_*). Como e um app pessoal que so
// voce instala, o risco e baixo; ainda assim: nao publique o APK em loja aberta.
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";

// Cadeia de modelos: primario + fallbacks, tentados nesta ordem. Cada modelo tem
// cota diaria propria no tier gratis -> a cadeia soma capacidade e sobrevive a 429.
// Todos precisam suportar tool-calling (senao o coach para de agir). Trocar a lista
// = OTA `eas update`, sem rebuild. Ordem por: qualidade > cota propria > perenidade.
export const GROQ_MODELS: string[] = (
  process.env.EXPO_PUBLIC_GROQ_MODELS ??
  "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b"
)
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);

export const GROQ_WHISPER_MODEL =
  process.env.EXPO_PUBLIC_GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";
