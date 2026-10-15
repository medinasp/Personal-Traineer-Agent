import { useMutation, useQuery } from "@tanstack/react-query";

import { exercisesApi } from "../api/exercises";
import { createLocalExercise, deleteLocalExercise, updateLocalExercise } from "../offline/outbox";
import type { ExerciseCreate } from "../types";

const KEY = ["exercises"];

export function useExercises() {
  return useQuery({ queryKey: KEY, queryFn: () => exercisesApi.list() });
}

/** so exercicios que ja tem historico (inclui arquivados que tenham series) */
export function useExercisesWithHistory() {
  return useQuery({
    queryKey: [...KEY, "with-history"],
    queryFn: () => exercisesApi.list(true, true),
  });
}

// Escrita offline-first: cache otimista + outbox (sincroniza quando o back volta).
export function useCreateExercise() {
  return useMutation({ mutationFn: (data: ExerciseCreate) => createLocalExercise(data) });
}

export function useUpdateExercise() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExerciseCreate> }) =>
      updateLocalExercise(id, data),
  });
}

export function useDeleteExercise() {
  return useMutation({ mutationFn: (id: number) => deleteLocalExercise(id) });
}
