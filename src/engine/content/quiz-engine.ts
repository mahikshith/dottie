/**
 * Dottie — Quiz Engine
 *
 * Handles quiz attempts for the Learn tab: randomized question selection,
 * answer validation, scoring, XP/Gem awards, and companion-wrapped
 * feedback at every step.
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────
 *
 *  User taps "Start Quiz"
 *    → QuizEngine.startAttempt(quizId, companion, phase, ...)
 *    → Engine picks N random questions from the quiz's bank
 *    → Returns QuizAttemptSession with companion encouragement
 *
 *  User answers each question
 *    → QuizEngine.submitAnswer(sessionId, questionIndex, optionIndex)
 *    → Returns SubmitAnswerResult with explanation + companion reaction
 *
 *  User finishes
 *    → QuizEngine.finishAttempt(sessionId)
 *    → Returns QuizResult with score, XP/Gems, badges, celebration line
 *    → Persists QuizAttempt via injected provider
 *
 * ─── REWARD FORMULA ─────────────────────────────────────────────────
 *
 *  Per correct answer:           5 XP, 1 gem
 *  Pass bonus (score >= 0.7):    +20 XP, +5 gems
 *  Perfect score (1.0):          +30 XP, +10 gems (in addition to pass)
 *  New best score:               +10 XP
 *
 * ─── SESSION MANAGEMENT ─────────────────────────────────────────────
 *
 *  Active sessions live in an in-memory Map. They auto-expire after
 *  30 minutes — if a user opens a quiz and walks away, we don't keep
 *  the session forever. Expired sessions are pruned on every entry.
 *
 * ─── QUIZ RESOLUTION ────────────────────────────────────────────────
 *
 *  Quizzes come from EITHER:
 *    1. The ContentResolver cohort cache (`quiz::{quizId}` key)
 *    2. A static `QuizProvider` injected at construction time
 *
 *  The MVP uses the static provider populated from
 *  `src/content/quizzes.ts`. Both sources are checked — the static
 *  provider wins if both have a quiz with the same ID (bundled content
 *  is canonical).
 */

import {
  Quiz,
  QuizQuestion,
  QuizAttempt,
} from '../../types/content.types';
import {
  CompanionType,
  CompanionMood,
  DialogueContext,
} from '../../types/companion.types';
import { Phase } from '../../types/cycle.types';
import { ContentResolver } from './content-resolver';
import {
  wrapInsight,
  buildContext,
} from './companion-dialogue';
import {
  pickAdaptiveSlate,
  seedFromSessionId,
} from '../learn/adaptive-quiz';

// ─── ATTEMPT PROVIDER INTERFACE ──────────────────────────────────────

/**
 * Pluggable persistence for quiz attempt history.
 * The SQLite repository layer implements this.
 */
export interface QuizAttemptProvider {
  saveAttempt(attempt: QuizAttempt): void;
  getAttemptsForQuiz(quizId: string): QuizAttempt[];
  /** Best score in [0.0, 1.0], or 0 if never taken */
  getBestScore(quizId: string): number;
  getAllAttempts(): QuizAttempt[];
}

/**
 * In-memory implementation for tests, dev, and Storybook.
 * Resets on app restart.
 */
export class InMemoryQuizAttemptProvider implements QuizAttemptProvider {
  private attempts: QuizAttempt[] = [];

  saveAttempt(attempt: QuizAttempt): void {
    this.attempts.push(attempt);
  }

  getAttemptsForQuiz(quizId: string): QuizAttempt[] {
    return this.attempts.filter(a => a.quizId === quizId);
  }

  getBestScore(quizId: string): number {
    const forQuiz = this.getAttemptsForQuiz(quizId);
    if (forQuiz.length === 0) return 0;
    return Math.max(...forQuiz.map(a => a.score));
  }

  getAllAttempts(): QuizAttempt[] {
    return [...this.attempts];
  }
}

// ─── QUIZ CONTENT PROVIDER ───────────────────────────────────────────

/**
 * Provides access to the bundled quiz catalog.
 * Companion file to `LessonProvider` in lesson-engine.ts.
 */
export interface QuizProvider {
  getQuiz(quizId: string): Quiz | null;
  getAllQuizzes(): Quiz[];
  getQuizForLesson(lessonId: string): Quiz | null;
}

// ─── PUBLIC RENDERED TYPES ───────────────────────────────────────────

/**
 * An active quiz attempt session — returned to the UI on quiz start.
 * Contains the randomly-selected question subset and companion intro.
 */
export interface QuizAttemptSession {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  questions: RenderedQuizQuestion[];
  startedAt: string;
  companionEncouragement: string;
}

/**
 * A question as the UI sees it — intentionally LACKS correctIndex
 * so the answer can't be leaked to the client before submission.
 */
export interface RenderedQuizQuestion {
  questionId: string;
  questionText: string;
  options: string[];
}

/**
 * Result of submitting a single answer.
 * The UI shows the explanation + companion reaction immediately.
 */
export interface SubmitAnswerResult {
  correct: boolean;
  correctOptionIndex: number;
  explanation: string;
  explanationEmoji: string;
  companionReaction: string;
  questionsRemaining: number;
}

/**
 * Final result when the attempt is finished.
 * The caller credits XP/Gems and triggers celebration animations.
 */
export interface QuizResult {
  sessionId: string;
  quizId: string;
  correctCount: number;
  totalCount: number;
  score: number; // 0.0 - 1.0
  passed: boolean;
  xpAwarded: number;
  gemsAwarded: number;
  isNewBestScore: boolean;
  companionCelebration: string;
  perQuestionResults: SubmitAnswerResult[];
}

// ─── INTERNAL SESSION STATE ──────────────────────────────────────────

interface ActiveSession {
  sessionId: string;
  quizId: string;
  quiz: Quiz;
  /** Full question objects WITH correctIndex (server-side truth) */
  questions: QuizQuestion[];
  startedAt: string;
  startedAtMs: number;
  companionType: CompanionType;
  context: DialogueContext;
  /** questionIndex → submission result (mutable across submitAnswer calls) */
  answers: Map<number, SubmitAnswerResult>;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_QUESTION_COUNT = 5;
const PASS_THRESHOLD = 0.7;

// ─── REWARD CONSTANTS ────────────────────────────────────────────────

const XP_PER_CORRECT = 5;
const GEMS_PER_CORRECT = 1;
const PASS_BONUS_XP = 20;
const PASS_BONUS_GEMS = 5;
const PERFECT_BONUS_XP = 30;
const PERFECT_BONUS_GEMS = 10;
const NEW_BEST_BONUS_XP = 10;

// ─── THE QUIZ ENGINE ─────────────────────────────────────────────────

/**
 * QuizEngine — manages quiz attempts from start to finish.
 *
 * Pure logic. Accepts a ContentResolver (forward-compat for dynamic
 * content), a QuizProvider (bundled content), and a QuizAttemptProvider
 * (persistence). Never touches I/O directly.
 */
export class QuizEngine {
  private sessions = new Map<string, ActiveSession>();

  constructor(
    private resolver: ContentResolver,
    private attemptProvider: QuizAttemptProvider,
    private quizProvider: QuizProvider
  ) {}

  // ─── QUIZ LOOKUP ────────────────────────────────────────────────

  /** Get a quiz by ID. Checks bundled provider first, then cohort cache. */
  getQuiz(quizId: string): Quiz | null {
    // 1. Bundled content (canonical)
    const bundled = this.quizProvider.getQuiz(quizId);
    if (bundled) return normalizeQuiz(bundled);

    // 2. Dynamic / cohort-loaded quizzes (fallback)
    const key = `quiz::${quizId}`;
    const dynamic = this.resolver.resolve<Quiz>(key, 'quiz');
    return dynamic ? normalizeQuiz(dynamic) : null;
  }

  /** Best score in [0, 1]; 0 if never taken. */
  getBestScore(quizId: string): number {
    return this.attemptProvider.getBestScore(quizId);
  }

  /** Has the user ever passed this quiz? */
  hasPassedQuiz(quizId: string): boolean {
    return this.getBestScore(quizId) >= PASS_THRESHOLD;
  }

  /** Total number of attempts for this quiz (for UI badges). */
  getAttemptCount(quizId: string): number {
    return this.attemptProvider.getAttemptsForQuiz(quizId).length;
  }

  // ─── ATTEMPT LIFECYCLE ──────────────────────────────────────────

  /**
   * Start a new quiz attempt.
   *
   * Picks `questionCount` (default from quiz.questionsPerAttempt, then 5)
   * random questions from the quiz's full bank. If the bank has fewer
   * questions, all are used.
   *
   * Returns null if the quiz doesn't exist.
   */
  startAttempt(
    quizId: string,
    companionType: CompanionType,
    phase: Phase,
    dayInCycle: number,
    streakCount: number,
    questionCount?: number,
    /**
     * Learn Redesign Phase 3 opt-in. When true, questions are picked with
     * tier awareness (beginner → moderate → hard on optimistic promotion;
     * nearest-tier fallback if a bank is skewed). Deterministic per session
     * via the session id seed. Default false so existing call sites keep the
     * random-subset behavior they had before Phase 3.
     */
    adaptive: boolean = false
  ): QuizAttemptSession | null {
    this.cleanupExpiredSessions();

    const quiz = this.getQuiz(quizId);
    if (!quiz || quiz.questions.length === 0) return null;

    const count =
      questionCount ?? quiz.questionsPerAttempt ?? DEFAULT_QUESTION_COUNT;

    const sessionId = generateSessionId();

    // Adaptive path uses the session-seeded, tier-aware selector so a first
    // question is always beginner-tier and the staircase climbs on correct
    // answers. Legacy path is a plain random subset (unchanged).
    const selected = adaptive
      ? pickAdaptiveSlate({
          bank: quiz.questions,
          count: Math.min(count, quiz.questions.length),
          seed: seedFromSessionId(sessionId),
        })
      : shuffle(quiz.questions).slice(0, Math.min(count, quiz.questions.length));
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    const context = buildContext({
      companionType,
      phase,
      dayInPhase: Math.max(1, dayInCycle),
      dayInCycle,
      streakCount,
    });

    const session: ActiveSession = {
      sessionId,
      quizId,
      quiz,
      questions: selected,
      startedAt,
      startedAtMs,
      companionType,
      context,
      answers: new Map(),
    };
    this.sessions.set(sessionId, session);

    const encouragement = wrapInsight(
      companionType,
      `Quick quiz — ${selected.length} questions, no pressure.`,
      context,
      'excited'
    );

    return {
      sessionId,
      quizId,
      quizTitle: quiz.title,
      questions: selected.map(q => ({
        questionId: q.id,
        questionText: q.text,
        options: q.options,
      })),
      startedAt,
      companionEncouragement: encouragement,
    };
  }

  /**
   * Submit an answer for a specific question in the session.
   *
   * Returns null if the session doesn't exist or has expired.
   * Returns the result with explanation + companion reaction otherwise.
   *
   * Safe to call multiple times for the same question — the LAST answer
   * is the one that counts.
   */
  submitAnswer(
    sessionId: string,
    questionIndex: number,
    selectedOptionIndex: number
  ): SubmitAnswerResult | null {
    this.cleanupExpiredSessions();

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const question = session.questions[questionIndex];
    if (!question) return null;

    const correct = selectedOptionIndex === question.correctIndex;

    const reactionMood: CompanionMood = correct ? 'celebrating' : 'supportive';
    const reactionSeed = correct
      ? 'Nice — you got it!'
      : "That's okay — every answer is a step forward.";

    const companionReaction = wrapInsight(
      session.companionType,
      reactionSeed,
      session.context,
      reactionMood
    );

    // Calculate remaining: total - (answered set size + 1 if this is new)
    const isNewAnswer = !session.answers.has(questionIndex);
    const questionsRemaining =
      session.questions.length - (session.answers.size + (isNewAnswer ? 1 : 0));

    const result: SubmitAnswerResult = {
      correct,
      correctOptionIndex: question.correctIndex,
      explanation: question.explanation,
      explanationEmoji: question.explanationEmoji ?? (correct ? '✨' : '💡'),
      companionReaction,
      questionsRemaining: Math.max(0, questionsRemaining),
    };

    session.answers.set(questionIndex, result);
    return result;
  }

  /**
   * Finish the attempt — calculates final score, awards XP/Gems,
   * persists the QuizAttempt record via the provider.
   *
   * Returns null if the session doesn't exist or has expired.
   * Caller is responsible for crediting XP/Gems and showing celebration UI.
   */
  finishAttempt(sessionId: string): QuizResult | null {
    this.cleanupExpiredSessions();

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Gather per-question results in question order
    const perQuestionResults: SubmitAnswerResult[] = [];
    let correctCount = 0;
    for (let i = 0; i < session.questions.length; i++) {
      const result = session.answers.get(i);
      if (result) {
        perQuestionResults.push(result);
        if (result.correct) correctCount++;
      }
    }

    const totalCount = session.questions.length;
    const score = totalCount === 0 ? 0 : correctCount / totalCount;
    const passingScore = session.quiz.passingScore ?? PASS_THRESHOLD;
    const passed = score >= passingScore;

    const previousBest = this.attemptProvider.getBestScore(session.quizId);
    const isNewBestScore = score > previousBest;

    const { xpAwarded, gemsAwarded } = computeQuizRewards({
      correctCount,
      score,
      passed,
      isNewBestScore,
    });

    const celebrationMood: CompanionMood = passed ? 'celebrating' : 'supportive';
    const celebrationSeed = buildCelebrationSeed(score, passed, isNewBestScore);
    const companionCelebration = wrapInsight(
      session.companionType,
      celebrationSeed,
      session.context,
      celebrationMood
    );

    // Persist the attempt
    const attempt: QuizAttempt = {
      id: sessionId,
      quizId: session.quizId,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      correctCount,
      totalCount,
      score,
      passed,
      xpEarned: xpAwarded,
      gemsEarned: gemsAwarded,
    };
    this.attemptProvider.saveAttempt(attempt);

    // Drop the session — it's done
    this.sessions.delete(sessionId);

    return {
      sessionId,
      quizId: session.quizId,
      correctCount,
      totalCount,
      score,
      passed,
      xpAwarded,
      gemsAwarded,
      isNewBestScore,
      companionCelebration,
      perQuestionResults,
    };
  }

  /** Abandon a session without finishing. No persistence, no rewards. */
  abandonSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ─── INTERNAL HELPERS ───────────────────────────────────────────

  /**
   * Drop sessions older than SESSION_TIMEOUT_MS.
   * Called on every entry point — keeps memory bounded.
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.startedAtMs > SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// ─── NORMALIZATION (back-compat shim) ────────────────────────────────

/**
 * Normalize a quiz that might have come from older content using the
 * legacy `question` field name instead of the canonical `text`.
 *
 * This is a SAFETY NET — new content should use `text`. The migration
 * happens silently here so engines never break on legacy data.
 */
function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map(normalizeQuizQuestion),
  };
}

/**
 * Normalize a single question. Reads either `text` (canonical) or
 * `question` (legacy alias) into `text`, defaults `explanationEmoji`.
 */
function normalizeQuizQuestion(q: QuizQuestion): QuizQuestion {
  // Tolerate the legacy `question` field if present
  const legacy = q as QuizQuestion & { question?: string };
  const text = q.text ?? legacy.question ?? '';

  return {
    id: q.id,
    text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    explanationEmoji: q.explanationEmoji,
  };
}

// ─── REWARD COMPUTATION ──────────────────────────────────────────────

function computeQuizRewards(args: {
  correctCount: number;
  score: number;
  passed: boolean;
  isNewBestScore: boolean;
}): { xpAwarded: number; gemsAwarded: number } {
  let xp = args.correctCount * XP_PER_CORRECT;
  let gems = args.correctCount * GEMS_PER_CORRECT;

  if (args.passed) {
    xp += PASS_BONUS_XP;
    gems += PASS_BONUS_GEMS;
  }
  if (args.score === 1.0) {
    xp += PERFECT_BONUS_XP;
    gems += PERFECT_BONUS_GEMS;
  }
  if (args.isNewBestScore) {
    xp += NEW_BEST_BONUS_XP;
  }

  return { xpAwarded: xp, gemsAwarded: gems };
}

function buildCelebrationSeed(
  score: number,
  passed: boolean,
  isNewBest: boolean
): string {
  const pct = Math.round(score * 100);
  if (score === 1.0) return `Perfect score! ${pct}%`;
  if (passed && isNewBest) return `New best score — ${pct}%`;
  if (passed) return `Nice — you passed with ${pct}%`;
  return `You finished with ${pct}% — every attempt teaches you something`;
}

// ─── UTILITIES ───────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle (clone-and-shuffle).
 * Random per call — quizzes feel fresh on retake.
 */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Generate a session ID without adding a uuid dependency. */
function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
  return `qz_${ts}_${rand}`;
}

// ─── VALIDATION ──────────────────────────────────────────────────────

/**
 * Validate that a quiz is well-formed.
 * Used by tests and content-update tooling.
 */
export function validateQuiz(quiz: Quiz): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!quiz.id) errors.push('Quiz missing id');
  if (!quiz.title) errors.push(`Quiz ${quiz.id || '(no id)'} missing title`);
  if (!quiz.lessonId) {
    errors.push(`Quiz ${quiz.id} missing lessonId reference`);
  }
  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push(`Quiz ${quiz.id} has no questions`);
    return { ok: false, errors };
  }

  const seenIds = new Set<string>();
  for (const q of quiz.questions) {
    if (!q.id) errors.push(`Question in quiz ${quiz.id} missing id`);
    if (seenIds.has(q.id)) {
      errors.push(`Quiz ${quiz.id} has duplicate question id: ${q.id}`);
    }
    seenIds.add(q.id);

    if (!q.text) errors.push(`Question ${q.id} missing text`);
    if (!q.options || q.options.length < 2) {
      errors.push(`Question ${q.id} needs at least 2 options`);
    }
    if (
      typeof q.correctIndex !== 'number' ||
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length
    ) {
      errors.push(`Question ${q.id} has invalid correctIndex`);
    }
    if (!q.explanation) {
      errors.push(`Question ${q.id} missing explanation`);
    }
  }

  return { ok: errors.length === 0, errors };
}