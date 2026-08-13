/**
 * Dottie — Database Migrations Runner
 *
 * Applies any missing schema versions in order. Safe to run at every
 * app start — fully idempotent (uses `CREATE TABLE IF NOT EXISTS` and
 * the SQLite `user_version` PRAGMA).
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────
 *
 *  1. Read current `user_version` PRAGMA from the database
 *  2. If user_version < CURRENT_SCHEMA_VERSION, walk versions
 *     (current+1) … CURRENT_SCHEMA_VERSION in order
 *  3. For each version, run every statement in SCHEMA_BY_VERSION[v]
 *  4. After each version completes, bump user_version to that number
 *
 *  Each version is applied in its own transaction so a partial failure
 *  rolls back cleanly without leaving the DB in a half-migrated state.
 *
 * ─── ADDING A NEW MIGRATION ─────────────────────────────────────────
 *
 *  1. In schema.ts, add a new `SCHEMA_V<N>` array of DDL statements
 *  2. Add it to SCHEMA_BY_VERSION at key N
 *  3. Bump CURRENT_SCHEMA_VERSION in client.ts to N
 *  4. That's it — existing users get the migration on their next launch
 *
 *  Keep migrations PURELY ADDITIVE when possible (new tables, new
 *  columns with defaults). If you ever NEED to change a column type
 *  or drop a table, that requires a custom migration path (copy data,
 *  drop, recreate, restore) — discuss before adding.
 */

import {
  Database,
  CURRENT_SCHEMA_VERSION,
  readSchemaVersion,
  writeSchemaVersion,
} from './client';
import { SCHEMA_BY_VERSION } from './schema';

/**
 * Run all pending migrations.
 * Should be called ONCE at app startup, after getDatabase() resolves.
 *
 * Safe to call multiple times — does nothing if already up to date.
 */
export async function runMigrations(db: Database): Promise<MigrationResult> {
  const startedAt = Date.now();
  const fromVersion = await readSchemaVersion(db);

  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    if (__DEV__) {
      console.log(
        `[Migrations] up to date at v${fromVersion} — nothing to do`
      );
    }
    return {
      fromVersion,
      toVersion: fromVersion,
      appliedVersions: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const appliedVersions: number[] = [];

  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const statements = SCHEMA_BY_VERSION[v];
    if (!statements || statements.length === 0) {
      if (__DEV__) {
        console.warn(`[Migrations] no statements registered for v${v}`);
      }
      continue;
    }

    if (__DEV__) {
      console.log(
        `[Migrations] applying v${v} (${statements.length} statements)`
      );
    }

    // Each version runs in its own transaction. We DON'T use the
    // withTransaction helper here because that's in client.ts and
    // we want migrations to be self-contained / testable in isolation.
    // ─── Transaction phase: run all DDL statements atomically ──────
    await db.execAsync('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]!;
        try {
          await db.execAsync(statement);
        } catch (err) {
          if (__DEV__) {
            console.error(
              `[Migrations] v${v} statement ${i} failed:`,
              statement.slice(0, 80),
              err
            );
          }
          throw err;
        }
      }
      await db.execAsync('COMMIT');
    } catch (err) {
      try {
        await db.execAsync('ROLLBACK');
      } catch {
        // ignore rollback failure — original error is what matters
      }
      throw err;
    }

    // ─── Version-bump phase: persist user_version AFTER the commit ──
    //
    // WHY OUTSIDE THE TRANSACTION: if the COMMIT above succeeds but the
    // process is interrupted before/while writing user_version, the DDL
    // is durably applied yet the version marker still reads v-1. On the
    // next launch we simply re-run the same version's statements —
    // which is SAFE because every statement uses
    // `CREATE TABLE/INDEX IF NOT EXISTS`. Writing the marker inside the
    // transaction risked the opposite, worse failure mode: a driver/WAL
    // edge case where the bumped version is visible but the DDL rolled
    // back, leaving the schema behind its recorded version forever.
    //
    // A failure of the marker write itself is non-fatal: don't throw,
    // just log — the DDL committed and the retry next launch is idempotent.
    try {
      await writeSchemaVersion(db, v);
      appliedVersions.push(v);
      if (__DEV__) {
        console.log(`[Migrations] v${v} committed and recorded`);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn(
          `[Migrations] v${v} DDL committed but version bump failed; ` +
            `will re-run (idempotently) next launch`,
          err
        );
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  if (__DEV__) {
    console.log(
      `[Migrations] complete: ${fromVersion} → ${CURRENT_SCHEMA_VERSION} in ${durationMs}ms`
    );
  }

  return {
    fromVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
    appliedVersions,
    durationMs,
  };
}

// ─── RESULT TYPE ─────────────────────────────────────────────────────

export interface MigrationResult {
  /** Schema version BEFORE migrations ran */
  fromVersion: number;
  /** Schema version AFTER migrations ran */
  toVersion: number;
  /** Versions that were actually applied this run (empty if up to date) */
  appliedVersions: number[];
  /** Total wall-clock time spent migrating */
  durationMs: number;
}