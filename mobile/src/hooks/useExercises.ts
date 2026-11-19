import { useMutation, useQuery } from "@tanstack/react-query";

import { exercisesRepo } from "../db/repos";
import { createLocalExercise, deleteLocalExercise, updateLocalExercise } from "../offline/outbox";
import type { ExerciseCreate } from "../types";

const KEY = ["exercises"];

export function useExercises() {
  return useQuery({ queryKey: KEY, queryFn: () => exercisesRepo.list() });
}

/** so exercicios que ja tem historico */
export function useExercisesWithHistory() {
  return useQuery({ queryKey: [...KEY, "with-history"], queryFn: () => exercisesRepo.list(true, true) });
}

export function useCreateExercise() {
  return useMutation({ mutationFn: (data: ExerciseCreate) => createLocalExercise(data) });
}
export function useUpdateExercise() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ExerciseCreate> }) => updateLocalExercise(id, data),
  });
}
export function useDeleteExercise() {
  return useMutation({ mutationFn: (id: number) => deleteLocalExercise(id) });
}
