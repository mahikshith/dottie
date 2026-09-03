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
import { nextDay, prevDay, daysApart } from '../../utils/civil-date';

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
    const now = new Date().toISOString();
    const db = await this.getDb();

    const existing = await db.getFirstAsync<CycleEntryRow>(
      'SELECT * FROM cycle_entries WHERE user_id = ? AND date = ?',
      input.userId,
      input.date
    );

    if (existing) {
      // Merge — preserve fields the caller didn't pass
      const merged = {
        phase: input.phase !== undefined ? input.phase : existing.phase,
        flow_level: input.flowLevel !== undefined ? input.flowLevel : existing.flow_level,
        is_period_day:
          input.isPeriodDay !== undefined
            ? input.isPeriodDay ? 1 : 0
            : existing.is_period_day,
        confidence_score:
          input.confidenceScore !== undefined
            ? input.confidenceScore
            : existing.confidence_score,
      };

      await db.runAsync(
        `UPDATE cycle_entries
         SET phase = ?, flow_level = ?, is_period_day = ?, confidence_score = ?, updated_at = ?
         WHERE user_id = ? AND date = ?`,
        merged.phase,
        merged.flow_level,
        merged.is_period_day,
        merged.confidence_score,
        now,
        input.userId,
        input.date
      );
      trackWrite();
      return rowToCycleEntry({
        ...existing,
        ...merged,
        updated_at: now,
      });
    }

    // Insert fresh row
    const row: CycleEntryRow = {
      id: generateCycleEntryId(),
      user_id: input.userId,
      date: input.date,
      phase: input.phase ?? null,
      flow_level: input.flowLevel ?? null,
      is_period_day: input.isPeriodDay ? 1 : 0,
      confidence_score: input.confidenceScore ?? 0.0,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO cycle_entries (
        id, user_id, date, phase, flow_level, is_period_day,
        confidence_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.user_id,
      row.date,
      row.phase,
      row.flow_level,
      row.is_period_day,
      row.confidence_score,
      row.created_at,
      row.updated_at
    );
    trackWrite();
    return rowToCycleEntry(row);
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
      `SELECT date FROM cycle_entries
       WHERE user_id = ? AND is_period_day = 1
       ORDER BY date DESC`,
      userId
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