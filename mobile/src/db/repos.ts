/** Repositorios sobre o SQLite local — fonte da verdade do app. Escritas marcam `dirty`. */
import { all, first, nowIso, run, uuid } from "./index";
import type {
  Exercise,
  ExerciseCreate,
  HistorySession,
  Measurement,
  MeasurementCreate,
  Profile,
  ProfileUpdate,
  SessionDetail,
  SetLogIn,
  Workout,
  WorkoutCreate,
  WorkoutDetail,
  WorkoutExerciseIn,
  WorkoutSession,
} from "../types";

const b = (v: unknown) => v === 1 || v === true;

// ============ EXERCISE ============
interface ExRow {
  id: number;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  icon: string | null;
  archived: number;
  created_at: string;
}
const toEx = (r: ExRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscle_group: r.muscle_group,
  equipment: r.equipment,
  icon: r.icon,
  archived: b(r.archived),
  created_at: r.created_at,
});

export const exercisesRepo = {
  async list(includeArchived = false, withHistory = false): Promise<Exercise[]> {
    let sql = "SELECT * FROM exercise WHERE deleted = 0";
    if (!includeArchived) sql += " AND archived = 0";
    if (withHistory) sql += " AND id IN (SELECT DISTINCT exercise_id FROM set_log)";
    sql += " ORDER BY name COLLATE NOCASE";
    return (await all<ExRow>(sql)).map(toEx);
  },
  async create(data: ExerciseCreate): Promise<Exercise> {
    const now = nowIso();
    const res = await run(
      "INSERT INTO exercise (client_token,name,muscle_group,equipment,icon,archived,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,0,?,?,1,0)",
      [uuid(), data.name, data.muscle_group ?? null, data.equipment ?? null, data.icon ?? null, now, now],
    );
    return (await this.get(res.lastInsertRowId))!;
  },
  async get(id: number): Promise<Exercise | null> {
    const r = await first<ExRow>("SELECT * FROM exercise WHERE id = ?", [id]);
    return r ? toEx(r) : null;
  },
  async update(id: number, data: Partial<ExerciseCreate>): Promise<void> {
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    for (const k of ["name", "muscle_group", "equipment", "icon"] as const) {
      if (k in data) {
        sets.push(`${k} = ?`);
        vals.push((data as Record<string, string | null>)[k] ?? null);
      }
    }
    if (!sets.length) return;
    vals.push(nowIso());
    await run(`UPDATE exercise SET ${sets.join(",")}, updated_at = ?, dirty = 1 WHERE id = ?`, [...vals, id]);
  },
  async remove(id: number): Promise<void> {
    const now = nowIso();
    // desvincula de treinos (marca treinos afetados como dirty) e soft-delete (nao apaga: preserva FK do historico)
    await run(
      "UPDATE workout SET dirty = 1, updated_at = ? WHERE id IN (SELECT workout_id FROM workout_exercise WHERE exercise_id = ?)",
      [now, id],
    );
    await run("DELETE FROM workout_exercise WHERE exercise_id = ?", [id]);
    await run("UPDATE exercise SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?", [now, id]);
  },
};

// ============ WORKOUT ============
interface WkRow {
  id: number;
  name: string;
  notes: string | null;
  archived: number;
  created_at: string;
}
const toWk = (r: WkRow): Workout => ({
  id: r.id,
  name: r.name,
  notes: r.notes,
  archived: b(r.archived),
  created_at: r.created_at,
});

async function workoutExercises(workoutId: number) {
  const rows = await all<{ id: number; exercise_id: number; position: number; target_sets: number }>(
    "SELECT id, exercise_id, position, target_sets FROM workout_exercise WHERE workout_id = ? ORDER BY position",
    [workoutId],
  );
  const out = [];
  for (const we of rows) {
    const ex = await exercisesRepo.get(we.exercise_id);
    out.push({
      id: we.id,
      exercise_id: we.exercise_id,
      position: we.position,
      target_sets: we.target_sets,
      exercise: ex ?? {
        id: we.exercise_id,
        name: "Exercício",
        muscle_group: null,
        equipment: null,
        icon: null,
        archived: false,
        created_at: nowIso(),
      },
    });
  }
  return out;
}

async function setWorkoutExercises(workoutId: number, items: WorkoutExerciseIn[]) {
  await run("DELETE FROM workout_exercise WHERE workout_id = ?", [workoutId]);
  let pos = 1;
  for (const it of items) {
    await run(
      "INSERT INTO workout_exercise (workout_id,exercise_id,position,target_sets) VALUES (?,?,?,?)",
      [workoutId, it.exercise_id, it.position ?? pos, it.target_sets ?? 6],
    );
    pos += 1;
  }
}

export const workoutsRepo = {
  async list(includeArchived = false): Promise<Workout[]> {
    let sql = "SELECT * FROM workout WHERE deleted = 0";
    if (!includeArchived) sql += " AND archived = 0";
    sql += " ORDER BY created_at DESC";
    return (await all<WkRow>(sql)).map(toWk);
  },
  async detail(id: number): Promise<WorkoutDetail | null> {
    const r = await first<WkRow>("SELECT * FROM workout WHERE id = ?", [id]);
    if (!r) return null;
    return { ...toWk(r), exercises: await workoutExercises(id) };
  },
  async create(data: WorkoutCreate): Promise<WorkoutDetail> {
    const now = nowIso();
    const res = await run(
      "INSERT INTO workout (client_token,name,notes,archived,created_at,updated_at,dirty,deleted) VALUES (?,?,?,0,?,?,1,0)",
      [uuid(), data.name, data.notes ?? null, now, now],
    );
    const id = res.lastInsertRowId;
    await setWorkoutExercises(id, data.exercises ?? []);
    return (await this.detail(id))!;
  },
  async update(id: number, name: string, exercises: WorkoutExerciseIn[]): Promise<void> {
    await run("UPDATE workout SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?", [name, nowIso(), id]);
    await setWorkoutExercises(id, exercises);
  },
  async setActive(id: number, active: boolean): Promise<void> {
    await run("UPDATE workout SET archived = ?, updated_at = ?, dirty = 1 WHERE id = ?", [active ? 0 : 1, nowIso(), id]);
  },
};

// ============ SESSION / SETS ============
interface SessRow {
  id: number;
  workout_id: number;
  performed_at: string;
  notes: string | null;
  client_token: string;
  created_at: string;
}
const toSess = (r: SessRow): WorkoutSession => ({
  id: r.id,
  workout_id: r.workout_id,
  performed_at: r.performed_at,
  notes: r.notes,
  client_token: r.client_token,
  created_at: r.created_at,
});

function sameLocalDay(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export const sessionsRepo = {
  async list(): Promise<WorkoutSession[]> {
    return (
      await all<SessRow>("SELECT * FROM workout_session WHERE deleted = 0 ORDER BY performed_at DESC")
    ).map(toSess);
  },
  async detail(id: number): Promise<SessionDetail | null> {
    const r = await first<SessRow>("SELECT * FROM workout_session WHERE id = ?", [id]);
    if (!r) return null;
    const sets = await all<{ id: number; exercise_id: number; set_number: number; reps: number | null; weight_kg: number | null }>(
      "SELECT id, exercise_id, set_number, reps, weight_kg FROM set_log WHERE session_id = ? ORDER BY exercise_id, set_number",
      [id],
    );
    return { ...toSess(r), set_logs: sets };
  },
  async todayForWorkout(workoutId: number): Promise<WorkoutSession | null> {
    const rows = await all<SessRow>(
      "SELECT * FROM workout_session WHERE workout_id = ? AND deleted = 0 ORDER BY performed_at DESC",
      [workoutId],
    );
    const found = rows.find((r) => sameLocalDay(r.performed_at));
    return found ? toSess(found) : null;
  },
  async create(workoutId: number): Promise<WorkoutSession> {
    const now = nowIso();
    const res = await run(
      "INSERT INTO workout_session (client_token,workout_id,performed_at,notes,created_at,updated_at,dirty,deleted) VALUES (?,?,?,NULL,?,?,1,0)",
      [uuid(), workoutId, now, now, now],
    );
    return (await this.detail(res.lastInsertRowId))!;
  },
  async setNotes(sessionId: number, notes: string | null): Promise<void> {
    await run("UPDATE workout_session SET notes = ?, updated_at = ?, dirty = 1 WHERE id = ?", [
      notes && notes.trim() ? notes : null,
      nowIso(),
      sessionId,
    ]);
  },
  async saveSets(sessionId: number, exerciseId: number, sets: SetLogIn[]): Promise<void> {
    await run("DELETE FROM set_log WHERE session_id = ? AND exercise_id = ?", [sessionId, exerciseId]);
    for (const s of sets) {
      await run(
        "INSERT INTO set_log (session_id,exercise_id,set_number,reps,weight_kg) VALUES (?,?,?,?,?)",
        [sessionId, exerciseId, s.set_number, s.reps ?? null, s.weight_kg ?? null],
      );
    }
    await run("INSERT OR IGNORE INTO dirty_sets (session_id,exercise_id) VALUES (?,?)", [sessionId, exerciseId]);
  },
  async history(exerciseId: number, start?: string, end?: string, limit = 50): Promise<HistorySession[]> {
    let sql =
      "SELECT DISTINCT ws.id, ws.workout_id, ws.performed_at FROM workout_session ws " +
      "JOIN set_log sl ON sl.session_id = ws.id WHERE sl.exercise_id = ? AND ws.deleted = 0";
    const params: (string | number)[] = [exerciseId];
    if (start) {
      sql += " AND ws.performed_at >= ?";
      params.push(start);
    }
    if (end) {
      sql += " AND ws.performed_at <= ?";
      params.push(end);
    }
    sql += " ORDER BY ws.performed_at DESC LIMIT ?";
    params.push(limit);
    const sessions = await all<{ id: number; workout_id: number; performed_at: string }>(sql, params);
    const out: HistorySession[] = [];
    for (const s of sessions) {
      const sets = await all<{ set_number: number; reps: number | null; weight_kg: number | null }>(
        "SELECT set_number, reps, weight_kg FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY set_number",
        [s.id, exerciseId],
      );
      out.push({ session_id: s.id, workout_id: s.workout_id, performed_at: s.performed_at, sets });
    }
    return out;
  },
};

// ============ PROFILE ============
export const profileRepo = {
  async get(): Promise<Profile> {
    let r = await first<Profile & { dirty: number }>("SELECT * FROM user_profile WHERE id = 1");
    if (!r) {
      await run("INSERT INTO user_profile (id,updated_at,dirty) VALUES (1,?,0)", [nowIso()]);
      r = await first<Profile & { dirty: number }>("SELECT * FROM user_profile WHERE id = 1");
    }
    const p = r!;
    return {
      id: 1,
      height_cm: p.height_cm,
      sex: p.sex,
      birth_date: p.birth_date,
      goals: p.goals,
      objectives: p.objectives,
      notes: p.notes,
      updated_at: p.updated_at,
    };
  },
  async update(data: ProfileUpdate): Promise<Profile> {
    await this.get(); // garante existencia
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];
    for (const k of ["height_cm", "sex", "birth_date", "goals", "objectives", "notes"] as const) {
      if (k in data) {
        sets.push(`${k} = ?`);
        vals.push((data as Record<string, string | number | null>)[k] ?? null);
      }
    }
    vals.push(nowIso());
    await run(`UPDATE user_profile SET ${sets.length ? sets.join(",") + "," : ""} updated_at = ?, dirty = 1 WHERE id = 1`, vals);
    return this.get();
  },
};

// ============ MEASUREMENT ============
interface MRow extends Measurement {}
export const measurementsRepo = {
  async list(): Promise<Measurement[]> {
    return all<MRow>(
      "SELECT id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, body_water_pct, bmr_kcal, notes FROM body_measurement WHERE deleted = 0 ORDER BY measured_on DESC",
    );
  },
  async create(data: MeasurementCreate): Promise<Measurement> {
    const now = nowIso();
    const res = await run(
      "INSERT INTO body_measurement (client_token,measured_on,weight_kg,body_fat_pct,muscle_mass_kg,visceral_fat,body_water_pct,bmr_kcal,notes,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0)",
      [
        uuid(),
        data.measured_on ?? now,
        data.weight_kg ?? null,
        data.body_fat_pct ?? null,
        data.muscle_mass_kg ?? null,
        data.visceral_fat ?? null,
        data.body_water_pct ?? null,
        data.bmr_kcal ?? null,
        data.notes ?? null,
        now,
        now,
      ],
    );
    return (await first<MRow>(
      "SELECT id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat, body_water_pct, bmr_kcal, notes FROM body_measurement WHERE id = ?",
      [res.lastInsertRowId],
    ))!;
  },
  async remove(id: number): Promise<void> {
    const r = await first<{ server_id: number | null }>("SELECT server_id FROM body_measurement WHERE id = ?", [id]);
    if (r && r.server_id == null) {
      await run("DELETE FROM body_measurement WHERE id = ?", [id]);
    } else {
      await run("UPDATE body_measurement SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ?", [nowIso(), id]);
    }
  },
};

/** total de alteracoes locais pendentes de sincronizacao */
export async function pendingCount(): Promise<number> {
  const q = await first<{ n: number }>(
    `SELECT
      (SELECT COUNT(*) FROM exercise WHERE dirty = 1) +
      (SELECT COUNT(*) FROM workout WHERE dirty = 1) +
      (SELECT COUNT(*) FROM workout_session WHERE dirty = 1) +
      (SELECT COUNT(*) FROM dirty_sets) +
      (SELECT COUNT(*) FROM user_profile WHERE dirty = 1) +
      (SELECT COUNT(*) FROM body_measurement WHERE dirty = 1) AS n`,
  );
  return q?.n ?? 0;
}
