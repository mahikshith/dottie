/**
 * Dottie — SQLite Database Client
 *
 * Singleton wrapper around expo-sqlite providing:
 *   - Lazy database opening (first call opens, subsequent calls reuse)
 *   - Promise-based async API on top of the sync expo-sqlite v15 surface
 *   - Transaction helper with auto-rollback on error
 *   - Encryption hook (INACTIVE for MVP — wire is ready, key derivation off)
 *   - Diagnostic counters for tracing slow queries during development
 *
 * ─── OFFLINE-FIRST DESIGN ───────────────────────────────────────────
 *
 *  Everything in Dottie's data plane lives here. Network sync (Supabase,
 *  Phase Weather, community) is a SEPARATE concern handled by a future
 *  sync layer that reads/writes through these same repositories.
 *
 *  This means:
 *    - The app works perfectly with airplane mode on
 *    - Engines never await network — they await this client
 *    - Encryption-at-rest can be flipped on without touching engines
 *
 * ─── ENCRYPTION READINESS ───────────────────────────────────────────
 *
 *  SQLCipher isn't bundled in stock expo-sqlite, so for MVP we ship
 *  plain SQLite + a clear hook (`getEncryptionKey()`) where the future
 *  key will be derived from biometric-protected secure storage. To turn
 *  encryption on later we'll:
 *    1. Swap to op-sqlcipher-storage (or similar)
 *    2. Implement getEncryptionKey() to pull from expo-secure-store
 *    3. Pass the key via PRAGMA key in openDatabase()
 *
 *  ZERO changes needed to repositories, stores, or engines.
 *
 * ─── USAGE ──────────────────────────────────────────────────────────
 *
 *    import { getDatabase, runMigrations } from '@/database/client';
 *
 *    // App startup
 *    const db = await getDatabase();
 *    await runMigrations(db);
 *
 *    // Repositories
 *    const rows = await db.getAllAsync<UserRow>('SELECT * FROM users');
 *    await db.runAsync('INSERT INTO users (id) VALUES (?)', userId);
 */

import * as SQLite from 'expo-sqlite';

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** Database filename — lives in app's document directory. */
export const DATABASE_NAME = 'dottie.db';

/**
 * Schema version. Bumped when migrations.ts adds a new step.
 * Migration runner compares this to user_version PRAGMA and applies
 * any missing migrations in order.
 *
 * ─── VERSION HISTORY ────────────────────────────────────────────────
 *
 *   v1  Initial schema (chunks 1-7): users, cycles, symptoms, check-ins,
 *       gamification, content, community
 *   v2  Sisterhood Circle (chunk 8): circles, members, shadow profiles,
 *       care nudges, phase sync events, transfer codes
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Whether encryption is currently active. KEEP FALSE FOR MVP.
 * Flipping this to true REQUIRES:
 *   - getEncryptionKey() returning a real key
 *   - A SQLCipher-compatible adapter
 *   - A migration plan for existing plaintext databases
 *
 * Leaving as a constant (not env-var) so it can't be accidentally
 * enabled before all three above are in place.
 */
export const ENCRYPTION_ACTIVE = false;

// ─── INTERNAL STATE ──────────────────────────────────────────────────

let cachedDb: SQLite.SQLiteDatabase | null = null;
let openingPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Diagnostic counters — visible via getDbStats() for performance debugging. */
const stats = {
  queries: 0,
  writes: 0,
  transactions: 0,
  slowQueries: 0, // > 50ms
};

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Get the singleton database handle, opening it on first call.
 *
 * Safe to call from multiple places concurrently — returns the same
 * Promise during opening, the cached instance after.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (cachedDb) return cachedDb;
  if (openingPromise) return openingPromise;

  openingPromise = openDatabase()
    .then(db => {
      cachedDb = db;
      openingPromise = null;
      return db;
    })
    .catch(err => {
      openingPromise = null;
      throw err;
    });

  return openingPromise;
}

/**
 * Close the database. Mostly used by tests + the "delete all my data" flow.
 * In normal app lifecycle the OS cleans this up when the process exits.
 */
export async function closeDatabase(): Promise<void> {
  if (cachedDb) {
    await cachedDb.closeAsync();
    cachedDb = null;
  }
}

/**
 * Wipe the database file entirely. DESTRUCTIVE — used only by:
 *   - The "Delete all my data" privacy action
 *   - Test setUp / tearDown
 *
 * After calling this, the next getDatabase() will create a fresh DB.
 */
export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
}

/**
 * Run a function inside a transaction with automatic rollback on error.
 *
 * Repositories should use this for any multi-statement write so we don't
 * leave the DB in a partial state if something throws mid-operation.
 */
export async function withTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  stats.transactions++;

  await db.execAsync('BEGIN TRANSACTION');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT');
    return result;
  } catch (err) {
    try {
      await db.execAsync('ROLLBACK');
    } catch {
      // Rollback failure is non-fatal — original error matters more.
    }
    throw err;
  }
}

/**
 * Read the current schema version from the database.
 * Used by the migration runner to know what's already been applied.
 */
export async function readSchemaVersion(
  db: SQLite.SQLiteDatabase
): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  return row?.user_version ?? 0;
}

/**
 * Write the schema version. Called by the migration runner after
 * each migration step completes successfully.
 */
export async function writeSchemaVersion(
  db: SQLite.SQLiteDatabase,
  version: number
): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

/**
 * Diagnostic snapshot of database activity since app start.
 * Visible in dev menu for performance debugging.
 */
export function getDbStats(): DbStats {
  return { ...stats };
}

/**
 * Reset diagnostic counters (does not affect data).
 */
export function resetDbStats(): void {
  stats.queries = 0;
  stats.writes = 0;
  stats.transactions = 0;
  stats.slowQueries = 0;
}

/**
 * Increment query counter — called by repository helpers when they
 * issue a read query. Tracks slow queries for debugging.
 */
export function trackQuery(durationMs: number): void {
  stats.queries++;
  if (durationMs > 50) stats.slowQueries++;
}

/**
 * Increment write counter — called by repository helpers on writes.
 */
export function trackWrite(): void {
  stats.writes++;
}

// ─── INTERNAL: DATABASE OPENING ──────────────────────────────────────

/**
 * Actually open the database and configure PRAGMAs.
 * Called once at app startup via getDatabase().
 */
async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // If encryption is ever activated, the key MUST be applied before
  // any other PRAGMA or query — that's why this lives at the top.
  if (ENCRYPTION_ACTIVE) {
    const key = await getEncryptionKey();
    if (key) {
      // Note: this PRAGMA only works on SQLCipher builds.
      // Stock expo-sqlite ignores it silently.
      await db.execAsync(`PRAGMA key = '${escapeKey(key)}'`);
    }
  }

  // Performance + safety PRAGMAs (safe defaults for a single-user mobile DB)
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -16000;
  `);

  return db;
}

/**
 * ENCRYPTION HOOK — currently returns null (encryption off).
 *
 * When we're ready to flip encryption on:
 *   1. Generate a 32-byte random key on first run, store in expo-secure-store
 *      with `requireAuthentication: true` (biometric or PIN)
 *   2. Return the key from here
 *   3. Set ENCRYPTION_ACTIVE = true and ship a SQLCipher build
 *
 * For MVP, this stays a no-op so the wiring exists but encryption is off.
 */
async function getEncryptionKey(): Promise<string | null> {
  if (!ENCRYPTION_ACTIVE) return null;

  // Future implementation:
  // const key = await SecureStore.getItemAsync('dottie_db_key', {
  //   requireAuthentication: true,
  // });
  // if (key) return key;
  //
  // const newKey = generateRandom32Bytes();
  // await SecureStore.setItemAsync('dottie_db_key', newKey, {
  //   requireAuthentication: true,
  // });
  // return newKey;

  return null;
}

/**
 * Escape single quotes in a key value before interpolating into
 * a PRAGMA key = '...' statement.
 */
function escapeKey(key: string): string {
  return key.replace(/'/g, "''");
}

// ─── TYPES ───────────────────────────────────────────────────────────

export interface DbStats {
  queries: number;
  writes: number;
  transactions: number;
  slowQueries: number;
}

/**
 * Re-export the SQLiteDatabase type so repositories can type their
 * parameters without importing expo-sqlite directly. Keeps the
 * dependency surface narrow if we ever swap implementations.
 */
export type Database = SQLite.SQLiteDatabase;