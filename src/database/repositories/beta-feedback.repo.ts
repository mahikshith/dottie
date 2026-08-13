/**
 * Dottie — Beta Feedback Repository
 *
 * Local-only storage for in-app feedback collected during the beta
 * period. Same shape as our other repositories — singleton class with
 * an ensureTables() bootstrap so we don't need a schema migration
 * for this minor additive table.
 *
 * ─── WHY NO SCHEMA MIGRATION ────────────────────────────────────────
 *
 *  The community repo already established the pattern of "additive
 *  tables created on first call via ensureTables()" rather than
 *  bumping CURRENT_SCHEMA_VERSION. This is the right call for two
 *  reasons:
 *
 *   1. Beta feedback is OPTIONAL infrastructure that ships in beta
 *      builds only. Bumping the schema version would force a migration
 *      run for every user, even those who never tap the feedback
 *      button. The ensureTables() pattern is lazy — it only creates
 *      the table the first time the user interacts with feedback.
 *
 *   2. When we're ready to retire beta feedback (or migrate it to a
 *      real backend), we don't have to worry about "what version was
 *      this added in?" — there's no version graph to untangle.
 *
 *  A future cleanup PR can fold this table into SCHEMA_V3 if we
 *  decide beta feedback graduates to a permanent feature.
 *
 * ─── PUBLIC API ─────────────────────────────────────────────────────
 *
 *    betaFeedbackRepository.create(input)       → save a new entry
 *    betaFeedbackRepository.markSent(id)        → flip status to 'sent'
 *    betaFeedbackRepository.markFailed(id)      → flip status to 'failed'
 *    betaFeedbackRepository.listAll()           → all entries (newest first)
 *    betaFeedbackRepository.getPending()        → only 'queued' entries
 *    betaFeedbackRepository.delete(id)          → remove one entry
 *    betaFeedbackRepository.deleteAll()         → privacy: wipe all
 */

import {
  Database,
  getDatabase,
  trackQuery,
  trackWrite,
  withTransaction,
} from '../client';
import {
  BetaFeedbackCreateInput,
  BetaFeedbackRecord,
  FeedbackMood,
  FeedbackStatus,
} from '../../types/beta-feedback.types';

// ─── ROW TYPE (matches DDL exactly) ──────────────────────────────────

interface BetaFeedbackRow {
  id: string;
  created_at: string;
  sent_at: string | null;
  status: FeedbackStatus;
  mood: number;
  message: string;
  email: string | null;
  app_version: string;
  build_number: string;
  companion: string | null;
  phase: string | null;
  day_in_cycle: number | null;
  user_mode: string | null;
}

// ─── REPOSITORY ──────────────────────────────────────────────────────

class BetaFeedbackRepository {
  private dbPromise: Promise<Database> | null = null;
  private tablesReady = false;

  /**
   * Get the database, ensuring our table exists on first call.
   * Subsequent calls reuse the same handle and skip the table check.
   */
  private async getDb(): Promise<Database> {
    if (!this.dbPromise) this.dbPromise = getDatabase();
    const db = await this.dbPromise;
    if (!this.tablesReady) {
      await this.ensureTables(db);
      this.tablesReady = true;
    }
    return db;
  }

  /**
   * Create the beta_feedback table + indexes if they don't exist.
   * Idempotent — safe to run on every cold start.
   */
  private async ensureTables(db: Database): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS beta_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        sent_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
        mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
        message TEXT NOT NULL,
        email TEXT,
        app_version TEXT NOT NULL,
        build_number TEXT NOT NULL,
        companion TEXT,
        phase TEXT,
        day_in_cycle INTEGER,
        user_mode TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_beta_feedback_status_created
        ON beta_feedback(status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_beta_feedback_created
        ON beta_feedback(created_at DESC)`,
    ];

    for (const sql of statements) {
      await db.execAsync(sql);
    }
  }

  // ─── CREATE ─────────────────────────────────────────────────────

  /**
   * Save a new feedback entry to SQLite. The caller hands off to the
   * transport layer afterwards; this method is concerned only with
   * durability.
   */
  async create(input: BetaFeedbackCreateInput): Promise<BetaFeedbackRecord> {
    const db = await this.getDb();
    const id = generateFeedbackId();
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO beta_feedback (
        id, created_at, sent_at, status, mood, message, email,
        app_version, build_number, companion, phase, day_in_cycle, user_mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      createdAt,
      null,
      'queued',
      input.mood,
      input.message,
      input.email,
      input.appVersion,
      input.buildNumber,
      input.companion,
      input.phase,
      input.dayInCycle,
      input.userMode
    );
    trackWrite();

    return {
      id,
      createdAt,
      sentAt: null,
      status: 'queued',
      mood: input.mood as FeedbackMood,
      message: input.message,
      email: input.email,
      appVersion: input.appVersion,
      buildNumber: input.buildNumber,
      companion: input.companion,
      phase: input.phase,
      dayInCycle: input.dayInCycle,
      userMode: input.userMode,
    };
  }

  // ─── UPDATE STATUS ──────────────────────────────────────────────

  /**
   * Mark an entry as 'sent' (transport handed off to email composer).
   * Records the timestamp so the user can see when they sent it.
   */
  async markSent(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE beta_feedback SET status = 'sent', sent_at = ? WHERE id = ?`,
      new Date().toISOString(),
      id
    );
    trackWrite();
  }

  /**
   * Mark an entry as 'failed' (no transport available, can be retried).
   */
  async markFailed(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE beta_feedback SET status = 'failed' WHERE id = ?`,
      id
    );
    trackWrite();
  }

  // ─── READ ───────────────────────────────────────────────────────

  /**
   * All entries, newest first. Used by the feedback log screen.
   */
  async listAll(): Promise<BetaFeedbackRecord[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<BetaFeedbackRow>(
      `SELECT * FROM beta_feedback ORDER BY created_at DESC`
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToRecord);
  }

  /**
   * Only 'queued' entries (never opened the composer for them).
   * Used by the dev menu's "send all" action and crash recovery.
   */
  async getPending(): Promise<BetaFeedbackRecord[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<BetaFeedbackRow>(
      `SELECT * FROM beta_feedback WHERE status = 'queued' ORDER BY created_at ASC`
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToRecord);
  }

  /** Find one entry by id. Used after marking sent to return fresh data. */
  async getById(id: string): Promise<BetaFeedbackRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<BetaFeedbackRow>(
      `SELECT * FROM beta_feedback WHERE id = ?`,
      id
    );
    trackQuery(0);
    return row ? rowToRecord(row) : null;
  }

  /** Count of entries — used by the profile screen subtitle. */
  async count(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM beta_feedback`
    );
    trackQuery(0);
    return row?.count ?? 0;
  }

  // ─── DELETE ─────────────────────────────────────────────────────

  /** Remove a single entry. */
  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM beta_feedback WHERE id = ?`, id);
    trackWrite();
  }

  /** Wipe all entries. Used by the "delete my data" privacy action. */
  async deleteAll(): Promise<void> {
    await withTransaction(async (db) => {
      await db.execAsync(`DELETE FROM beta_feedback`);
    });
    trackWrite();
  }
}

// ─── ROW → RECORD CONVERSION ─────────────────────────────────────────

function rowToRecord(row: BetaFeedbackRow): BetaFeedbackRecord {
  // The mood column is stored as INTEGER but typed as 1-5 in TS.
  // Coerce + clamp defensively so a corrupt row doesn't crash the UI.
  const moodClamped = (Math.min(5, Math.max(1, Math.round(row.mood))) as FeedbackMood);

  return {
    id: row.id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    status: row.status,
    mood: moodClamped,
    message: row.message,
    email: row.email,
    appVersion: row.app_version,
    buildNumber: row.build_number,
    companion: row.companion,
    phase: row.phase,
    dayInCycle: row.day_in_cycle,
    userMode: row.user_mode,
  };
}

// ─── ID GENERATION ───────────────────────────────────────────────────

/**
 * Generate a feedback ID. Same pattern as the other repos —
 * timestamp + random suffix for ordering + uniqueness.
 *
 * We deliberately don't use a UUID library to keep this dep-free.
 * Collision risk at this scale (100 testers × ~10 feedbacks each)
 * is effectively zero with a 12-char random suffix.
 */
function generateFeedbackId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  return `fb_${timestamp}_${random}`;
}

// ─── SINGLETON EXPORT ────────────────────────────────────────────────

export const betaFeedbackRepository = new BetaFeedbackRepository();
