export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  icon: string | null;
  archived: boolean;
  created_at: string;
}

export interface ExerciseCreate {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  icon?: string | null;
  client_token?: string;
}

export interface Workout {
  id: number;
  name: string;
  notes: string | null;
  archived: boolean;
  created_at: string;
}

export interface WorkoutExercise {
  id: number;
  exercise_id: number;
  position: number;
  target_sets: number;
  exercise: Exercise;
}

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExercise[];
}

export interface WorkoutExerciseIn {
  exercise_id: number;
  position?: number;
  target_sets?: number;
}

export interface WorkoutCreate {
  name: string;
  notes?: string | null;
  exercises: WorkoutExerciseIn[];
  client_token?: string;
}

export interface WorkoutSession {
  id: number; // negativo = sessao local (ainda nao sincronizada)
  workout_id: number;
  performed_at: string;
  notes: string | null;
  client_token: string | null;
  created_at: string;
}

export interface SetLog {
  id: number;
  exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

export interface SessionDetail extends WorkoutSession {
  set_logs: SetLog[];
}

export interface LastSet {
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
}

export interface LastResponse {
  performed_at: string | null;
  sets: LastSet[];
}

export interface HistorySession {
  session_id: number;
  workout_id: number;
  performed_at: string;
  sets: LastSet[];
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  start?: string; // ISO
  end?: string; // ISO
}

export interface SetLogIn {
  set_number: number;
  reps?: number | null;
  weight_kg?: number | null;
}

export interface Profile {
  id: number;
  height_cm: number | null;
  sex: string | null;
  birth_date: string | null;
  goals: string | null;
  objectives: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ProfileUpdate {
  height_cm?: number | null;
  sex?: string | null;
  birth_date?: string | null;
  goals?: string | null;
  objectives?: string | null;
  notes?: string | null;
}

export interface Measurement {
  id: number;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  visceral_fat: number | null;
  body_water_pct: number | null;
  bmr_kcal: number | null;
  notes: string | null;
}

export interface MeasurementCreate {
  measured_on?: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  visceral_fat?: number | null;
  body_water_pct?: number | null;
  bmr_kcal?: number | null;
  notes?: string | null;
  client_token?: string;
}
