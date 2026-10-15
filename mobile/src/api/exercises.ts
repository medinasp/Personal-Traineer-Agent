import type {
  Exercise,
  ExerciseCreate,
  HistoryQuery,
  HistorySession,
} from "../types";
import { api } from "./client";

export const exercisesApi = {
  list: (includeArchived = false, withHistory = false) =>
    api.get<Exercise[]>(
      `/exercises?include_archived=${includeArchived}&with_history=${withHistory}`,
    ),
  create: (data: ExerciseCreate) => api.post<Exercise>("/exercises", data),
  update: (id: number, data: Partial<ExerciseCreate>) =>
    api.patch<Exercise>(`/exercises/${id}`, data),
  remove: (id: number) => api.del(`/exercises/${id}`),
  history: (id: number, q: HistoryQuery = {}) => {
    const p = new URLSearchParams();
    if (q.limit != null) p.set("limit", String(q.limit));
    if (q.offset != null) p.set("offset", String(q.offset));
    if (q.start) p.set("start", q.start);
    if (q.end) p.set("end", q.end);
    return api.get<HistorySession[]>(`/exercises/${id}/history?${p.toString()}`);
  },
};
