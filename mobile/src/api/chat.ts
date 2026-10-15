import { API_TOKEN, API_URL } from "../config";
import type { ChatMessageRow, ChatResponse } from "../types";
import { api } from "./client";

export const chatApi = {
  send: (message: string) => api.post<ChatResponse>("/chat", { message }),
  history: () => api.get<ChatMessageRow[]>("/chat/history"),
  clear: () => api.del("/chat"),
};

/** Envia o audio gravado e devolve a transcricao (Groq Whisper no backend). */
export async function transcribeAudio(uri: string): Promise<string> {
  const form = new FormData();
  // RN aceita { uri, name, type } como parte de arquivo no FormData
  form.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as unknown as Blob);
  const res = await fetch(`${API_URL}/chat/transcribe`, {
    method: "POST",
    headers: { ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error(`transcrição falhou (${res.status})`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}
