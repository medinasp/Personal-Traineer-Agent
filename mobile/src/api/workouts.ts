import type {
  Workout,
  WorkoutCreate,
  WorkoutDetail,
  WorkoutExerciseIn,
} from "../types";
import { api } from "./client";

export const workoutsApi = {
  list: (includeArchived = false) =>
    api.get<Workout[]>(`/workouts?include_archived=${includeArchived}`),
  detail: (id: number) => api.get<WorkoutDetail>(`/workouts/${id}`),
  create: (data: WorkoutCreate) => api.post<WorkoutDetail>("/workouts", data),
  update: (
    id: number,
    data: { name?: string; notes?: string | null; archived?: boolean },
  ) => api.patch<WorkoutDetail>(`/workouts/${id}`, data),
  setExercises: (id: number, exercises: WorkoutExerciseIn[]) =>
    api.put<WorkoutDetail>(`/workouts/${id}/exercises`, exercises),
  remove: (id: number) => api.del(`/workouts/${id}`),
};
