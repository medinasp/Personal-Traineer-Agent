import * as SQLite from "expo-sqlite";

import { SCHEMA } from "./schema";

let _db: SQLite.SQLiteDatabase | null = null;
let _init: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("meutreino.db");
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  await db.execAsync(SCHEMA);
  _db = db;
  return db;
}

/** Banco local (SQLite) — fonte da verdade do app. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return Promise.resolve(_db);
  if (!_init) _init = openAndMigrate();
  return _init;
}

export function uuid(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---- helpers tipados ----
export async function run(sql: string, params: SQLite.SQLiteBindParams = []): Promise<SQLite.SQLiteRunResult> {
  const db = await getDb();
  return db.runAsync(sql, params);
}
export async function all<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T[]> {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}
export async function first<T>(sql: string, params: SQLite.SQLiteBindParams = []): Promise<T | null> {
  const db = await getDb();
  return db.getFirstAsync<T>(sql, params);
}
