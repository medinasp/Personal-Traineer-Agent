/**
 * Fachada de escrita local-first: mesmos nomes de antes, agora sobre o SQLite.
 * Cada escrita: grava no banco local -> atualiza a UI -> tenta sincronizar.
 */
import {
  exercisesRepo,
  measurementsRepo,
  pendingCount,
  profileRepo,
  sessionsRepo,
  workoutsRepo,
} from "../db/repos";
import { backendUp, emitChange, subscribeSync, syncNow } from "../db/sync";
import { qc } from "../queryClient";
import type {
  Exercise,
  ExerciseCreate,
  Measurement,
  MeasurementCreate,
  ProfileUpdate,
  SetLogIn,
  WorkoutCreate,
  WorkoutDetail,
  WorkoutExerciseIn,
  WorkoutSession,
} from "../types";

// invalida as queries que leem do SQLite (refaz leitura local, instantanea) + sincroniza
function kick() {
  for (const key of [["exercises"], ["workouts"], ["sessions"], ["session"], ["history"], ["profile"], ["measurements"]]) {
    qc.invalidateQueries({ queryKey: key });
  }
  emitChange();
  void syncNow();
}

// ---- sessao / series ----
export async function createLocalSession(workoutId: number): Promise<WorkoutSession> {
  const s = await sessionsRepo.create(workoutId);
  kick();
  return s;
}
export async function enqueueSaveSets(ref: number, exerciseId: number, sets: SetLogIn[]): Promise<void> {
  await sessionsRepo.saveSets(ref, exerciseId, sets);
  kick();
}

// ---- exercicios ----
export async function createLocalExercise(data: ExerciseCreate): Promise<Exercise> {
  const e = await exercisesRepo.create(data);
  kick();
  return e;
}
export async function updateLocalExercise(id: number, data: Partial<ExerciseCreate>): Promise<void> {
  await exercisesRepo.update(id, data);
  kick();
}
export async function deleteLocalExercise(id: number): Promise<void> {
  await exercisesRepo.remove(id);
  kick();
}

// ---- treinos ----
export async function createLocalWorkout(data: WorkoutCreate): Promise<WorkoutDetail> {
  const w = await workoutsRepo.create(data);
  kick();
  return w;
}
export async function updateLocalWorkout(
  id: number,
  payload: { name: string; exercises: WorkoutExerciseIn[] },
): Promise<void> {
  await workoutsRepo.update(id, payload.name, payload.exercises);
  kick();
}
export async function setLocalWorkoutActive(id: number, active: boolean): Promise<void> {
  await workoutsRepo.setActive(id, active);
  kick();
}

// ---- perfil / medidas ----
export async function saveLocalProfile(data: ProfileUpdate): Promise<void> {
  await profileRepo.update(data);
  kick();
}
export async function createLocalMeasurement(data: MeasurementCreate): Promise<Measurement> {
  const m = await measurementsRepo.create(data);
  kick();
  return m;
}
export async function deleteLocalMeasurement(id: number): Promise<void> {
  await measurementsRepo.remove(id);
  kick();
}

// ---- compat: nomes antigos usados por useOutbox / OfflineSync ----
export { backendUp };
export const queueLength = pendingCount;
export const subscribeOutbox = subscribeSync;
