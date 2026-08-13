/**
 * Dottie — Content Types (Canonical)
 *
 * Type definitions for the entire content engine:
 *  - Daily Decode cards (84 unique, phase × mode × day-band)
 *  - Phase-responsive questions
 *  - Learning paths & lessons
 *  - Quiz engine
 *  - Companion dialogue templates
 *  - Lesson progress + quiz attempt records (persisted)
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  This file is the SINGLE SOURCE OF TRUTH for content shapes. The
 *  engines, repos, and screens all import from here. If two layers
 *  ever disagree on a field name, this file's shape wins.
 *
 *  Field naming convention (NEW in chunk 6):
 *    - `text`   on QuizQuestion (UI displays this)
 *    - `body`   on Lesson (markdown-style content, used by validation)
 *    - `sections` on Lesson (structured rendering, used by reader screen)
 *    - `order` on Lesson (1-indexed position in path)
 *    - `title` on Quiz (UI heading shown during the attempt)
 *
 *  Both `body` (flat text) and `sections` (structured) are supported on
 *  Lesson — UI prefers `sections` when present; engines/validation use
 *  `body` (computed from sections if not explicitly set).
 *
 * SHARED CONTEXT: Content is keyed by state_key = hash(phase, dayBand,
 * mode, cluster) so identical content serves all users in the same
 * state. Only the companion personality wrapper is personalized.
 */

import { Phase, UserMode } from './cycle.types';

// ─── DAILY DECODE CARDS ──────────────────────────────────────────────

/** Day bands within a phase (groups of days sharing similar content) */
export type DayBand = '1-3' | '4-7' | '8-11' | '12-14';

/** A single Daily Decode card — the daily phase insight */
export interface DailyDecodeCard {
  id: string;
  phase: Phase;
  mode: UserMode;
  dayBand: DayBand;
  title: string;
  body: string;
  tip: string;
  emoji: string;
  /** Companion-specific variants of the intro line */
  companionVariants: Record<CompanionType, string>;
}

// ─── PHASE-RESPONSIVE QUESTIONS ──────────────────────────────────────

/** Question response types */
export type QuestionResponseType = 'scale' | 'choice' | 'emoji' | 'slider' | 'boolean';

/** A phase-responsive question shown on home screen */
export interface PhaseQuestion {
  id: string;
  phase: Phase;
  mode: UserMode;
  text: string;
  type: QuestionResponseType;
  options: string[];
  /** Companion personality wrappers */
  companionVariants: Record<CompanionType, string>;
  /** Which symptom/metric this question maps to for data collection */
  tracksMetric: TrackedMetric;
}

/** Metrics that phase questions can track */
export type TrackedMetric =
  | 'energy'
  | 'mood'
  | 'sleep'
  | 'cramps'
  | 'skin'
  | 'cravings'
  | 'bloating'
  | 'headache'
  | 'focus'
  | 'social_energy'
  | 'libido'
  | 'anxiety';

// ─── LEARNING PATHS & LESSONS ────────────────────────────────────────

/** Learning path status */
export type PathStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/** Whether a path requires Dottie+ */
export type PathTier = 'free' | 'premium';

/** A structured learning path (collection of lessons) */
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  emoji: string;
  tier: PathTier;
  mode: UserMode | 'all';
  totalLessons: number;
  estimatedMinutes: number;
  /** Badge awarded on completion */
  completionBadgeId: string;
  /** XP awarded for full path completion */
  completionXP: number;
  /** Gems awarded for full path completion */
  completionGems: number;
  /** Color gradient for the path card */
  gradient: readonly [string, string];
}

/** A single lesson within a learning path */
export interface Lesson {
  id: string;
  pathId: string;
  /** 1-indexed position in the path */
  order: number;
  title: string;
  emoji: string;
  /** Lesson content sections (rendered in order by the reader screen) */
  sections: LessonSection[];
  /**
   * Optional flat-text body. When omitted, content tooling derives this
   * from `sections` for read-time estimation and search indexing.
   * UI rendering uses `sections` directly.
   */
  body?: string;
  /** XP awarded on lesson completion */
  xpReward: number;
  /** Gems awarded on lesson completion */
  gemReward: number;
  /** Estimated reading time in minutes */
  estimatedMinutes: number;
  /** Quiz ID associated with this lesson (null if no quiz) */
  quizId: string | null;
}

/** A content section within a lesson */
export interface LessonSection {
  type: 'heading' | 'paragraph' | 'callout' | 'fact' | 'tip' | 'image' | 'divider';
  content: string;
  /** Optional emoji for callouts/facts */
  emoji?: string;
  /** Highlight color for callouts (phase color key or custom) */
  highlight?: Phase | 'warm' | 'cool';
}

// ─── LESSON PROGRESS (persisted per user) ────────────────────────────

/** Persisted lesson progress for a single user × lesson */
export interface LessonProgress {
  lessonId: string;
  pathId: string;
  status: 'not_started' | 'in_progress' | 'complete';
  startedAt: string | null;
  completedAt: string | null;
  /** 0.0 - 1.0 if a quiz was taken with the lesson, else null */
  quizScore: number | null;
  xpEarned: number;
  gemsEarned: number;
}

// ─── QUIZ ENGINE ─────────────────────────────────────────────────────

/** A quiz associated with a lesson */
export interface Quiz {
  id: string;
  /** Human-readable title shown during the attempt UI */
  title: string;
  lessonId: string;
  /** Total questions in the bank (app picks a random subset) */
  totalQuestions: number;
  /** How many questions to show per attempt */
  questionsPerAttempt: number;
  /** Minimum score (0.0 - 1.0) to pass */
  passingScore: number;
  questions: QuizQuestion[];
}

/**
 * A single quiz question.
 *
 * Naming: `text` is the canonical field for the question prompt. The
 * old name `question` is preserved as an alias (write-only / optional)
 * so older content files don't fail to load — see `normalizeQuizQuestion`
 * in the quiz engine for the migration path.
 */
export interface QuizQuestion {
  id: string;
  /** The question prompt shown to the user */
  text: string;
  options: string[];
  /** Index of correct answer in `options` array */
  correctIndex: number;
  /** Friendly explanation shown after answering */
  explanation: string;
  /** Optional emoji shown with explanation */
  explanationEmoji?: string;
}

/**
 * Persisted record of a single quiz attempt.
 * Append-only — every attempt is preserved for history and best-score tracking.
 */
export interface QuizAttempt {
  id: string;
  quizId: string;
  startedAt: string;
  completedAt: string;
  correctCount: number;
  totalCount: number;
  /** Score in [0.0, 1.0] */
  score: number;
  passed: boolean;
  xpEarned: number;
  gemsEarned: number;
}

/**
 * Lightweight result returned to the UI after a quiz attempt.
 * Kept separate from `QuizAttempt` because the UI doesn't need the
 * `id` field and may want to render the per-question breakdown.
 */
export interface QuizResultSummary {
  quizId: string;
  score: number; // 0.0 - 1.0
  correctCount: number;
  totalCount: number;
  passed: boolean;
  xpEarned: number;
  gemsEarned: number;
  completedAt: string;
}

// ─── COMPANION TYPES (used across content) ───────────────────────────

/** Available spirit companion types */
export type CompanionType = 'fox' | 'bunny' | 'butterfly' | 'cat' | 'owl' | 'blossom';

// ─── CONTENT STATE KEY (Shared Context Cache) ────────────────────────

/**
 * The cohort content cache key.
 * All users sharing the same state_key get identical base content.
 * Personalization (companion voice, streak count) is applied locally.
 */
export interface ContentStateKey {
  phase: Phase;
  dayBand: DayBand;
  mode: UserMode;
  symptomCluster: SymptomCluster;
}

/** Top symptom clusters for content targeting */
export type SymptomCluster = 'pain' | 'fatigue' | 'mood' | 'skin' | 'none';

/**
 * Generates a string cache key from content state.
 * Example: "menstrual_1-3_teen_pain"
 */
export function buildStateKey(state: ContentStateKey): string {
  return `${state.phase}_${state.dayBand}_${state.mode}_${state.symptomCluster}`;
}

// ─── TIPS DATABASE ───────────────────────────────────────────────────

/** Tip categories */
export type TipCategory = 'nutrition' | 'exercise' | 'skin' | 'mental_health' | 'sleep' | 'general';

/** A phase-specific tip */
export interface PhaseTip {
  id: string;
  phase: Phase;
  category: TipCategory;
  title: string;
  body: string;
  emoji: string;
  /** Source citation (optional) */
  source?: string;
}

// ─── CARE NUDGE TEMPLATES ────────────────────────────────────────────

/** Situations that trigger care nudges in Sisterhood */
export type NudgeTrigger =
  | 'period_start'
  | 'low_mood'
  | 'streak_broken'
  | 'inactive_3_days'
  | 'high_pain'
  | 'custom';

/** A pre-written care nudge message */
export interface CareNudgeTemplate {
  id: string;
  trigger: NudgeTrigger;
  message: string;
  emoji: string;
}