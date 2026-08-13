/**
 * Dottie — Content Progress Repository
 *
 * Owns persistence for the LEARN tab — lesson progress and quiz attempts.
 * Implements the engine-layer provider interfaces so LessonEngine and
 * QuizEngine can plug in seamlessly:
 *
 *   - LessonProgressProvider  (from engine/content/lesson-engine.ts)
 *   - QuizAttemptProvider     (from engine/content/quiz-engine.ts)
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  The engines were built dependency-injected from day one with these
 *  provider interfaces. This repo is the SQLite-backed implementation
 *  the store will hand to the engines at app startup.
 *
 *      // In the content store:
 *      const lessonEngine = new LessonEngine(
 *        contentResolver,
 *        contentRepository.getLessonProgressProvider(userId)
 *      );
 *
 *  The engines never touch SQLite — they call provider methods, which
 *  we implement here with real queries.
 *
 * ─── PROVIDER METHODS ARE SYNC ──────────────────────────────────────
 *
 *  The engine provider interfaces declare SYNC methods (no Promises).
 *  That's deliberate — engines run on the JS thread and we want lesson
 *  rendering to be a single tick.
 *
 *  We bridge by:
 *    1. Eagerly loading the user's progress + recent attempts on
 *       store hydration (one async query upfront)
 *    2. Holding it in an in-memory map inside the bound provider
 *    3. Mirroring writes to SQLite in the background
 *
 *  This is the same pattern Spotify and Instagram use for offline-first
 *  data — read from memory, write through to storage.
 *
 * ─── BIND ONCE PER USER ─────────────────────────────────────────────
 *
 *  Each user gets their own bound provider instance (created via
 *  bindForUser). Provider state is per-user; never share across users.
 */

import {
  Database,
  getDatabase,
  trackQuery,
  trackWrite,
} from '../client';
import {
  LessonProgressRow,
  QuizAttemptRow,
} from '../schema';
import {
  LessonProgressProvider,
} from '../../engine/content';
import {
  QuizAttemptProvider,
} from '../../engine/content/quiz-engine';

// ─── DOMAIN TYPES (mirror the engine's expected shapes) ──────────────

/**
 * Lesson progress as the engine sees it.
 * Matches the LessonProgress type the engine uses for save/load.
 *
 * The engine's own type definition lives next to its interface, so we
 * re-declare the structural shape here to avoid an import cycle.
 */
export interface LessonProgress {
  lessonId: string;
  pathId: string;
  status: 'not_started' | 'in_progress' | 'complete';
  startedAt: string | null;
  completedAt: string | null;
  quizScore: number | null;
  xpEarned: number;
  gemsEarned: number;
}

/**
 * Quiz attempt as the engine sees it.
 * Mirrors the QuizAttempt type from the engine layer.
 */
export interface QuizAttempt {
  id: string;
  quizId: string;
  startedAt: string;
  completedAt: string;
  correctCount: number;
  totalCount: number;
  score: number; // 0.0 - 1.0
  passed: boolean;
  xpEarned: number;
  gemsEarned: number;
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class ContentRepository {
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── LESSON PROGRESS (async — used by store hydration) ──────────

  /**
   * Get progress for a specific lesson. Returns null if never started.
   * Mostly used during hydration; UI reads through the bound provider.
   */
  async getLessonProgress(
    userId: string,
    lessonId: string
  ): Promise<LessonProgress | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<LessonProgressRow>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      userId,
      lessonId
    );
    trackQuery(Date.now() - start);
    return row ? rowToLessonProgress(row) : null;
  }

  /**
   * Get all lesson progress records for a user. Used for hydration —
   * we load everything upfront and serve from memory afterwards.
   *
   * Volume note: even a power user is unlikely to have more than ~50
   * lesson rows. Loading them all once is cheaper than 50 individual
   * queries during the learn tab session.
   */
  async getAllLessonProgress(userId: string): Promise<LessonProgress[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<LessonProgressRow>(
      'SELECT * FROM lesson_progress WHERE user_id = ?',
      userId
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToLessonProgress);
  }

  /**
   * Get progress for a specific path's lessons only.
   */
  async getPathProgress(
    userId: string,
    pathId: string
  ): Promise<LessonProgress[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<LessonProgressRow>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND path_id = ?',
      userId,
      pathId
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToLessonProgress);
  }

  /**
   * Count of completed lessons. Drives badge progress for "Curious Mind"
   * and "Dedicated Learner."
   */
  async getCompletedLessonCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM lesson_progress
       WHERE user_id = ? AND status = 'complete'`,
      userId
    );
    return row?.n ?? 0;
  }

  /**
   * Save or update lesson progress. Upserts by (user_id, lesson_id).
   */
  async saveLessonProgress(
    userId: string,
    progress: LessonProgress
  ): Promise<void> {
    const now = new Date().toISOString();
    const db = await this.getDb();

    const existing = await db.getFirstAsync<LessonProgressRow>(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      userId,
      progress.lessonId
    );

    if (existing) {
      await db.runAsync(
        `UPDATE lesson_progress
         SET path_id = ?, status = ?, started_at = ?, completed_at = ?,
             quiz_score = ?, xp_earned = ?, gems_earned = ?, updated_at = ?
         WHERE id = ?`,
        progress.pathId,
        progress.status,
        progress.startedAt,
        progress.completedAt,
        progress.quizScore,
        progress.xpEarned,
        progress.gemsEarned,
        now,
        existing.id
      );
    } else {
      await db.runAsync(
        `INSERT INTO lesson_progress (
          id, user_id, lesson_id, path_id, status, started_at,
          completed_at, quiz_score, xp_earned, gems_earned, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        generateLessonProgressId(),
        userId,
        progress.lessonId,
        progress.pathId,
        progress.status,
        progress.startedAt,
        progress.completedAt,
        progress.quizScore,
        progress.xpEarned,
        progress.gemsEarned,
        now
      );
    }
    trackWrite();
  }

  // ─── QUIZ ATTEMPTS (async) ──────────────────────────────────────

  /**
   * Save a quiz attempt — append-only.
   */
  async saveQuizAttempt(
    userId: string,
    attempt: QuizAttempt,
    lessonId?: string | null
  ): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO quiz_attempts (
        id, user_id, quiz_id, lesson_id, score, correct_count,
        total_count, passed, xp_earned, gems_earned, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      attempt.id,
      userId,
      attempt.quizId,
      lessonId ?? null,
      attempt.score,
      attempt.correctCount,
      attempt.totalCount,
      attempt.passed ? 1 : 0,
      attempt.xpEarned,
      attempt.gemsEarned,
      attempt.completedAt
    );
    trackWrite();
  }

  /**
   * All attempts for a single quiz, newest first.
   */
  async getAttemptsForQuiz(
    userId: string,
    quizId: string
  ): Promise<QuizAttempt[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<QuizAttemptRow>(
      `SELECT * FROM quiz_attempts
       WHERE user_id = ? AND quiz_id = ?
       ORDER BY completed_at DESC`,
      userId,
      quizId
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToQuizAttempt);
  }

  /**
   * All attempts ever, used by hydration to seed the in-memory provider.
   */
  async getAllAttempts(userId: string): Promise<QuizAttempt[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<QuizAttemptRow>(
      `SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY completed_at DESC`,
      userId
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToQuizAttempt);
  }

  /**
   * Best score across all attempts for a quiz (0 if never taken).
   * Used for the "is this a new personal best?" calculation.
   */
  async getBestScore(userId: string, quizId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ best: number | null }>(
      `SELECT MAX(score) AS best FROM quiz_attempts
       WHERE user_id = ? AND quiz_id = ?`,
      userId,
      quizId
    );
    return row?.best ?? 0;
  }

  /**
   * Count of perfect (score = 1.0) attempts ever. Powers the
   * "Sharp Mind" and "Quiz Queen" badge progress.
   */
  async getPerfectAttemptCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quiz_attempts
       WHERE user_id = ? AND score >= 1.0`,
      userId
    );
    return row?.n ?? 0;
  }

  // ─── ENGINE PROVIDER BINDINGS ───────────────────────────────────

  /**
   * Bind a LessonProgressProvider for use by the LessonEngine.
   *
   * Returns a SYNC provider that:
   *   - Serves reads from an in-memory cache (seeded from `seedProgress`)
   *   - Mirrors writes to SQLite asynchronously in the background
   *
   * The store layer should call this once per user after hydration:
   *
   *      const progress = await contentRepository.getAllLessonProgress(userId);
   *      const provider = contentRepository.bindLessonProgressProvider(userId, progress);
   *      const engine = new LessonEngine(resolver, provider);
   */
  bindLessonProgressProvider(
    userId: string,
    seedProgress: LessonProgress[] = []
  ): LessonProgressProvider {
    const cache = new Map<string, LessonProgress>();
    for (const p of seedProgress) {
      cache.set(p.lessonId, p);
    }

    return {
      getProgress: (lessonId: string) => {
        return cache.get(lessonId) ?? null;
      },
      saveProgress: (progress) => {
        // The engine's LessonProgress type may carry extra fields we don't
        // persist. Coerce to our row-shaped type for storage.
        const ours: LessonProgress = {
          lessonId: progress.lessonId,
          pathId: progress.pathId,
          status: progress.status,
          startedAt: progress.startedAt ?? null,
          completedAt: progress.completedAt ?? null,
          quizScore: progress.quizScore ?? null,
          xpEarned: progress.xpEarned ?? 0,
          gemsEarned: progress.gemsEarned ?? 0,
        };
        // Update cache synchronously (engines depend on this)
        cache.set(ours.lessonId, ours);
        // Mirror to DB asynchronously
        void this.saveLessonProgress(userId, ours).catch(err => {
          if (__DEV__) {
            console.warn('[ContentRepository] saveLessonProgress failed:', err);
          }
        });
      },
      getAllProgress: () => {
        return Array.from(cache.values());
      },
      getPathProgress: (pathId: string) => {
        return Array.from(cache.values()).filter(p => p.pathId === pathId);
      },
    } as LessonProgressProvider;
  }

  /**
   * Bind a QuizAttemptProvider for use by the QuizEngine.
   * Same async-mirror pattern as the lesson provider.
   */
  bindQuizAttemptProvider(
    userId: string,
    seedAttempts: QuizAttempt[] = []
  ): QuizAttemptProvider {
    const attempts: QuizAttempt[] = [...seedAttempts];

    return {
      saveAttempt: (attempt) => {
        const ours: QuizAttempt = {
          id: attempt.id,
          quizId: attempt.quizId,
          startedAt: attempt.startedAt ?? new Date().toISOString(),
          completedAt: attempt.completedAt ?? new Date().toISOString(),
          correctCount: attempt.correctCount,
          totalCount: attempt.totalCount,
          score: attempt.score,
          passed: attempt.passed,
          xpEarned: attempt.xpEarned ?? 0,
          gemsEarned: attempt.gemsEarned ?? 0,
        };
        attempts.push(ours);
        void this.saveQuizAttempt(userId, ours).catch(err => {
          if (__DEV__) {
            console.warn('[ContentRepository] saveQuizAttempt failed:', err);
          }
        });
      },
      getAttemptsForQuiz: (quizId: string) => {
        return attempts.filter(a => a.quizId === quizId);
      },
      getBestScore: (quizId: string) => {
        const forQuiz = attempts.filter(a => a.quizId === quizId);
        if (forQuiz.length === 0) return 0;
        return Math.max(...forQuiz.map(a => a.score));
      },
      getAllAttempts: () => {
        return [...attempts];
      },
    } as QuizAttemptProvider;
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const contentRepository = new ContentRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToLessonProgress(row: LessonProgressRow): LessonProgress {
  return {
    lessonId: row.lesson_id,
    pathId: row.path_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    quizScore: row.quiz_score,
    xpEarned: row.xp_earned,
    gemsEarned: row.gems_earned,
  };
}

function rowToQuizAttempt(row: QuizAttemptRow): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    startedAt: row.completed_at, // No separate startedAt column — use completedAt
    completedAt: row.completed_at,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    score: row.score,
    passed: row.passed === 1,
    xpEarned: row.xp_earned,
    gemsEarned: row.gems_earned,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function generateLessonProgressId(): string {
  return `lp_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}