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
import {
  getOrCreateDbKey,
  isDbMigrated,
  markDbMigrated,
} from '../security/keychain';

// ─── CONSTANTS ───────────────────────────────────────────────────────

/**
 * Database filename. The ENCRYPTED (SQLCipher) DB uses a NEW name so we never
 * try to open a legacy plaintext file with a key (SQLCipher can't) — the
 * one-time migration exports the old plaintext DB into this new encrypted file
 * and then deletes the plaintext one. See migratePlaintextDbIfNeeded().
 */
export const DATABASE_NAME = 'dottie-enc.db';

/** The pre-B2 plaintext database filename (migrated from, then deleted). */
const LEGACY_PLAINTEXT_DB = 'dottie.db';

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
 * Whether DB encryption is active (B2 Step 2 — now ON). All three
 * prerequisites are in place:
 *   - getEncryptionKey() returns the hardware-held SQLCipher key (keychain.ts)
 *   - the native build links SQLCipher (`useSQLCipher: true` in app.json)
 *   - migratePlaintextDbIfNeeded() migrates existing plaintext DBs
 *
 * ⚠️ This constant and the app.json `useSQLCipher` flag MUST ship together —
 * turning this on without the SQLCipher build would make `PRAGMA key` a silent
 * no-op (fake encryption). Device-critical; verify on a real build.
 */
export const ENCRYPTION_ACTIVE = true;

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
  const key = ENCRYPTION_ACTIVE ? await getEncryptionKey() : null;

  // One-time migration: if a pre-B2 plaintext DB exists, export it into the
  // new encrypted file before we open the encrypted DB. Best-effort and
  // non-destructive — never deletes the plaintext copy unless the encrypted
  // export succeeded (see the function for the full safety contract).
  if (key) {
    await migratePlaintextDbIfNeeded(key);
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // The key MUST be applied before any other PRAGMA or query — SQLCipher needs
  // it to decrypt the page cache. With useSQLCipher enabled in the native
  // build this PRAGMA truly encrypts; without it, it would be a silent no-op
  // (which is why ENCRYPTION_ACTIVE and the app.json plugin flag must ship
  // together).
  if (key) {
    await db.execAsync(`PRAGMA key = '${escapeKey(key)}'`);
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
 * One-time migration of the legacy PLAINTEXT database into the SQLCipher
 * encrypted database (B2 Step 2). Plaintext SQLite files can't be opened with
 * a key, so we copy the data across with SQLCipher's `sqlcipher_export()`.
 *
 * ─── SAFETY CONTRACT (never lose or corrupt data) ───────────────────
 *
 *  - Guarded by a secure-store flag so it runs at most once.
 *  - On a FRESH install (no real plaintext data) it just marks itself done.
 *  - It writes into a NEW file (DATABASE_NAME); the plaintext DB is deleted
 *    ONLY after a successful export.
 *  - Any failure is swallowed: the flag is NOT set (so it retries next boot)
 *    and the plaintext DB is left untouched. Worst case the app opens a fresh
 *    encrypted DB while the real data waits safely in the plaintext file for a
 *    later retry — data is never destroyed, only (temporarily) not shown.
 *  - Device-critical + unverifiable in CI. A clean reinstall skips migration
 *    entirely (fresh encrypted DB), which is the safe way to test.
 */
async function migratePlaintextDbIfNeeded(key: string): Promise<void> {
  try {
    if (await isDbMigrated()) return;

    // Open the legacy plaintext DB (no key). If it doesn't exist this creates
    // an empty one, which we detect via user_version === 0 and clean up.
    const legacy = await SQLite.openDatabaseAsync(LEGACY_PLAINTEXT_DB);
    let hasData = false;
    try {
      const row = await legacy.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      hasData = (row?.user_version ?? 0) > 0;

      if (hasData) {
        // Copy every table into a freshly-attached encrypted file, then swap.
        const encPath = `${SQLite.defaultDatabaseDirectory}/${DATABASE_NAME}`;
        await legacy.execAsync(`ATTACH DATABASE '${escapeKey(encPath)}' AS encrypted KEY '${escapeKey(key)}'`);
        await legacy.execAsync(`SELECT sqlcipher_export('encrypted')`);
        // Preserve the schema version so runMigrations() sees the real state.
        await legacy.execAsync(`PRAGMA encrypted.user_version = ${await readSchemaVersion(legacy)}`);
        await legacy.execAsync(`DETACH DATABASE encrypted`);
      }
    } finally {
      await legacy.closeAsync();
    }

    // Remove the plaintext file (whether it had data we exported, or was an
    // empty file we just created by probing).
    await SQLite.deleteDatabaseAsync(LEGACY_PLAINTEXT_DB);
    await markDbMigrated();
  } catch (err) {
    // Non-destructive: leave the plaintext DB and DON'T mark migrated so we
    // retry next launch. The encrypted DB open proceeds (possibly fresh).
    if (__DEV__) {
      console.warn('[DB] plaintext→SQLCipher migration failed (will retry):', err);
    }
  }
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
  try {
    return await getOrCreateDbKey();
  } catch (err) {
    // If the secure enclave is unavailable we can't safely encrypt. Returning
    // null means the DB opens WITHOUT a key — but since useSQLCipher makes the
    // build require a key for an encrypted file, this only matters on a fresh
    // (empty) DB, where it degrades to plaintext rather than bricking. Logged
    // so it's visible in dev.
    if (__DEV__) console.warn('[DB] could not obtain encryption key:', err);
    return null;
  }
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