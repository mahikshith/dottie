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
  // physical / symptoms
  | 'cramps'
  | 'skin'
  | 'bloating'
  | 'headache'
  | 'cravings'
  | 'appetite'
  | 'libido'
  | 'sleep'
  | 'bbt'
  | 'cervical_mucus'
  | 'pms'
  | 'pain_tolerance'
  // energy / mind
  | 'energy'
  | 'mood'
  | 'anxiety'
  | 'stress'
  | 'focus'
  | 'confidence'
  | 'motivation'
  | 'productivity'
  | 'social_energy'
  // cycle awareness / behaviour
  | 'flow'
  | 'cycle_length'
  | 'hydration'
  | 'exercise'
  | 'reflection'
  | 'phase_awareness'
  | 'period_prediction'
  | 'period_prep';

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
  /**
   * Difficulty tier of the lesson itself. Optional for backward compat.
   * Used by the phase-aware selector to prefer beginner content for new
   * users and by the Learn tab to display a subtle tier hint. NEW in
   * Learn redesign Phase 0.
   */
  difficulty?: DifficultyTier;
  /**
   * When true, this lesson is age-gated and MUST NOT be surfaced to
   * users in `teen` mode by the phase-aware selector. Content about
   * contraception, fertility windows, and sexual health should carry
   * this flag. Belt-and-braces defence (Gemini FM-3): the selector
   * filters it out; the UI double-checks before render.
   */
  adultOnly?: boolean;
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
/**
 * Difficulty tier used by both lessons and quiz questions. The Adaptive
 * Quiz Engine (Phase 3 of the Learn redesign — see docs/LEARN-REDESIGN-*)
 * uses per-question `level` to promote/hold difficulty as the user
 * answers correctly. Lessons themselves carry a `difficulty` so the
 * Learn tab can rank/filter appropriately.
 */
export type DifficultyTier = 'beginner' | 'moderate' | 'hard';

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
  /**
   * Difficulty tier of this question. Optional for backward compat with
   * pre-Phase-0 quizzes that shipped untagged. When missing, the
   * Adaptive Quiz Engine treats the question as 'beginner'.
   */
  level?: DifficultyTier;
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

// ─── INTERACTIVE EXERCISES (Learn Quest — design-v2) ─────────────────

/**
 * The playful exercise types that widen the Learn experience beyond
 * multiple-choice quizzes (Duolingo-style). Each keeps the SAME loop the quiz
 * engine already ships — answer → instant grade → companion reaction → next —
 * but the interaction is richer. This is ADDITIVE: quizzes are untouched;
 * exercises are a parallel content kind rendered inside a lesson.
 *
 *   - pairs        → match each left item to its right item (tap-the-pairs)
 *   - order        → drag the items into the correct sequence
 *   - fill_blank   → choose the word(s) that complete a sentence
 *   - tap_diagram  → tap the correct option in a small diagram/emoji row
 *   - tap_word     → tap the right word(s) inside a sentence
 *
 * ─── ANTI-LEAK / GRADING NOTE ───────────────────────────────────────
 *
 *  Grading is by VALUE (the chosen strings / indexes), never by a hidden
 *  "correct" flag on a rendered option — so the display model can shuffle
 *  freely without exposing the answer, exactly like `RenderedQuizQuestion`
 *  drops `correctIndex`. See `src/engine/content/exercise-engine.ts`.
 */
export type ExerciseType = 'pairs' | 'order' | 'fill_blank' | 'tap_diagram' | 'tap_word';

/** Fields shared by every exercise. */
export interface ExerciseBase {
  id: string;
  /** The lesson this exercise belongs to. */
  lessonId: string;
  type: ExerciseType;
  /** Instruction / question shown at the top. */
  prompt: string;
  /** Friendly explanation revealed after answering. */
  explanation: string;
  /** Optional emoji shown with the explanation. */
  explanationEmoji?: string;
  /** Optional XP override (else the engine's per-exercise default is used). */
  xpReward?: number;
}

/** Match each left item to its correct right item. */
export interface PairsExercise extends ExerciseBase {
  type: 'pairs';
  /** Canonical aligned pairs — `left[i]` matches `right[i]`. UI shuffles the right column. */
  pairs: { left: string; right: string }[];
}

/** Arrange the items into the correct order. */
export interface OrderExercise extends ExerciseBase {
  type: 'order';
  /** Items in the CORRECT order; the UI shuffles them for display. */
  items: string[];
}

/** Choose the word(s) that fill the blank(s) in a sentence. */
export interface FillBlankExercise extends ExerciseBase {
  type: 'fill_blank';
  /** Sentence with `{{0}}`, `{{1}}` … placeholders, one per blank. */
  sentence: string;
  /** Per blank: the correct answer plus distractors (UI merges + shuffles the pool). */
  blanks: { answer: string; distractors: string[] }[];
}

/** Tap the correct option in a compact diagram / emoji row. */
export interface TapDiagramExercise extends ExerciseBase {
  type: 'tap_diagram';
  options: { label: string; emoji?: string }[];
  /** Index into `options` of the correct choice. */
  correctIndex: number;
}

/** Tap the correct word(s) inside a sentence. */
export interface TapWordExercise extends ExerciseBase {
  type: 'tap_word';
  /** The sentence split into tappable tokens. */
  tokens: string[];
  /** Indexes into `tokens` that are correct to tap. */
  correctTokenIndexes: number[];
}

export type Exercise =
  | PairsExercise
  | OrderExercise
  | FillBlankExercise
  | TapDiagramExercise
  | TapWordExercise;

/**
 * What the UI submits to be graded. Discriminated by `type`, expressed in
 * VALUES (chosen strings / indexes) so grading never needs a hidden key.
 */
export type ExerciseAnswer =
  | { type: 'pairs'; /** the right-string the user matched to each left[i] */ matched: string[] }
  | { type: 'order'; /** the item strings in the user's order */ order: string[] }
  | { type: 'fill_blank'; /** the chosen string per blank */ choices: string[] }
  | { type: 'tap_diagram'; index: number }
  | { type: 'tap_word'; tokenIndexes: number[] };

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