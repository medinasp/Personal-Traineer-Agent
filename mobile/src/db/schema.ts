/**
 * Schema local (SQLite). Cada entidade sincronizavel tem:
 *  - id            INTEGER PK local (o que o app usa; mantem tipagem `number`)
 *  - client_token  TEXT UUID estavel (idempotencia no backend)
 *  - server_id     INTEGER id do backend (null ate sincronizar)
 *  - dirty         0/1 precisa subir
 *  - deleted       0/1 soft-delete pendente de sync (quando aplicavel)
 *  - updated_at    ISO
 * Relacionamentos usam o id LOCAL. O sync mapeia local<->server.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS exercise (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_token TEXT UNIQUE NOT NULL,
  server_id INTEGER,
  name TEXT NOT NULL,
  muscle_group TEXT,
  equipment TEXT,
  icon TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_token TEXT UNIQUE NOT NULL,
  server_id INTEGER,
  name TEXT NOT NULL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_exercise (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercise(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 6
);

CREATE TABLE IF NOT EXISTS workout_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_token TEXT UNIQUE NOT NULL,
  server_id INTEGER,
  workout_id INTEGER NOT NULL REFERENCES workout(id),
  performed_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS set_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercise(id),
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg REAL
);

-- pares (sessao, exercicio) cujas series mudaram e precisam subir (PUT substitui tudo)
CREATE TABLE IF NOT EXISTS dirty_sets (
  session_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  PRIMARY KEY (session_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  height_cm INTEGER,
  sex TEXT,
  birth_date TEXT,
  goals TEXT,
  objectives TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS body_measurement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_token TEXT UNIQUE NOT NULL,
  server_id INTEGER,
  measured_on TEXT NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  muscle_mass_kg REAL,
  visceral_fat REAL,
  body_water_pct REAL,
  bmr_kcal INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Conversa com o Coach: local-only (nao sincroniza; o coach roda no proprio celular).
CREATE TABLE IF NOT EXISTS chat_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,            -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_we_workout ON workout_exercise(workout_id);
CREATE INDEX IF NOT EXISTS ix_sl_session ON set_log(session_id);
CREATE INDEX IF NOT EXISTS ix_sess_workout ON workout_session(workout_id);
`;
