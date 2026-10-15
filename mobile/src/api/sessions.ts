import type {
  LastResponse,
  SessionDetail,
  SetLog,
  SetLogIn,
  WorkoutSession,
} from "../types";
import { api } from "./client";

export const sessionsApi = {
  list: () => api.get<WorkoutSession[]>("/sessions"),
  create: (body: { workout_id: number; client_token?: string; performed_at?: string }) =>
    api.post<WorkoutSession>("/sessions", body),
  detail: (id: number) => api.get<SessionDetail>(`/sessions/${id}`),
  saveSets: (sessionId: number, exerciseId: number, sets: SetLogIn[]) =>
    api.put<SetLog[]>(`/sessions/${sessionId}/exercises/${exerciseId}/sets`, {
      sets,
    }),
  lastSets: (sessionId: number, exerciseId: number) =>
    api.get<LastResponse>(`/sessions/${sessionId}/exercises/${exerciseId}/last`),
  remove: (id: number) => api.del(`/sessions/${id}`),
};
