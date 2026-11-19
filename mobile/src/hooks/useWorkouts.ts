import { useMutation, useQuery } from "@tanstack/react-query";

import { workoutsRepo } from "../db/repos";
import { createLocalWorkout, setLocalWorkoutActive, updateLocalWorkout } from "../offline/outbox";
import type { WorkoutCreate, WorkoutExerciseIn } from "../types";

const KEY = ["workouts"];

export function useWorkouts(includeArchived = false) {
  return useQuery({
    queryKey: [...KEY, { includeArchived }],
    queryFn: () => workoutsRepo.list(includeArchived),
  });
}

export function useWorkout(id: number) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => workoutsRepo.detail(id),
    enabled: id > 0,
  });
}

export function useCreateWorkout() {
  return useMutation({ mutationFn: (data: WorkoutCreate) => createLocalWorkout(data) });
}

export function useUpdateWorkout() {
  return useMutation({
    mutationFn: ({ id, name, exercises }: { id: number; name: string; exercises: WorkoutExerciseIn[] }) =>
      updateLocalWorkout(id, { name, exercises }),
  });
}

export function useSetWorkoutActive() {
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setLocalWorkoutActive(id, active),
  });
}
