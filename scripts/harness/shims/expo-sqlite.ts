/**
 * Dottie — expo-sqlite shim (harness only)
 *
 * Lets the REAL repositories run in Node against `node:sqlite`, so the
 * integration harness exercises the actual SQL, the actual migrations and the
 * actual repository logic instead of a hand-written fake.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Every harness before this one tested pure functions. That is a real safety
 *  net, but it could never have caught the device-test-7 freeze, which lived in
 *  `cycle.repo.ts` between a SQL query and a date helper — code no pure test
 *  ever touched. The bugs that reach the owner are in the wiring, so the
 *  harness has to run the wiring.
 *
 *  It implements only the surface the repositories actually use:
 *  `openDatabaseAsync`, `execAsync`, `runAsync`, `getFirstAsync`,
 *  `getAllAsync`, `closeAsync`. If a repository starts using something else,
 *  this file fails loudly rather than silently returning undefined.
 *
 * ⚠️ HARNESS ONLY. Never imported by the app — it is wired in exclusively via
 *    `scripts/harness/tsconfig.harness.json` paths.
 */

import { DatabaseSync } from 'node:sqlite';

export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}

/** Named (`$x`) or positional (`?`) params, matching expo-sqlite's overloads. */
type Param = string | number | null | Uint8Array | boolean;

function normalise(params: Param[]): (string | number | null | Uint8Array)[] {
  // node:sqlite has no boolean binding; expo-sqlite coerces, so we do too.
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

export class SQLiteDatabase {
  private readonly db: DatabaseSync;
  /** Every statement executed, for the harness's SQL trace. */
  static trace: { sql: string; ms: number }[] = [];

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // expo-sqlite enables foreign keys by default; match it so constraint
    // violations surface here exactly as they would on device.
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  private record(sql: string, started: number): void {
    SQLiteDatabase.trace.push({ sql: sql.trim().split('\n')[0]!.slice(0, 120), ms: Date.now() - started });
  }

  async execAsync(sql: string): Promise<void> {
    const t = Date.now();
    this.db.exec(sql);
    this.record(sql, t);
  }

  async runAsync(sql: string, ...params: Param[]): Promise<SQLiteRunResult> {
    const t = Date.now();
    const stmt = this.db.prepare(sql);
    const r = stmt.run(...(normalise(flatten(params)) as never[]));
    this.record(sql, t);
    return {
      lastInsertRowId: Number(r.lastInsertRowid ?? 0),
      changes: Number(r.changes ?? 0),
    };
  }

  async getFirstAsync<T>(sql: string, ...params: Param[]): Promise<T | null> {
    const t = Date.now();
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...(normalise(flatten(params)) as never[]));
    this.record(sql, t);
    return (row as T) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: Param[]): Promise<T[]> {
    const t = Date.now();
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...(normalise(flatten(params)) as never[]));
    this.record(sql, t);
    return rows as T[];
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

/**
 * expo-sqlite accepts both `run(sql, a, b)` and `run(sql, [a, b])`. The
 * repositories use both forms, so flatten one level.
 */
function flatten(params: Param[]): Param[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0] as Param[];
  return params;
}

const open = new Map<string, SQLiteDatabase>();

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  // In-memory unless the harness asks for a file, so runs never leak state.
  const path = process.env.DOTTIE_HARNESS_DB ?? ':memory:';
  const key = `${name}::${path}`;
  const existing = open.get(key);
  if (existing) return existing;
  const db = new SQLiteDatabase(path);
  open.set(key, db);
  return db;
}

export async function deleteDatabaseAsync(name: string): Promise<void> {
  for (const [k, db] of open) {
    if (k.startsWith(`${name}::`)) {
      await db.closeAsync();
      open.delete(k);
    }
  }
}

/** Reset between harness runs. */
export function __resetShim(): void {
  open.clear();
  SQLiteDatabase.trace = [];
}
