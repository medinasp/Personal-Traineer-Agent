import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sessionsApi } from "../api/sessions";
import type { SetLogIn } from "../types";

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: number) => sessionsApi.create({ workout_id: workoutId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useSessionsList() {
  return useQuery({ queryKey: ["sessions"], queryFn: () => sessionsApi.list() });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsApi.detail(id),
    enabled: id > 0, // sessao local (id negativo) vem so do cache otimista
  });
}

export function useLastSets(sessionId: number, exerciseId: number) {
  return useQuery({
    queryKey: ["last", sessionId, exerciseId],
    queryFn: () => sessionsApi.lastSets(sessionId, exerciseId),
  });
}

export function useSaveSets(sessionId: number, exerciseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sets: SetLogIn[]) =>
      sessionsApi.saveSets(sessionId, exerciseId, sets),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["session", sessionId] }),
  });
}

export function useDeleteSession() {
  return useMutation({
    mutationFn: (id: number) => sessionsApi.remove(id),
  });
}
