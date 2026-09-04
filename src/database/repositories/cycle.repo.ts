/**
 * Dottie — Cycle Repository
 *
 * Owns cycle-related persistence:
 *   - cycle_entries     One row per day with cycle info (period, flow, phase)
 *   - cycle_records     One row per COMPLETED cycle (computed)
 *   - predictions       Cached prediction outputs
 *   - prediction_errors Self-improvement loop data
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Cycle entries are upserted by (user_id, date) — logging the same
 *    day twice updates instead of creating duplicates.
 *  - Period start/end detection: when a period day is logged, we look
 *    at the surrounding days to detect cycle boundaries and populate
 *    cycle_records automatically.
 *  - Predictions are append-only — we keep history to power the
 *    self-improvement loop, but the LATEST one is what UI displays.
 *  - History queries use indexes (date DESC) for fast calendar scrolls.
 *
 * ─── PREDICTION PIPELINE ────────────────────────────────────────────
 *
 *  When a user logs a period start:
 *    1. logPeriodStart() upserts the cycle_entry
 *    2. If a prior period exists, compute the completed cycle_record
 *    3. If there was a recent prediction, record the prediction_error
 *
 *  The prediction engine itself (predictor.ts) stays pure — it pulls
 *  history through this repo and returns a fresh prediction object,
 *  which the store then persists via savePrediction().
 */

import {
  Database,
  getDatabase,
  withTransaction,
  trackQuery,
  trackWrite,
} from '../client';
import {
  CycleEntryRow,
  CycleRecordRow,
  PredictionRow,
  PredictionErrorRow,
} from '../schema';
import {
  CycleEntry,
  CycleRecord,
  CyclePrediction,
  Phase,
} from '../../types/cycle.types';
import { nextDay, prevDay, daysApart, isCivilDate, todayCivil } from '../../utils/civil-date';

// ─── DOMAIN INPUT TYPES ──────────────────────────────────────────────

export interface UpsertCycleEntryInput {
  userId: string;
  date: string; // ISO YYYY-MM-DD
  phase?: Phase | null;
  flowLevel?: number | null;
  isPeriodDay?: boolean;
  confidenceScore?: number;
}

export interface LogPeriodInput {
  userId: string;
  date: string; // ISO YYYY-MM-DD
  flowLevel?: number; // 1-5, defaults to 3 (moderate)
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class CycleRepository {
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── CYCLE ENTRIES (one per day) ────────────────────────────────

  /**
   * Upsert a cycle entry. Combines INSERT with ON CONFLICT UPDATE so
   * repeated calls for the same date safely merge.
   *
   * Returns the resulting entry.
   */
  async upsertCycleEntry(input: UpsertCycleEntryInput): Promise<CycleEntry> {
    // ─── VALIDATE AT THE BOUNDARY ─────────────────────────────────
    //
    //  Everything downstream — the block walk, the predictor, every chart —
    //  assumes a well-formed civil date, and `civil-date` THROWS on anything
    //  else. So one bad write does not corrupt one row, it makes the whole
    //  calendar throw on every later read: the user's app is bricked until the
    //  data is deleted. The simulated-user harness got `""`, `"today"` and
    //  `"01/09/2026"` into this table (device-test-9), so the guard belongs
    //  here, at the only door into it.
    if (!isCivilDate(input.date)) {
      throw new RangeError(
        `[cycle.repo] refusing to store a malformed date: ${JSON.stringify(input.date)}`
      );
    }
    // Clamp rather than throw: a flow level is a slider value, and a
    // out-of-range one is a caller bug that should not lose the user's log.
    const flowLevel =
      input.flowLevel === undefined || input.flowLevel === null
        ? undefined
        : Math.min(5, Math.max(0, Math.round(input.flowLevel)));

    const now = new Date().toISOString();
    const db = await this.getDb();

    // ─── ONE STATEMENT, NO RACE ───────────────────────────────────
    //
    //  This used to SELECT, then branch to UPDATE or INSERT. Two calls landing
    //  together — a double-tap on "Mark as period", which is exactly what an
    //  impatient thumb does — both saw no row, both INSERTed, and the second
    //  blew up on `UNIQUE(user_id, date)` as an unhandled rejection. A real
    //  upsert is atomic, so the second tap merges instead of exploding.
    //
    //  COALESCE on the excluded values preserves the merge semantics the old
    //  branch had: a field the caller didn't pass keeps whatever is already
    //  stored, rather than being nulled out.
    await db.runAsync(
      `INSERT INTO cycle_entries (
         id, user_id, date, phase, flow_level, is_period_day,
         confidence_score, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date) DO UPDATE SET
         phase            = COALESCE(excluded.phase, cycle_entries.phase),
         flow_level       = COALESCE(excluded.flow_level, cycle_entries.flow_level),
         is_period_day    = CASE WHEN ?1 IS NULL THEN cycle_entries.is_period_day
                                 ELSE excluded.is_period_day END,
         confidence_score = COALESCE(excluded.confidence_score, cycle_entries.confidence_score),
         updated_at       = excluded.updated_at`,
      generateCycleEntryId(),
      input.userId,
      input.date,
      input.phase ?? null,
      flowLevel ?? null,
      input.isPeriodDay === undefined ? null : input.isPeriodDay ? 1 : 0,
      input.confidenceScore ?? null,
      now,
      now
    );
    trackWrite();

    // Read back so the caller always gets the MERGED row, not the values it
    // happened to pass in.
    const saved = await db.getFirstAsync<CycleEntryRow>(
      'SELECT * FROM cycle_entries WHERE user_id = ? AND date = ?',
      input.userId,
      input.date
    );
    if (!saved) {
      throw new Error('[cycle.repo] upsert wrote no row — this should be impossible');
    }
    return rowToCycleEntry(saved);
  }

  /**
   * Get a single cycle entry by date.
   */
  async getEntryByDate(userId: string, date: string): Promise<CycleEntry | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<CycleEntryRow>(
      'SELECT * FROM cycle_entries WHERE user_id = ? AND date = ?',
      userId,
      date
    );
    trackQuery(Date.now() - start);
    return row ? rowToCycleEntry(row) : null;
  }

  /**
   * Get all entries in a date range (inclusive on both ends).
   * Returned newest-first to match calendar scroll direction.
   */
  async getEntriesInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CycleEntry[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<CycleEntryRow>(
      `SELECT * FROM cycle_entries
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      userId,
      startDate,
      endDate
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToCycleEntry);
  }

  /**
   * Get the user's most recent period start date.
   * Returns null if no period days have been logged.
   *
   * "Most recent" = highest date among entries where is_period_day = 1
   * AND no entry the day before is also a period day (i.e., the FIRST
   * day of the most recent period block, not the most recent bleeding day).
   */
  async getLastPeriodStart(userId: string): Promise<string | null> {
    const start = Date.now();
    const db = await this.getDb();

    // Get all period days, newest first
    const rows = await db.getAllAsync<{ date: string }>(
      // Future days are EXCLUDED. The calendar lets you swipe forward and tap
      // any cell, so it is easy to mark a day that hasn't happened — and a
      // future "last period start" makes day-in-cycle negative and every
      // prediction nonsense (device-test-9). A day you marked ahead of time is
      // still stored and still drawn; it just can't be the period you are
      // currently in.
      `SELECT date FROM cycle_entries
       WHERE user_id = ? AND is_period_day = 1 AND date <= ?
       ORDER BY date DESC`,
      userId,
      todayCivil()
    );
    trackQuery(Date.now() - start);

    if (rows.length === 0) return null;

    // Find the most recent "start" — the latest date whose previous
    // calendar day is NOT also a period day.
    // (This is the second victim of the old local/UTC date helpers: with
    // `subtractDay` returning d−2 east of Greenwich, the "is the previous day
    // also a period day?" test compared against the WRONG day, so the most
    // recent period start came back wrong — which is what drove the bogus
    // "Day 168 / 0 cycles" reading on Home.)
    const periodDates = new Set(rows.map(r => r.date));
    for (const row of rows) {
      if (!periodDates.has(prevDay(row.date))) {
        return row.date;
      }
    }

    // Fallback: oldest period day (shouldn't happen with consistent data)
    return rows[rows.length - 1]?.date ?? null;
  }

  /**
   * Get period days within a date range.
   * Used by calendar view + correlation engine.
   */
  async getPeriodDaysInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ date: string }>(
      `SELECT date FROM cycle_entries
       WHERE user_id = ? AND is_period_day = 1 AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      userId,
      startDate,
      endDate
    );
    trackQuery(Date.now() - start);
    return rows.map(r => r.date);
  }

  /**
   * Log a period day. Conventionally flow_level defaults to 3 (moderate)
   * when omitted — users can refine later.
   *
   * After upserting, runs cycle_records detection so completed cycles
   * are captured automatically.
   */
  async logPeriodDay(input: LogPeriodInput): Promise<CycleEntry> {
    const entry = await this.upsertCycleEntry({
      userId: input.userId,
      date: input.date,
      flowLevel: input.flowLevel ?? 3,
      isPeriodDay: true,
      phase: 'menstrual',
    });

    // Try to detect & save a completed cycle record
    await this.detectAndSaveCycleRecord(input.userId, input.date);
    return entry;
  }

  // ─── CYCLE RECORDS (completed cycles) ───────────────────────────

  /**
   * Get all cycle records for a user, newest first.
   * Used by the prediction engine to build its weighted history.
   *
   * @param limit Maximum number of records to return (default: 12 = 1 year)
   */
  async getCycleHistory(userId: string, limit: number = 12): Promise<CycleRecord[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<CycleRecordRow>(
      `SELECT * FROM cycle_records
       WHERE user_id = ?
       ORDER BY start_date DESC
       LIMIT ?`,
      userId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToCycleRecord);
  }

  /**
   * Count of completed cycles. Used to pick which prediction phase
   * (1/2/3) the engine should use.
   */
  async getCycleCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cycle_records WHERE user_id = ?',
      userId
    );
    return row?.n ?? 0;
  }

  /**
   * When a new period start is detected, compute the cycle record for
   * the PREVIOUS cycle (from the previous period start up to one day
   * before this new period start) and save it.
   *
   * Idempotent — re-running on the same date doesn't create duplicates.
   */
  private async detectAndSaveCycleRecord(
    userId: string,
    newPeriodStart: string
  ): Promise<void> {
    const db = await this.getDb();

    // Find the period start that immediately precedes this one
    const priorPeriodDays = await db.getAllAsync<{ date: string }>(
      `SELECT date FROM cycle_entries
       WHERE user_id = ? AND is_period_day = 1 AND date < ?
       ORDER BY date DESC`,
      userId,
      newPeriodStart
    );

    if (priorPeriodDays.length === 0) return;

    // Find the START of the prior period (first day of that block)
    const priorDates = new Set(priorPeriodDays.map(p => p.date));
    let priorStart: string | null = null;
    for (const day of priorPeriodDays) {
      const dayBefore = prevDay(day.date);
      if (!priorDates.has(dayBefore)) {
        priorStart = day.date;
        break;
      }
    }
    if (!priorStart) return;

    // Find the END of the prior period (last consecutive period day).
    //
    // ⚠️ This walk is why the app used to freeze on the second period day
    // logged (device-test-7). It was `while (true)` over `addDay(cursor)`, and
    // `addDay` was the identity function in any timezone east of Greenwich —
    // so `cursor` never advanced, the set always contained it, and the JS
    // thread spun forever with no way out but a force-close.
    //
    // `addDays` is timezone-independent now, which fixes the cause. The loop is
    // ALSO rewritten so no future date bug can hang it: a bounded `for` over at
    // most MAX_PERIOD_SPAN days, and each step must move strictly forward or we
    // stop. A wrong date helper can now only produce a wrong answer, never an
    // unresponsive app.
    const MAX_PERIOD_SPAN = 30;
    let priorEnd = priorStart;
    let cursor = priorStart;
    for (let step = 0; step < MAX_PERIOD_SPAN; step++) {
      const candidate = nextDay(cursor);
      if (candidate <= cursor) break;          // no forward progress — bail out
      if (!priorDates.has(candidate)) break;   // end of this contiguous block
      priorEnd = candidate;
      cursor = candidate;
    }

    const cycleLength = daysApart(priorStart, newPeriodStart);
    const periodLength = daysApart(priorStart, priorEnd) + 1;

    // Sanity check — skip records with implausible lengths
    if (cycleLength < 15 || cycleLength > 60) return;
    if (periodLength < 1 || periodLength > 14) return;

    // Avg flow over the period block
    const flowRows = await db.getAllAsync<{ flow_level: number | null }>(
      `SELECT flow_level FROM cycle_entries
       WHERE user_id = ? AND date BETWEEN ? AND ? AND is_period_day = 1`,
      userId,
      priorStart,
      priorEnd
    );
    const flowValues = flowRows.map(r => r.flow_level).filter((v): v is number => v !== null);
    const averageFlow =
      flowValues.length > 0
        ? flowValues.reduce((a, b) => a + b, 0) / flowValues.length
        : null;

    // Avoid duplicate insert if record already exists for this start_date
    const existing = await db.getFirstAsync<CycleRecordRow>(
      `SELECT * FROM cycle_records WHERE user_id = ? AND start_date = ?`,
      userId,
      priorStart
    );

    const now = new Date().toISOString();
    if (existing) {
      await db.runAsync(
        `UPDATE cycle_records
         SET end_date = ?, cycle_length = ?, period_length = ?, average_flow = ?
         WHERE id = ?`,
        priorEnd,
        cycleLength,
        periodLength,
        averageFlow,
        existing.id
      );
    } else {
      await db.runAsync(
        `INSERT INTO cycle_records (
          id, user_id, start_date, end_date, cycle_length, period_length,
          average_flow, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        generateCycleRecordId(),
        userId,
        priorStart,
        priorEnd,
        cycleLength,
        periodLength,
        averageFlow,
        now
      );
    }
    trackWrite();
  }

  // ─── PREDICTIONS ────────────────────────────────────────────────

  /**
   * Save a prediction snapshot. Multiple per user over time — the
   * latest one is what we display, the history feeds prediction_errors.
   */
  async savePrediction(
    userId: string,
    prediction: CyclePrediction,
    predictionPhase?: 1 | 2 | 3
  ): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO predictions (
        id, user_id, predicted_next_period, confidence, window_days,
        current_phase, day_in_phase, day_in_cycle, predicted_ovulation,
        factors_used, prediction_phase, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      generatePredictionId(),
      userId,
      prediction.predictedNextPeriod,
      prediction.confidence,
      prediction.windowDays,
      prediction.currentPhase,
      prediction.dayInPhase,
      prediction.dayInCycle,
      prediction.predictedOvulation,
      JSON.stringify(prediction.factorsUsed),
      predictionPhase ?? null,
      prediction.createdAt
    );
    trackWrite();
  }

  /**
   * Get the latest prediction snapshot. Returns null if never predicted.
   */
  async getLatestPrediction(userId: string): Promise<CyclePrediction | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<PredictionRow>(
      `SELECT * FROM predictions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      userId
    );
    trackQuery(Date.now() - start);
    return row ? rowToCyclePrediction(row) : null;
  }

  /**
   * Get historical prediction errors for the self-improving loop.
   * Returns errors newest-first, capped at `limit`.
   */
  async getPredictionErrors(userId: string, limit: number = 10): Promise<number[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<PredictionErrorRow>(
      `SELECT * FROM prediction_errors
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      userId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(r => r.error_days);
  }

  /**
   * Record a prediction error: when an actual period arrives, compare
   * against what the latest prediction said. Used by the self-improving
   * Bayesian loop in predictor.ts (Phase 3).
   */
  async recordPredictionError(
    userId: string,
    predictedDate: string,
    actualDate: string
  ): Promise<void> {
    const errorDays = daysApart(predictedDate, actualDate);
    const signedError = actualDate > predictedDate ? errorDays : -errorDays;

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO prediction_errors (
        id, user_id, predicted_date, actual_date, error_days, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      generatePredictionErrorId(),
      userId,
      predictedDate,
      actualDate,
      signedError,
      new Date().toISOString()
    );
    trackWrite();
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const cycleRepository = new CycleRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToCycleEntry(row: CycleEntryRow): CycleEntry {
  return {
    id: row.id,
    date: row.date,
    phase: row.phase,
    flowLevel: row.flow_level,
    isPeriodDay: row.is_period_day === 1,
    confidenceScore: row.confidence_score,
  };
}

function rowToCycleRecord(row: CycleRecordRow): CycleRecord {
  return {
    startDate: row.start_date,
    endDate: row.end_date,
    cycleLength: row.cycle_length,
    periodLength: row.period_length,
    averageFlow: row.average_flow ?? 0,
  };
}

function rowToCyclePrediction(row: PredictionRow): CyclePrediction {
  let factorsUsed: string[] = [];
  try {
    const parsed = JSON.parse(row.factors_used);
    if (Array.isArray(parsed)) factorsUsed = parsed;
  } catch {
    factorsUsed = [];
  }

  return {
    predictedNextPeriod: row.predicted_next_period,
    confidence: row.confidence,
    windowDays: row.window_days,
    currentPhase: row.current_phase as Phase,
    dayInPhase: row.day_in_phase,
    dayInCycle: row.day_in_cycle,
    predictedOvulation: row.predicted_ovulation,
    factorsUsed,
    createdAt: row.created_at,
  };
}

// ─── ID GENERATION ───────────────────────────────────────────────────

function generateCycleEntryId(): string {
  return `ce_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateCycleRecordId(): string {
  return `cr_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generatePredictionId(): string {
  return `pr_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generatePredictionErrorId(): string {
  return `pe_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}

// ─── DATE HELPERS ────────────────────────────────────────────────────
//
//  These used to be local copies that parsed as local midnight and serialised
//  as UTC, which made `addDay` the IDENTITY function east of Greenwich and hung
//  the period-day walk below forever. They now come from `civil-date`, which is
//  UTC-only end to end. See that module's header for the full post-mortem.
//  Do not reimplement them here.