/**
 * Dottie — Check-In & Symptom Repository
 *
 * Owns the daily ritual data:
 *   - daily_check_ins    One row per day with mood/energy/sleep summary
 *   - symptom_logs       Many rows per day (each symptom is its own log)
 *   - question_answers   Each phase-question response (engagement tracking)
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Check-ins are upserted by (user_id, date) — one row per day max
 *  - Symptoms are append-only — log as many as the user wants per day
 *  - Question answers are upserted by (user_id, date, question_id) so
 *    the user can change their answer if they tap a different option
 *  - Recent-symptom queries return data shaped for the ContentResolver's
 *    detectSymptomCluster() input (the engine layer never reshapes data)
 *
 * ─── RECENT SYMPTOMS PIPELINE ───────────────────────────────────────
 *
 *  When the home screen renders:
 *    1. Store calls checkinRepository.getRecentSymptoms(userId, 7)
 *    2. The repo returns RecentSymptom[] in the exact shape content-resolver
 *       expects: { category, symptomType, severity, date }
 *    3. Store passes it through to ContentResolver to build the state_key
 *    4. Daily Decode + phase questions get personalized to that cluster
 *
 *  Zero reshaping in the store. Zero reshaping in the engine. Clean.
 */

import {
  Database,
  getDatabase,
  trackQuery,
  trackWrite,
} from '../client';
import {
  DailyCheckInRow,
  SymptomLogRow,
  QuestionAnswerRow,
} from '../schema';
import { Phase } from '../../types/cycle.types';
import { TrackedMetric } from '../../types/content.types';
import { RecentSymptom } from '../../engine/content';
import { addDays } from '../../utils/civil-date';

// ─── DOMAIN TYPES ────────────────────────────────────────────────────

export interface DailyCheckIn {
  id: string;
  date: string;
  moodScore: number | null;
  energyLevel: number | null;
  sleepQuality: number | null;
  stressLevel: number | null;
  questionsAnsweredCount: number;
  crampFreezeUsed: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SymptomLog {
  id: string;
  date: string;
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  symptomType: string;
  severity: number;
  notes: string | null;
  phaseAtLog: string | null;
  createdAt: string;
}

export interface QuestionAnswer {
  id: string;
  date: string;
  questionId: string;
  stateKey: string | null;
  tracksMetric: TrackedMetric | null;
  responseValue: string;
  responseIndex: number | null;
  createdAt: string;
}

// ─── INPUT TYPES ─────────────────────────────────────────────────────

export interface UpsertCheckInInput {
  userId: string;
  date: string;
  moodScore?: number | null;
  energyLevel?: number | null;
  sleepQuality?: number | null;
  stressLevel?: number | null;
  crampFreezeUsed?: boolean;
  notes?: string | null;
}

export interface LogSymptomInput {
  userId: string;
  date: string;
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  symptomType: string;
  severity: number;
  notes?: string | null;
  phaseAtLog?: Phase | null;
}

export interface SaveQuestionAnswerInput {
  userId: string;
  date: string;
  questionId: string;
  stateKey?: string | null;
  tracksMetric?: TrackedMetric | null;
  /** The display value the user picked (e.g. "Mild", "😊", "Yes") */
  responseValue: string;
  /** Optional numeric index — useful for scale/choice analytics */
  responseIndex?: number | null;
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class CheckInRepository {
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── DAILY CHECK-INS ────────────────────────────────────────────

  /**
   * Upsert a daily check-in. Calling twice for the same date merges:
   * non-null fields overwrite, omitted fields preserve existing values.
   */
  async upsertCheckIn(input: UpsertCheckInInput): Promise<DailyCheckIn> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync<DailyCheckInRow>(
      'SELECT * FROM daily_check_ins WHERE user_id = ? AND date = ?',
      input.userId,
      input.date
    );

    if (existing) {
      const merged = {
        mood_score: input.moodScore !== undefined ? input.moodScore : existing.mood_score,
        energy_level: input.energyLevel !== undefined ? input.energyLevel : existing.energy_level,
        sleep_quality: input.sleepQuality !== undefined ? input.sleepQuality : existing.sleep_quality,
        stress_level: input.stressLevel !== undefined ? input.stressLevel : existing.stress_level,
        cramp_freeze_used:
          input.crampFreezeUsed !== undefined
            ? input.crampFreezeUsed ? 1 : 0
            : existing.cramp_freeze_used,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      };

      await db.runAsync(
        `UPDATE daily_check_ins
         SET mood_score = ?, energy_level = ?, sleep_quality = ?, stress_level = ?,
             cramp_freeze_used = ?, notes = ?, updated_at = ?
         WHERE user_id = ? AND date = ?`,
        merged.mood_score,
        merged.energy_level,
        merged.sleep_quality,
        merged.stress_level,
        merged.cramp_freeze_used,
        merged.notes,
        now,
        input.userId,
        input.date
      );
      trackWrite();

      return rowToCheckIn({ ...existing, ...merged, updated_at: now });
    }

    // Insert fresh row
    const row: DailyCheckInRow = {
      id: generateCheckInId(),
      user_id: input.userId,
      date: input.date,
      mood_score: input.moodScore ?? null,
      energy_level: input.energyLevel ?? null,
      sleep_quality: input.sleepQuality ?? null,
      stress_level: input.stressLevel ?? null,
      questions_answered_count: 0,
      cramp_freeze_used: input.crampFreezeUsed ? 1 : 0,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO daily_check_ins (
        id, user_id, date, mood_score, energy_level, sleep_quality,
        stress_level, questions_answered_count, cramp_freeze_used, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.user_id,
      row.date,
      row.mood_score,
      row.energy_level,
      row.sleep_quality,
      row.stress_level,
      row.questions_answered_count,
      row.cramp_freeze_used,
      row.notes,
      row.created_at,
      row.updated_at
    );
    trackWrite();
    return rowToCheckIn(row);
  }

  /**
   * Get the check-in for a specific date. Returns null if none yet.
   */
  async getCheckIn(userId: string, date: string): Promise<DailyCheckIn | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<DailyCheckInRow>(
      'SELECT * FROM daily_check_ins WHERE user_id = ? AND date = ?',
      userId,
      date
    );
    trackQuery(Date.now() - start);
    return row ? rowToCheckIn(row) : null;
  }

  /**
   * Has the user checked in today? Used to drive home screen UI
   * (show "log today" vs "you've checked in!").
   */
  async hasCheckedInToday(userId: string, today: string): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM daily_check_ins WHERE user_id = ? AND date = ?',
      userId,
      today
    );
    return (row?.n ?? 0) > 0;
  }

  /**
   * Get check-ins in a date range (newest first).
   */
  async getCheckInsInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyCheckIn[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<DailyCheckInRow>(
      `SELECT * FROM daily_check_ins
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      userId,
      startDate,
      endDate
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToCheckIn);
  }

  // ─── SYMPTOM LOGS ───────────────────────────────────────────────

  /**
   * Append a symptom log. Always inserts a new row — symptoms can be
   * logged multiple times per day (different times of day = different rows).
   */
  async logSymptom(input: LogSymptomInput): Promise<SymptomLog> {
    const row: SymptomLogRow = {
      id: generateSymptomId(),
      user_id: input.userId,
      date: input.date,
      category: input.category,
      symptom_type: input.symptomType,
      severity: input.severity,
      notes: input.notes ?? null,
      phase_at_log: input.phaseAtLog ?? null,
      created_at: new Date().toISOString(),
    };

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO symptom_logs (
        id, user_id, date, category, symptom_type, severity,
        notes, phase_at_log, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.user_id,
      row.date,
      row.category,
      row.symptom_type,
      row.severity,
      row.notes,
      row.phase_at_log,
      row.created_at
    );
    trackWrite();

    return rowToSymptomLog(row);
  }

  /**
   * Get all symptoms logged in a date range.
   */
  async getSymptomsInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SymptomLog[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<SymptomLogRow>(
      `SELECT * FROM symptom_logs
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC, created_at DESC`,
      userId,
      startDate,
      endDate
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToSymptomLog);
  }

  /**
   * Get symptoms from the last N days, shaped for the ContentResolver.
   *
   * This is the HOT PATH for personalized content delivery. Every home
   * screen render calls this (via the store) to detect the user's
   * symptom cluster → feeds the cohort cache key.
   *
   * @param userId The user
   * @param daysBack How many days back to look (default 7 — content
   *                 resolver's recency window)
   * @param today Today's ISO date (defaults to system date)
   */
  async getRecentSymptoms(
    userId: string,
    daysBack: number = 7,
    today: string = new Date().toISOString().split('T')[0]!
  ): Promise<RecentSymptom[]> {
    const start = Date.now();
    const startDate = addDays(today, -daysBack);

    const db = await this.getDb();
    const rows = await db.getAllAsync<SymptomLogRow>(
      `SELECT * FROM symptom_logs
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      userId,
      startDate,
      today
    );
    trackQuery(Date.now() - start);

    // Reshape into the engine's expected RecentSymptom shape
    return rows.map(row => ({
      category: row.category,
      symptomType: row.symptom_type,
      severity: row.severity,
      date: row.date,
    }));
  }

  /**
   * Total symptom logs ever — fuels the "Body Listener" badge progress.
   */
  async getTotalSymptomCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM symptom_logs WHERE user_id = ?',
      userId
    );
    return row?.n ?? 0;
  }

  // ─── QUESTION ANSWERS ───────────────────────────────────────────

  /**
   * Save (or update) a phase-question answer. Upserts on
   * (user_id, date, question_id) so re-tapping a different option
   * for the same question on the same day updates rather than dupes.
   *
   * Also increments the questions_answered_count on the day's check-in
   * (creating it if needed).
   */
  async saveQuestionAnswer(input: SaveQuestionAnswerInput): Promise<QuestionAnswer> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync<QuestionAnswerRow>(
      'SELECT * FROM question_answers WHERE user_id = ? AND date = ? AND question_id = ?',
      input.userId,
      input.date,
      input.questionId
    );

    if (existing) {
      await db.runAsync(
        `UPDATE question_answers
         SET state_key = ?, tracks_metric = ?, response_value = ?, response_index = ?
         WHERE id = ?`,
        input.stateKey ?? existing.state_key,
        input.tracksMetric ?? existing.tracks_metric,
        input.responseValue,
        input.responseIndex !== undefined ? input.responseIndex : existing.response_index,
        existing.id
      );
      trackWrite();

      const fresh = await db.getFirstAsync<QuestionAnswerRow>(
        'SELECT * FROM question_answers WHERE id = ?',
        existing.id
      );
      return rowToQuestionAnswer(fresh!);
    }

    const row: QuestionAnswerRow = {
      id: generateAnswerId(),
      user_id: input.userId,
      date: input.date,
      question_id: input.questionId,
      state_key: input.stateKey ?? null,
      tracks_metric: input.tracksMetric ?? null,
      response_value: input.responseValue,
      response_index: input.responseIndex ?? null,
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO question_answers (
        id, user_id, date, question_id, state_key, tracks_metric,
        response_value, response_index, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.user_id,
      row.date,
      row.question_id,
      row.state_key,
      row.tracks_metric,
      row.response_value,
      row.response_index,
      row.created_at
    );
    trackWrite();

    // Bump questions_answered_count on the daily check-in
    await this.bumpQuestionsAnsweredCount(input.userId, input.date);

    return rowToQuestionAnswer(row);
  }

  /**
   * Get the IDs of questions the user has already answered on `date`.
   * Used by QuestionEngine to filter the daily pool.
   */
  async getAnsweredQuestionIds(userId: string, date: string): Promise<string[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ question_id: string }>(
      'SELECT question_id FROM question_answers WHERE user_id = ? AND date = ?',
      userId,
      date
    );
    trackQuery(Date.now() - start);
    return rows.map(r => r.question_id);
  }

  /**
   * Get all answers for a specific date (full detail).
   */
  async getAnswersForDate(userId: string, date: string): Promise<QuestionAnswer[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<QuestionAnswerRow>(
      `SELECT * FROM question_answers
       WHERE user_id = ? AND date = ?
       ORDER BY created_at ASC`,
      userId,
      date
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToQuestionAnswer);
  }

  /**
   * Count of distinct dates with at least one symptom log AND at least
   * one period day in the same cycle — feeds the "Full Cycle Explorer"
   * badge calculation in the gamification repo.
   *
   * Returns set of phases that have at least one symptom logged.
   */
  async getPhasesWithSymptomLogs(userId: string): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ phase_at_log: string | null }>(
      `SELECT DISTINCT phase_at_log FROM symptom_logs
       WHERE user_id = ? AND phase_at_log IS NOT NULL`,
      userId
    );
    return rows
      .map(r => r.phase_at_log)
      .filter((p): p is string => p !== null);
  }

  // ─── INTERNAL: COUNT TRACKING ───────────────────────────────────

  /**
   * Bump the questions_answered_count for the day's check-in.
   * Creates a check-in row if one doesn't exist yet (so question answers
   * always have a parent check-in).
   */
  private async bumpQuestionsAnsweredCount(
    userId: string,
    date: string
  ): Promise<void> {
    const db = await this.getDb();
    const existing = await db.getFirstAsync<DailyCheckInRow>(
      'SELECT * FROM daily_check_ins WHERE user_id = ? AND date = ?',
      userId,
      date
    );

    if (existing) {
      await db.runAsync(
        `UPDATE daily_check_ins
         SET questions_answered_count = questions_answered_count + 1,
             updated_at = ?
         WHERE id = ?`,
        new Date().toISOString(),
        existing.id
      );
    } else {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO daily_check_ins (
          id, user_id, date, mood_score, energy_level, sleep_quality,
          stress_level, questions_answered_count, cramp_freeze_used, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 1, 0, NULL, ?, ?)`,
        generateCheckInId(),
        userId,
        date,
        now,
        now
      );
    }
    trackWrite();
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const checkinRepository = new CheckInRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToCheckIn(row: DailyCheckInRow): DailyCheckIn {
  return {
    id: row.id,
    date: row.date,
    moodScore: row.mood_score,
    energyLevel: row.energy_level,
    sleepQuality: row.sleep_quality,
    stressLevel: row.stress_level,
    questionsAnsweredCount: row.questions_answered_count,
    crampFreezeUsed: row.cramp_freeze_used === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSymptomLog(row: SymptomLogRow): SymptomLog {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    symptomType: row.symptom_type,
    severity: row.severity,
    notes: row.notes,
    phaseAtLog: row.phase_at_log,
    createdAt: row.created_at,
  };
}

function rowToQuestionAnswer(row: QuestionAnswerRow): QuestionAnswer {
  return {
    id: row.id,
    date: row.date,
    questionId: row.question_id,
    stateKey: row.state_key,
    tracksMetric: row.tracks_metric as TrackedMetric | null,
    responseValue: row.response_value,
    responseIndex: row.response_index,
    createdAt: row.created_at,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function generateCheckInId(): string {
  return `ci_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateSymptomId(): string {
  return `sy_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateAnswerId(): string {
  return `qa_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}

