/**
 * Dottie — Lesson Engine
 *
 * Lesson delivery and progress tracking for the Learn tab.
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────
 *
 *  Learn tab loads
 *    → LessonEngine.getAllPaths(mode)
 *    → For each path: getPathWithProgress() → completion %, next lesson
 *
 *  User taps a lesson
 *    → LessonEngine.getLesson(lessonId, companion, phase, ...)
 *    → Returns RenderedLesson with companion-wrapped intro
 *
 *  User starts reading
 *    → LessonEngine.startLesson(lessonId, pathId)
 *    → Creates LessonProgress with status='in_progress'
 *
 *  User finishes (optionally after a quiz)
 *    → LessonEngine.completeLesson(lessonId, pathId, quizScore?)
 *    → Returns LessonCompletionResult with XP/Gems + path bonus
 *    → Persists progress via injected provider
 *
 * ─── REWARD FORMULA ─────────────────────────────────────────────────
 *
 *  Base lesson completion:     25 XP, 5 gems
 *  Quiz score bonus:           +round(score × 25) XP, +round(score × 5) gems
 *  Path completion bonus:      +100 XP, +25 gems (returned separately)
 *
 * ─── LOCKING LOGIC ──────────────────────────────────────────────────
 *
 *  Lessons in a path are SEQUENTIAL. A lesson is locked if any prior
 *  lesson in the same path (by `order`) is not yet complete. The first
 *  lesson (order === 1) is always unlocked.
 *
 * ─── DEPENDENCY INJECTION ───────────────────────────────────────────
 *
 *  The engine accepts a LessonProgressProvider interface, allowing the
 *  database layer to plug in real SQLite persistence later. For dev
 *  and testing, an InMemoryLessonProgressProvider is included.
 *
 * ─── DATA RESOLUTION ────────────────────────────────────────────────
 *
 *  Lessons and paths can come from EITHER:
 *    1. The ContentResolver cohort cache (`learning_paths::{mode}` key)
 *    2. A static `LessonProvider` injected at construction time
 *
 *  The MVP uses the static provider, populated from
 *  `src/content/learning-paths.ts`. This avoids needing the cohort
 *  cache for bundled content while keeping the door open for
 *  dynamically loaded paths later (e.g., premium content fetched
 *  from a CDN).
 */

import {
  LearningPath,
  Lesson,
  LessonProgress,
} from '../../types/content.types';
import {
  CompanionType,
  CompanionMood,
  DialogueContext,
} from '../../types/companion.types';
import { Phase, UserMode } from '../../types/cycle.types';
import { ContentResolver } from './content-resolver';
import {
  wrapInsight,
  selectMood,
  buildContext,
} from './companion-dialogue';

// ─── PROGRESS PROVIDER INTERFACE ─────────────────────────────────────

/**
 * Pluggable persistence layer for lesson progress.
 * The SQLite repository layer implements this; for tests and dev mode,
 * use InMemoryLessonProgressProvider below.
 */
export interface LessonProgressProvider {
  getProgress(lessonId: string): LessonProgress | null;
  saveProgress(progress: LessonProgress): void;
  getAllProgress(): LessonProgress[];
  getPathProgress(pathId: string): LessonProgress[];
}

/**
 * In-memory implementation for tests, dev, and Storybook.
 * Resets on app restart — real persistence comes from the database layer.
 */
export class InMemoryLessonProgressProvider implements LessonProgressProvider {
  private store = new Map<string, LessonProgress>();

  getProgress(lessonId: string): LessonProgress | null {
    return this.store.get(lessonId) ?? null;
  }

  saveProgress(progress: LessonProgress): void {
    this.store.set(progress.lessonId, progress);
  }

  getAllProgress(): LessonProgress[] {
    return Array.from(this.store.values());
  }

  getPathProgress(pathId: string): LessonProgress[] {
    return Array.from(this.store.values()).filter(p => p.pathId === pathId);
  }
}

// ─── LESSON CONTENT PROVIDER ─────────────────────────────────────────

/**
 * Provides access to the bundled lesson/path catalog.
 *
 * The bundled content lives in `src/content/learning-paths.ts`. The
 * engine accepts a provider rather than importing that file directly
 * so tests can inject their own lessons without touching real content.
 */
export interface LessonProvider {
  /** All paths visible to a given mode (mode === 'all' OR mode match) */
  getPathsForMode(mode: UserMode): LearningPath[];
  /** All paths registered in the bundle */
  getAllPaths(): LearningPath[];
  /** A single path by ID, or null if not found */
  getPath(pathId: string): LearningPath | null;
  /** Lessons in a path, sorted by `order` ASC */
  getLessonsForPath(pathId: string): Lesson[];
  /** A single lesson by ID, or null if not found */
  getLesson(lessonId: string): Lesson | null;
}

// ─── RENDERED TYPES (UI-READY) ───────────────────────────────────────

/** A learning path with progress overlay, ready for the Learn tab list. */
export interface RenderedPath {
  path: LearningPath;
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  /** Next lesson the user should tap to continue (null if path done) */
  nextLessonId: string | null;
}

/**
 * A single lesson with companion wrapping, progress, and lock state.
 * This is what the lesson detail screen renders.
 */
export interface RenderedLesson {
  lesson: Lesson;
  pathId: string;
  /** Wrapped in the user's companion voice */
  companionIntro: string;
  /** User's progress on this lesson (null if never opened) */
  progress: LessonProgress | null;
  /** True if prior lessons in the path are not yet complete */
  isLocked: boolean;
  /** Rough estimate based on body length (~200 wpm) */
  estimatedReadMinutes: number;
}

/**
 * Result of completing a lesson — feeds into XP/Gem awarding flow.
 *
 * The engine returns REWARD AMOUNTS but does not directly mutate the
 * gamification stores. The caller (a Zustand store or the lesson screen)
 * is responsible for crediting XP/Gems and triggering celebration UI.
 */
export interface LessonCompletionResult {
  xpAwarded: number;
  gemsAwarded: number;
  pathCompleted: boolean;
  pathCompletionBonusXp: number;
  pathCompletionBonusGems: number;
  /** Badge IDs the caller should consider unlocking (hints, not authority) */
  newBadgesUnlocked: string[];
}

// ─── THE LESSON ENGINE ───────────────────────────────────────────────

/**
 * LessonEngine — manages learning paths, lesson rendering, and progress.
 *
 * Pure logic: accepts a ContentResolver (for future dynamic content),
 * a LessonProvider (for bundled content lookup), and a
 * LessonProgressProvider (for persistence). Never touches I/O directly.
 *
 * The resolver is currently OPTIONAL because all MVP lessons are
 * bundled — but it's kept in the API for forward-compat with
 * dynamically loaded premium paths.
 */
export class LessonEngine {
  constructor(
    private resolver: ContentResolver,
    private progressProvider: LessonProgressProvider,
    private lessonProvider: LessonProvider
  ) {}

  // ─── PATH OPERATIONS ────────────────────────────────────────────

  /** Get all learning paths registered for this user mode. */
  getAllPaths(mode: UserMode): LearningPath[] {
    return this.lessonProvider.getPathsForMode(mode);
  }

  /** Get a single learning path with computed progress overlay. */
  getPathWithProgress(pathId: string, mode: UserMode): RenderedPath | null {
    const path = this.lessonProvider.getPath(pathId);
    if (!path) return null;
    if (path.mode !== 'all' && path.mode !== mode) return null;
    return this.renderPath(path);
  }

  /** Render all paths with progress overlays — used by the Learn tab list. */
  getAllPathsWithProgress(mode: UserMode): RenderedPath[] {
    return this.getAllPaths(mode).map(p => this.renderPath(p));
  }

  /** Check if a path has been fully completed. */
  isPathComplete(pathId: string): boolean {
    const lessons = this.lessonProvider.getLessonsForPath(pathId);
    if (lessons.length === 0) return false;
    return lessons.every(l => {
      const progress = this.progressProvider.getProgress(l.id);
      return progress?.status === 'complete';
    });
  }

  /** Calculate path completion bonus reward amounts. */
  getPathCompletionBonus(pathId: string): { xp: number; gems: number } {
    if (!this.isPathComplete(pathId)) {
      return { xp: 0, gems: 0 };
    }
    const path = this.lessonProvider.getPath(pathId);
    return {
      xp: path?.completionXP ?? PATH_COMPLETION_XP,
      gems: path?.completionGems ?? PATH_COMPLETION_GEMS,
    };
  }

  // ─── LESSON OPERATIONS ──────────────────────────────────────────

  /** Get a single lesson, wrapped in companion voice, with lock + progress. */
  getLesson(
    lessonId: string,
    companionType: CompanionType,
    phase: Phase,
    dayInCycle: number,
    streakCount: number
  ): RenderedLesson | null {
    const lesson = this.lessonProvider.getLesson(lessonId);
    if (!lesson) return null;

    const path = this.lessonProvider.getPath(lesson.pathId);
    if (!path) return null;

    const pathLessons = this.lessonProvider.getLessonsForPath(path.id);
    const progress = this.progressProvider.getProgress(lessonId);
    const isLocked = this.isLessonLocked(lesson, pathLessons);

    // Build dialogue context (dayInPhase approximated as dayInCycle for
    // greeting purposes — precise dayInPhase isn't critical here)
    const context: DialogueContext = buildContext({
      companionType,
      phase,
      dayInPhase: Math.max(1, dayInCycle),
      dayInCycle,
      streakCount,
    });

    const mood: CompanionMood =
      progress?.status === 'complete'
        ? 'proud'
        : selectMood([], companionType, phase);

    const companionIntro = wrapInsight(
      companionType,
      lesson.title,
      context,
      mood
    );

    return {
      lesson,
      pathId: path.id,
      companionIntro,
      progress,
      isLocked,
      estimatedReadMinutes: estimateLessonMinutes(lesson),
    };
  }

  /** Mark a lesson as started. Idempotent — calling twice is safe. */
  startLesson(lessonId: string, pathId: string): LessonProgress {
    const existing = this.progressProvider.getProgress(lessonId);
    if (existing && existing.status !== 'not_started') {
      return existing;
    }

    const progress: LessonProgress = {
      lessonId,
      pathId,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      completedAt: null,
      quizScore: null,
      xpEarned: 0,
      gemsEarned: 0,
    };
    this.progressProvider.saveProgress(progress);
    return progress;
  }

  /** Mark a lesson as completed. */
  completeLesson(
    lessonId: string,
    pathId: string,
    quizScore?: number
  ): LessonCompletionResult {
    const lesson = this.lessonProvider.getLesson(lessonId);
    const xpAwarded = lesson
      ? lesson.xpReward + computeQuizXpBonus(quizScore)
      : computeLessonXp(quizScore);
    const gemsAwarded = lesson
      ? lesson.gemReward + computeQuizGemBonus(quizScore)
      : computeLessonGems(quizScore);

    const completedAt = new Date().toISOString();
    const existing = this.progressProvider.getProgress(lessonId);
    const startedAt = existing?.startedAt ?? completedAt;

    const progress: LessonProgress = {
      lessonId,
      pathId,
      status: 'complete',
      startedAt,
      completedAt,
      quizScore: quizScore ?? null,
      xpEarned: xpAwarded,
      gemsEarned: gemsAwarded,
    };
    this.progressProvider.saveProgress(progress);

    const pathCompleted = this.isPathComplete(pathId);
    const path = this.lessonProvider.getPath(pathId);
    const pathCompletionBonusXp = pathCompleted
      ? path?.completionXP ?? PATH_COMPLETION_XP
      : 0;
    const pathCompletionBonusGems = pathCompleted
      ? path?.completionGems ?? PATH_COMPLETION_GEMS
      : 0;

    const newBadgesUnlocked: string[] = [];
    if (pathCompleted && path) {
      newBadgesUnlocked.push(path.completionBadgeId);
    }
    if (quizScore === 1.0) {
      newBadgesUnlocked.push('perfect_quiz_score');
    }

    return {
      xpAwarded,
      gemsAwarded,
      pathCompleted,
      pathCompletionBonusXp,
      pathCompletionBonusGems,
      newBadgesUnlocked,
    };
  }

  /** Find the next lesson the user should tap. */
  getNextRecommendedLesson(
    mode: UserMode,
    companionType?: CompanionType,
    phase?: Phase,
    dayInCycle?: number,
    streakCount?: number
  ): RenderedLesson | null {
    const paths = this.getAllPaths(mode);

    // Prefer paths the user has started but not finished
    const startedPath = paths.find(p => {
      const lessons = this.lessonProvider.getLessonsForPath(p.id);
      const anyStarted = lessons.some(l =>
        this.progressProvider.getProgress(l.id) !== null
      );
      const allComplete = lessons.every(l => {
        const lp = this.progressProvider.getProgress(l.id);
        return lp?.status === 'complete';
      });
      return anyStarted && !allComplete;
    });

    const targetPath = startedPath ?? paths.find(p => !this.isPathComplete(p.id));
    if (!targetPath) return null;

    const pathLessons = this.lessonProvider.getLessonsForPath(targetPath.id);
    const nextLesson = pathLessons.find(l => {
      const lp = this.progressProvider.getProgress(l.id);
      return lp?.status !== 'complete';
    });

    if (!nextLesson) return null;

    if (
      companionType &&
      phase &&
      dayInCycle !== undefined &&
      streakCount !== undefined
    ) {
      return this.getLesson(nextLesson.id, companionType, phase, dayInCycle, streakCount);
    }

    return {
      lesson: nextLesson,
      pathId: targetPath.id,
      companionIntro: nextLesson.title,
      progress: this.progressProvider.getProgress(nextLesson.id),
      isLocked: this.isLessonLocked(nextLesson, pathLessons),
      estimatedReadMinutes: estimateLessonMinutes(nextLesson),
    };
  }

  // ─── INTERNAL HELPERS ───────────────────────────────────────────

  /** Compute progress overlay for a single path. */
  private renderPath(path: LearningPath): RenderedPath {
    const lessons = this.lessonProvider.getLessonsForPath(path.id);
    const totalCount = lessons.length;
    const completedCount = lessons.filter(l => {
      const p = this.progressProvider.getProgress(l.id);
      return p?.status === 'complete';
    }).length;

    const percentComplete =
      totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const nextLesson = lessons.find(l => {
      const p = this.progressProvider.getProgress(l.id);
      return p?.status !== 'complete';
    });

    return {
      path,
      completedCount,
      totalCount,
      percentComplete,
      nextLessonId: nextLesson?.id ?? null,
    };
  }

  /**
   * A lesson is locked if any PRIOR lesson in the same path (by `order`)
   * is not yet complete. First lesson is always unlocked.
   */
  private isLessonLocked(lesson: Lesson, pathLessons: Lesson[]): boolean {
    if (lesson.order === 1) return false;

    const prevLessons = pathLessons.filter(l => l.order < lesson.order);
    return prevLessons.some(l => {
      const progress = this.progressProvider.getProgress(l.id);
      return progress?.status !== 'complete';
    });
  }
}

// ─── REWARD CONSTANTS ────────────────────────────────────────────────

const BASE_LESSON_XP = 25;
const BASE_LESSON_GEMS = 5;
const QUIZ_BONUS_XP_MAX = 25;
const QUIZ_BONUS_GEMS_MAX = 5;
const PATH_COMPLETION_XP = 100;
const PATH_COMPLETION_GEMS = 25;

function computeLessonXp(quizScore?: number): number {
  return BASE_LESSON_XP + computeQuizXpBonus(quizScore);
}

function computeLessonGems(quizScore?: number): number {
  return BASE_LESSON_GEMS + computeQuizGemBonus(quizScore);
}

function computeQuizXpBonus(quizScore?: number): number {
  if (quizScore === undefined) return 0;
  return Math.round(quizScore * QUIZ_BONUS_XP_MAX);
}

function computeQuizGemBonus(quizScore?: number): number {
  if (quizScore === undefined) return 0;
  return Math.round(quizScore * QUIZ_BONUS_GEMS_MAX);
}

// ─── READ TIME ESTIMATE ──────────────────────────────────────────────

/**
 * Read time estimate from a Lesson's sections (~200 wpm, min 1 minute).
 * Used as a friendly UI hint ("3 min read"). Falls back to the lesson's
 * own `estimatedMinutes` field when sections aren't available.
 */
function estimateLessonMinutes(lesson: Lesson): number {
  if (lesson.estimatedMinutes && lesson.estimatedMinutes > 0) {
    return lesson.estimatedMinutes;
  }
  if (lesson.body) {
    return estimateMinutesFromText(lesson.body);
  }
  if (lesson.sections && lesson.sections.length > 0) {
    const totalText = lesson.sections.map(s => s.content).join(' ');
    return estimateMinutesFromText(totalText);
  }
  return 1;
}

function estimateMinutesFromText(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

// ─── VALIDATION ──────────────────────────────────────────────────────

/**
 * Validate that a learning path is well-formed.
 * Used by tests and content-update tooling.
 *
 * Note: this version validates against the LessonProvider rather than
 * a `path.lessons[]` field, since paths reference lessons by `pathId`
 * relationship (not embedded arrays).
 */
export function validateLearningPath(
  path: LearningPath,
  lessons: Lesson[]
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!path.id) errors.push('Path missing id');
  if (!path.title) errors.push(`Path ${path.id || '(no id)'} missing title`);

  const pathLessons = lessons.filter(l => l.pathId === path.id);
  if (pathLessons.length === 0) {
    errors.push(`Path ${path.id} has no lessons in provided lesson list`);
    return { ok: false, errors };
  }

  // Check unique lesson IDs within the path
  const seenIds = new Set<string>();
  for (const lesson of pathLessons) {
    if (!lesson.id) errors.push(`Lesson in path ${path.id} missing id`);
    if (seenIds.has(lesson.id)) {
      errors.push(`Path ${path.id} has duplicate lesson id: ${lesson.id}`);
    }
    seenIds.add(lesson.id);

    if (!lesson.title) errors.push(`Lesson ${lesson.id} missing title`);
    if (!lesson.sections || lesson.sections.length === 0) {
      errors.push(`Lesson ${lesson.id} has no sections`);
    }
    if (typeof lesson.order !== 'number') {
      errors.push(`Lesson ${lesson.id} missing or invalid order`);
    }
  }

  // Check order is sequential starting from 1
  const orders = [...pathLessons].map(l => l.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push(
        `Path ${path.id} has non-sequential order: expected ${i + 1}, got ${orders[i]}`
      );
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}