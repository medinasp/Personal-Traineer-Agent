import AsyncStorage from "@react-native-async-storage/async-storage";

import { exercisesApi } from "../api/exercises";
import { ApiError } from "../api/client";
import { sessionsApi } from "../api/sessions";
import { workoutsApi } from "../api/workouts";
import { API_URL } from "../config";
import { qc } from "../queryClient";
import type {
  Exercise,
  ExerciseCreate,
  SessionDetail,
  SetLogIn,
  Workout,
  WorkoutCreate,
  WorkoutDetail,
  WorkoutExerciseIn,
  WorkoutSession,
} from "../types";

const Q_KEY = "offline.queue.v2";
const MAP_KEY = "offline.idmap.v2";

interface ExLink {
  exercise_id: number;
  target_sets: number;
}

type Op = { id: string } & (
  | { kind: "create_session"; tmpId: number; token: string; workout_id: number; performed_at: string }
  | { kind: "save_sets"; ref: number; exercise_id: number; sets: SetLogIn[] }
  | { kind: "create_exercise"; tmpId: number; token: string; data: ExerciseCreate }
  | { kind: "update_exercise"; ref: number; data: Partial<ExerciseCreate> }
  | { kind: "delete_exercise"; ref: number }
  | { kind: "create_workout"; tmpId: number; token: string; name: string; exercises: ExLink[] }
  | { kind: "update_workout"; ref: number; name: string; exercises: ExLink[] }
  | { kind: "set_workout_active"; ref: number; active: boolean }
);

// ---- pub/sub ----
const listeners = new Set<() => void>();
export function subscribeOutbox(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  listeners.forEach((f) => f());
}

// ---- storage ----
async function load<T>(key: string, def: T): Promise<T> {
  const s = await AsyncStorage.getItem(key);
  return s ? (JSON.parse(s) as T) : def;
}
async function save(key: string, v: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(v));
}
export async function queueLength(): Promise<number> {
  return (await load<Op[]>(Q_KEY, [])).length;
}
async function pushOp(op: Op): Promise<void> {
  const q = await load<Op[]>(Q_KEY, []);
  q.push(op);
  await save(Q_KEY, q);
  emit();
}
async function removeOp(id: string): Promise<void> {
  const q = await load<Op[]>(Q_KEY, []);
  await save(Q_KEY, q.filter((o) => o.id !== id));
  emit();
}
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
let idSeq = 0;
function tmpId(): number {
  idSeq += 1;
  return -(Date.now() * 1000 + (idSeq % 1000));
}

// ---- conectividade ----
const HEALTH = API_URL.replace(/\/api\/v1\/?$/, "") + "/health";
export async function backendUp(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(HEALTH, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

// ---- cache helpers ----
const WK_FALSE = ["workouts", { includeArchived: false }];
const WK_TRUE = ["workouts", { includeArchived: true }];
const nowIso = () => new Date().toISOString();

function catalogExercise(id: number): Exercise {
  const list = qc.getQueryData<Exercise[]>(["exercises"]);
  const found = list?.find((e) => e.id === id);
  return (
    found ?? {
      id,
      name: "Exercício",
      muscle_group: null,
      equipment: null,
      icon: null,
      archived: false,
      created_at: nowIso(),
    }
  );
}

function addWorkoutToLists(w: Workout) {
  for (const key of [WK_FALSE, WK_TRUE]) {
    qc.setQueryData<Workout[]>(key, (old) =>
      old ? (old.some((x) => x.id === w.id) ? old : [...old, w]) : [w],
    );
  }
}
function patchWorkoutInLists(id: number, patch: Partial<Workout>) {
  for (const key of [WK_FALSE, WK_TRUE]) {
    qc.setQueryData<Workout[]>(key, (old) => old?.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }
}
function setArchivedInLists(id: number, archived: boolean) {
  qc.setQueryData<Workout[]>(WK_TRUE, (old) => old?.map((w) => (w.id === id ? { ...w, archived } : w)));
  qc.setQueryData<Workout[]>(WK_FALSE, (old) => {
    if (!old) return old;
    if (archived) return old.filter((w) => w.id !== id);
    if (old.some((w) => w.id === id)) return old.map((w) => (w.id === id ? { ...w, archived: false } : w));
    const t = qc.getQueryData<Workout[]>(WK_TRUE)?.find((w) => w.id === id);
    return t ? [...old, { ...t, archived: false }] : old;
  });
}
function buildLinks(exs: WorkoutExerciseIn[]) {
  return exs.map((ei, idx) => ({
    id: tmpId(),
    exercise_id: ei.exercise_id,
    position: ei.position ?? idx + 1,
    target_sets: ei.target_sets ?? 6,
    exercise: catalogExercise(ei.exercise_id),
  }));
}

// =====================================================================
//  SESSAO / SERIES (diario)
// =====================================================================
export async function createLocalSession(workout_id: number): Promise<WorkoutSession> {
  const id = tmpId();
  const token = "s_" + uid();
  const performed_at = nowIso();
  const s: WorkoutSession = { id, workout_id, performed_at, notes: null, client_token: token, created_at: performed_at };
  qc.setQueryData<WorkoutSession[]>(["sessions"], (old) => (old ? [s, ...old] : [s]));
  qc.setQueryData<SessionDetail>(["session", id], { ...s, set_logs: [] });
  await pushOp({ id: uid(), kind: "create_session", tmpId: id, token, workout_id, performed_at });
  void flush();
  return s;
}

export async function enqueueSaveSets(ref: number, exercise_id: number, sets: SetLogIn[]): Promise<void> {
  qc.setQueryData<SessionDetail>(["session", ref], (old) => {
    if (!old) return old;
    const others = old.set_logs.filter((l) => l.exercise_id !== exercise_id);
    const added = sets.map((s, i) => ({
      id: -(Date.now() + i),
      exercise_id,
      set_number: s.set_number,
      reps: s.reps ?? null,
      weight_kg: s.weight_kg ?? null,
    }));
    return { ...old, set_logs: [...others, ...added] };
  });
  await pushOp({ id: uid(), kind: "save_sets", ref, exercise_id, sets });
  void flush();
}

// =====================================================================
//  EXERCICIOS
// =====================================================================
export async function createLocalExercise(data: ExerciseCreate): Promise<Exercise> {
  const id = tmpId();
  const token = "e_" + uid();
  const e: Exercise = {
    id,
    name: data.name,
    muscle_group: data.muscle_group ?? null,
    equipment: data.equipment ?? null,
    icon: data.icon ?? null,
    archived: false,
    created_at: nowIso(),
  };
  qc.setQueryData<Exercise[]>(["exercises"], (old) => (old ? [...old, e] : [e]));
  await pushOp({ id: uid(), kind: "create_exercise", tmpId: id, token, data });
  void flush();
  return e;
}

export async function updateLocalExercise(id: number, data: Partial<ExerciseCreate>): Promise<void> {
  qc.setQueryData<Exercise[]>(["exercises"], (old) => old?.map((e) => (e.id === id ? { ...e, ...data } : e)));
  await pushOp({ id: uid(), kind: "update_exercise", ref: id, data });
  void flush();
}

export async function deleteLocalExercise(id: number): Promise<void> {
  qc.setQueryData<Exercise[]>(["exercises"], (old) => old?.filter((e) => e.id !== id));
  if (id < 0) {
    // ainda nao sincronizado: cancela a criacao e remove das ops que o referenciam
    let q = await load<Op[]>(Q_KEY, []);
    q = q.filter((o) => !(("tmpId" in o && o.tmpId === id) || ("ref" in o && o.ref === id)));
    for (const o of q) {
      if (o.kind === "create_workout" || o.kind === "update_workout") {
        o.exercises = o.exercises.filter((x) => x.exercise_id !== id);
      }
    }
    await save(Q_KEY, q);
    emit();
    return;
  }
  await pushOp({ id: uid(), kind: "delete_exercise", ref: id });
  void flush();
}

// =====================================================================
//  TREINOS
// =====================================================================
export async function createLocalWorkout(data: WorkoutCreate): Promise<WorkoutDetail> {
  const id = tmpId();
  const token = "w_" + uid();
  const created_at = nowIso();
  const detail: WorkoutDetail = {
    id,
    name: data.name,
    notes: data.notes ?? null,
    archived: false,
    created_at,
    exercises: buildLinks(data.exercises ?? []),
  };
  addWorkoutToLists({ id, name: data.name, notes: data.notes ?? null, archived: false, created_at });
  qc.setQueryData<WorkoutDetail>(["workouts", id], detail);
  const exercises: ExLink[] = (data.exercises ?? []).map((e) => ({
    exercise_id: e.exercise_id,
    target_sets: e.target_sets ?? 6,
  }));
  await pushOp({ id: uid(), kind: "create_workout", tmpId: id, token, name: data.name, exercises });
  void flush();
  return detail;
}

export async function updateLocalWorkout(
  id: number,
  payload: { name: string; exercises: WorkoutExerciseIn[] },
): Promise<void> {
  qc.setQueryData<WorkoutDetail>(["workouts", id], (old) =>
    old ? { ...old, name: payload.name, exercises: buildLinks(payload.exercises) } : old,
  );
  patchWorkoutInLists(id, { name: payload.name });
  const exercises: ExLink[] = payload.exercises.map((e) => ({
    exercise_id: e.exercise_id,
    target_sets: e.target_sets ?? 6,
  }));
  await pushOp({ id: uid(), kind: "update_workout", ref: id, name: payload.name, exercises });
  void flush();
}

export async function setLocalWorkoutActive(id: number, active: boolean): Promise<void> {
  setArchivedInLists(id, !active);
  qc.setQueryData<WorkoutDetail>(["workouts", id], (old) => (old ? { ...old, archived: !active } : old));
  await pushOp({ id: uid(), kind: "set_workout_active", ref: id, active });
  void flush();
}

// =====================================================================
//  SINCRONIZACAO
// =====================================================================
let flushing = false;

export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const q = await load<Op[]>(Q_KEY, []);
    if (q.length === 0) return;
    if (!(await backendUp())) return;
    const map = await load<Record<number, number>>(MAP_KEY, {});
    const resolve = (id: number): number | null => (id < 0 ? map[id] ?? null : id);

    for (const op of q) {
      try {
        if (op.kind === "create_exercise") {
          const real = await exercisesApi.create({ ...op.data, client_token: op.token });
          map[op.tmpId] = real.id;
          await save(MAP_KEY, map);
        } else if (op.kind === "update_exercise") {
          const id = resolve(op.ref);
          if (id == null) break;
          await exercisesApi.update(id, op.data);
        } else if (op.kind === "delete_exercise") {
          const id = resolve(op.ref);
          if (id == null) break;
          await exercisesApi.remove(id);
        } else if (op.kind === "create_workout") {
          const exs = op.exercises.map((e) => ({ exercise_id: resolve(e.exercise_id), target_sets: e.target_sets }));
          if (exs.some((e) => e.exercise_id == null)) break;
          const real = await workoutsApi.create({
            name: op.name,
            exercises: exs as WorkoutExerciseIn[],
            client_token: op.token,
          });
          map[op.tmpId] = real.id;
          await save(MAP_KEY, map);
        } else if (op.kind === "update_workout") {
          const id = resolve(op.ref);
          const exs = op.exercises.map((e) => ({ exercise_id: resolve(e.exercise_id), target_sets: e.target_sets }));
          if (id == null || exs.some((e) => e.exercise_id == null)) break;
          await workoutsApi.update(id, { name: op.name });
          await workoutsApi.setExercises(id, exs as WorkoutExerciseIn[]);
        } else if (op.kind === "set_workout_active") {
          const id = resolve(op.ref);
          if (id == null) break;
          await workoutsApi.update(id, { archived: !op.active });
        } else if (op.kind === "create_session") {
          const wid = resolve(op.workout_id);
          if (wid == null) break;
          const real = await sessionsApi.create({ workout_id: wid, client_token: op.token, performed_at: op.performed_at });
          map[op.tmpId] = real.id;
          await save(MAP_KEY, map);
        } else if (op.kind === "save_sets") {
          const sid = resolve(op.ref);
          const eid = resolve(op.exercise_id);
          if (sid == null || eid == null) break;
          await sessionsApi.saveSets(sid, eid, op.sets);
        }
        await removeOp(op.id);
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status >= 500) break; // servidor instavel: tenta depois
          await removeOp(op.id); // 4xx: op invalida, descarta
        } else {
          break; // falha de rede: para e mantem a fila
        }
      }
    }
    qc.invalidateQueries();
  } finally {
    flushing = false;
    emit();
  }
}
