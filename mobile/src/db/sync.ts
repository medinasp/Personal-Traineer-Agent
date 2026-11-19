/** Sincronizacao: sobe o que mudou localmente pro backend e importa os dados do servidor na 1a vez. */
import { exercisesApi } from "../api/exercises";
import { profileApi } from "../api/profile";
import { sessionsApi } from "../api/sessions";
import { workoutsApi } from "../api/workouts";
import { API_URL } from "../config";
import { all, first, getDb, nowIso, run, uuid } from "./index";
import { pendingCount } from "./repos";

const HEALTH = API_URL.replace(/\/api\/v1\/?$/, "") + "/health";

// ---- pub/sub p/ UI ----
const listeners = new Set<() => void>();
export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  listeners.forEach((f) => f());
}
export function emitChange() {
  emit();
}
export { pendingCount };

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

async function metaGet(key: string): Promise<string | null> {
  const r = await first<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return r?.value ?? null;
}
async function metaSet(key: string, value: string): Promise<void> {
  await run("INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = ?", [key, value, value]);
}
async function serverId(table: string, localId: number): Promise<number | null> {
  const r = await first<{ server_id: number | null }>(`SELECT server_id FROM ${table} WHERE id = ?`, [localId]);
  return r?.server_id ?? null;
}

// ======================= IMPORT (1a vez) =======================
async function importIfNeeded(): Promise<void> {
  if ((await metaGet("imported")) === "1") return;
  const exCount = await first<{ n: number }>("SELECT COUNT(*) n FROM exercise");
  const wkCount = await first<{ n: number }>("SELECT COUNT(*) n FROM workout");
  const seCount = await first<{ n: number }>("SELECT COUNT(*) n FROM workout_session");
  if ((exCount?.n ?? 0) + (wkCount?.n ?? 0) + (seCount?.n ?? 0) > 0) {
    // ja ha dados locais (usuario comecou offline) -> nao importa pra nao duplicar
    await metaSet("imported", "1");
    return;
  }

  // 1) busca TUDO do servidor primeiro (rede). Se qualquer chamada falhar, aborta
  //    sem tocar no banco -> "imported" nao e marcado e tenta de novo na proxima sync.
  const exs = await exercisesApi.list(true, false);
  const wks = await workoutsApi.list(true);
  const wkDetails = new Map<number, Awaited<ReturnType<typeof workoutsApi.detail>>>();
  for (const w of wks) wkDetails.set(w.id, await workoutsApi.detail(w.id));
  const sessions = await sessionsApi.list();
  const sessDetails = new Map<number, Awaited<ReturnType<typeof sessionsApi.detail>>>();
  for (const s of sessions) sessDetails.set(s.id, await sessionsApi.detail(s.id));
  const prof = await profileApi.get();
  const meds = await profileApi.measurements();

  // 2) grava tudo numa unica transacao (tudo-ou-nada). Se cair no meio, rollback -> banco fica vazio e reimporta depois.
  const db = await getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    const exMap = new Map<number, number>(); // serverExId -> localExId
    const wkMap = new Map<number, number>();

    for (const e of exs) {
      const res = await run(
        "INSERT INTO exercise (client_token,server_id,name,muscle_group,equipment,icon,archived,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,?,?,?,?,0,0)",
        [uuid(), e.id, e.name, e.muscle_group, e.equipment ?? null, e.icon, e.archived ? 1 : 0, e.created_at, now],
      );
      exMap.set(e.id, res.lastInsertRowId);
    }

    for (const w of wks) {
      const res = await run(
        "INSERT INTO workout (client_token,server_id,name,notes,archived,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,?,?,0,0)",
        [uuid(), w.id, w.name, w.notes, w.archived ? 1 : 0, w.created_at, now],
      );
      const localWk = res.lastInsertRowId;
      wkMap.set(w.id, localWk);
      for (const we of wkDetails.get(w.id)?.exercises ?? []) {
        const localEx = exMap.get(we.exercise_id);
        if (localEx == null) continue;
        await run("INSERT INTO workout_exercise (workout_id,exercise_id,position,target_sets) VALUES (?,?,?,?)", [
          localWk,
          localEx,
          we.position,
          we.target_sets,
        ]);
      }
    }

    for (const s of sessions) {
      const localWk = wkMap.get(s.workout_id);
      if (localWk == null) continue;
      const res = await run(
        "INSERT INTO workout_session (client_token,server_id,workout_id,performed_at,notes,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,?,?,0,0)",
        [s.client_token ?? uuid(), s.id, localWk, s.performed_at, s.notes, s.created_at, now],
      );
      const localSess = res.lastInsertRowId;
      for (const sl of sessDetails.get(s.id)?.set_logs ?? []) {
        const localEx = exMap.get(sl.exercise_id);
        if (localEx == null) continue;
        await run("INSERT INTO set_log (session_id,exercise_id,set_number,reps,weight_kg) VALUES (?,?,?,?,?)", [
          localSess,
          localEx,
          sl.set_number,
          sl.reps,
          sl.weight_kg,
        ]);
      }
    }

    await run(
      "INSERT INTO user_profile (id,height_cm,sex,birth_date,goals,objectives,notes,updated_at,dirty) VALUES (1,?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET height_cm=excluded.height_cm, sex=excluded.sex, birth_date=excluded.birth_date, goals=excluded.goals, objectives=excluded.objectives, notes=excluded.notes, updated_at=excluded.updated_at, dirty=0",
      [prof.height_cm, prof.sex, prof.birth_date, prof.goals, prof.objectives, prof.notes, prof.updated_at],
    );

    for (const m of meds) {
      await run(
        "INSERT INTO body_measurement (client_token,server_id,measured_on,weight_kg,body_fat_pct,muscle_mass_kg,visceral_fat,body_water_pct,bmr_kcal,notes,created_at,updated_at,dirty,deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0)",
        [uuid(), m.id, m.measured_on, m.weight_kg, m.body_fat_pct, m.muscle_mass_kg, m.visceral_fat, m.body_water_pct, m.bmr_kcal, m.notes, m.measured_on, now],
      );
    }

    await metaSet("imported", "1");
  });
}

// ======================= PUSH =======================
async function pushAll(): Promise<void> {
  // 1) exercicios
  for (const e of await all<{ id: number; server_id: number | null; name: string; muscle_group: string | null; equipment: string | null; icon: string | null; archived: number; client_token: string; deleted: number }>(
    "SELECT * FROM exercise WHERE dirty = 1",
  )) {
    if (e.deleted) {
      if (e.server_id != null) {
        try {
          await exercisesApi.remove(e.server_id); // pode falhar se tiver historico no server (RESTRICT): tudo bem
        } catch {
          /* ignora */
        }
      }
      await run("UPDATE exercise SET dirty = 0 WHERE id = ?", [e.id]); // mantem soft-deleted local
    } else if (e.server_id == null) {
      const real = await exercisesApi.create({
        name: e.name,
        muscle_group: e.muscle_group,
        equipment: e.equipment,
        icon: e.icon,
        client_token: e.client_token,
      });
      await run("UPDATE exercise SET server_id = ?, dirty = 0 WHERE id = ?", [real.id, e.id]);
    } else {
      await exercisesApi.update(e.server_id, {
        name: e.name,
        muscle_group: e.muscle_group,
        equipment: e.equipment,
        icon: e.icon,
      });
      await run("UPDATE exercise SET dirty = 0 WHERE id = ?", [e.id]);
    }
  }

  // 2) treinos
  for (const w of await all<{ id: number; server_id: number | null; name: string; archived: number; client_token: string; deleted: number }>(
    "SELECT * FROM workout WHERE dirty = 1",
  )) {
    const links = await all<{ exercise_id: number; target_sets: number }>(
      "SELECT exercise_id, target_sets FROM workout_exercise WHERE workout_id = ? ORDER BY position",
      [w.id],
    );
    const exercises = [];
    let missing = false;
    for (const l of links) {
      const sid = await serverId("exercise", l.exercise_id);
      if (sid == null) {
        missing = true;
        break;
      }
      exercises.push({ exercise_id: sid, target_sets: l.target_sets });
    }
    if (missing) continue; // exercicio ainda nao subiu; tenta na proxima rodada
    if (w.server_id == null) {
      const real = await workoutsApi.create({ name: w.name, exercises, client_token: w.client_token });
      await run("UPDATE workout SET server_id = ?, dirty = 0 WHERE id = ?", [real.id, w.id]);
      if (w.archived) await workoutsApi.update(real.id, { archived: true });
    } else {
      await workoutsApi.update(w.server_id, { name: w.name, archived: !!w.archived });
      await workoutsApi.setExercises(w.server_id, exercises);
      await run("UPDATE workout SET dirty = 0 WHERE id = ?", [w.id]);
    }
  }

  // 3) sessoes
  for (const s of await all<{ id: number; server_id: number | null; workout_id: number; performed_at: string; client_token: string }>(
    "SELECT * FROM workout_session WHERE dirty = 1 AND deleted = 0",
  )) {
    if (s.server_id != null) {
      await run("UPDATE workout_session SET dirty = 0 WHERE id = ?", [s.id]);
      continue;
    }
    const wkSid = await serverId("workout", s.workout_id);
    if (wkSid == null) continue;
    const real = await sessionsApi.create({ workout_id: wkSid, client_token: s.client_token, performed_at: s.performed_at });
    await run("UPDATE workout_session SET server_id = ?, dirty = 0 WHERE id = ?", [real.id, s.id]);
  }

  // 4) series alteradas (PUT substitui o par sessao+exercicio)
  for (const d of await all<{ session_id: number; exercise_id: number }>("SELECT * FROM dirty_sets")) {
    const sessSid = await serverId("workout_session", d.session_id);
    const exSid = await serverId("exercise", d.exercise_id);
    if (sessSid == null || exSid == null) continue;
    const sets = await all<{ set_number: number; reps: number | null; weight_kg: number | null }>(
      "SELECT set_number, reps, weight_kg FROM set_log WHERE session_id = ? AND exercise_id = ? ORDER BY set_number",
      [d.session_id, d.exercise_id],
    );
    await sessionsApi.saveSets(sessSid, exSid, sets);
    await run("DELETE FROM dirty_sets WHERE session_id = ? AND exercise_id = ?", [d.session_id, d.exercise_id]);
  }

  // 5) perfil
  const prof = await first<{ height_cm: number | null; sex: string | null; birth_date: string | null; goals: string | null; objectives: string | null; notes: string | null; dirty: number }>(
    "SELECT * FROM user_profile WHERE id = 1 AND dirty = 1",
  );
  if (prof) {
    await profileApi.update({
      height_cm: prof.height_cm,
      sex: prof.sex,
      birth_date: prof.birth_date,
      goals: prof.goals,
      objectives: prof.objectives,
      notes: prof.notes,
    });
    await run("UPDATE user_profile SET dirty = 0 WHERE id = 1", []);
  }

  // 6) medidas
  for (const m of await all<{ id: number; server_id: number | null; client_token: string; deleted: number; measured_on: string; weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null; visceral_fat: number | null; body_water_pct: number | null; bmr_kcal: number | null; notes: string | null }>(
    "SELECT * FROM body_measurement WHERE dirty = 1",
  )) {
    if (m.deleted) {
      if (m.server_id != null) {
        try {
          await profileApi.deleteMeasurement(m.server_id);
        } catch {
          /* ja removida ou indisponivel: segue */
        }
      }
      await run("DELETE FROM body_measurement WHERE id = ?", [m.id]);
    } else if (m.server_id == null) {
      const real = await profileApi.createMeasurement({
        measured_on: m.measured_on,
        weight_kg: m.weight_kg,
        body_fat_pct: m.body_fat_pct,
        muscle_mass_kg: m.muscle_mass_kg,
        visceral_fat: m.visceral_fat,
        body_water_pct: m.body_water_pct,
        bmr_kcal: m.bmr_kcal,
        notes: m.notes,
        client_token: m.client_token,
      });
      await run("UPDATE body_measurement SET server_id = ?, dirty = 0 WHERE id = ?", [real.id, m.id]);
    } else {
      await run("UPDATE body_measurement SET dirty = 0 WHERE id = ?", [m.id]);
    }
  }
}

let running = false;
/** Sincroniza agora (import 1a vez + push). Silencioso se o backend nao estiver acessivel. */
export async function syncNow(): Promise<{ ok: boolean; pending: number }> {
  if (running) return { ok: false, pending: await pendingCount() };
  running = true;
  try {
    if (!(await backendUp())) return { ok: false, pending: await pendingCount() };
    await importIfNeeded();
    await pushAll();
    return { ok: true, pending: await pendingCount() };
  } catch {
    return { ok: false, pending: await pendingCount() };
  } finally {
    running = false;
    emit();
  }
}
