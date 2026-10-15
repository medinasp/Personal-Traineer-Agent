import { useMutation, useQuery } from "@tanstack/react-query";

import { workoutsApi } from "../api/workouts";
import { createLocalWorkout, setLocalWorkoutActive, updateLocalWorkout } from "../offline/outbox";
import type { WorkoutCreate, WorkoutExerciseIn } from "../types";

const KEY = ["workouts"];

export function useWorkouts(includeArchived = false) {
  return useQuery({
    queryKey: [...KEY, { includeArchived }],
    queryFn: () => workoutsApi.list(includeArchived),
  });
}

export function useWorkout(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => workoutsApi.detail(id),
    enabled: id > 0, // treino local (id negativo) vem so do cache otimista
  });
}

// Escrita offline-first: cache otimista + outbox.
export function useCreateWorkout() {
  return useMutation({ mutationFn: (data: WorkoutCreate) => createLocalWorkout(data) });
}

export function useUpdateWorkout() {
  return useMutation({
    mutationFn: ({ id, name, exercises }: { id: number; name: string; exercises: WorkoutExerciseIn[] }) =>
      updateLocalWorkout(id, { name, exercises }),
  });
}

/** ativa/desativa um treino (archived = !active), mantendo o historico */
export function useSetWorkoutActive() {
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setLocalWorkoutActive(id, active),
  });
}
