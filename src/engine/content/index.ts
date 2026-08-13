/**
 * Dottie — Content Engine Public API
 *
 * Barrel export for the content engine. Stores and screens import
 * from here rather than individual engine files.
 *
 *   import { ContentResolver, LessonEngine, QuizEngine } from '@/engine/content';
 *
 * ─── CHUNK 6 ADDITIONS ──────────────────────────────────────────────
 *
 *  - `LessonProvider` and `QuizProvider` interfaces are now exported so
 *    callers (like the content store) can build provider instances from
 *    the bundled content modules.
 *  - `buildBundledLessonProvider()` and `buildBundledQuizProvider()`
 *    are convenience factories that return providers backed by the
 *    static content in `src/content/learning-paths.ts` and
 *    `src/content/quizzes.ts`.
 */

// ─── CONTENT RESOLVER ────────────────────────────────────────────────
export {
  ContentResolver,
  InMemoryCohortProvider,
  buildStateKeyFromInputs,
  classifySymptomCluster,
} from './content-resolver';
export type {
  CohortProvider,
  ContentType,
  RecentSymptom,
} from './content-resolver';

// ─── DAILY DECODE ────────────────────────────────────────────────────
export {
  DailyDecodeEngine,
  validateCardPool,
} from './daily-decode';
export type {
  RenderedDailyDecode,
  DailyDecodeInput,
  DayBand,
} from './daily-decode';

// ─── PHASE QUESTIONS ─────────────────────────────────────────────────
export {
  QuestionEngine,
  validateQuestionPool,
} from './question-engine';
export type {
  RenderedQuestion,
  QuestionEngineInput,
} from './question-engine';

// ─── LESSONS ─────────────────────────────────────────────────────────
export {
  LessonEngine,
  InMemoryLessonProgressProvider,
  validateLearningPath,
} from './lesson-engine';
export type {
  LessonProgressProvider,
  LessonProvider,
  RenderedPath,
  RenderedLesson,
  LessonCompletionResult,
} from './lesson-engine';

// ─── QUIZZES ─────────────────────────────────────────────────────────
export {
  QuizEngine,
  InMemoryQuizAttemptProvider,
  validateQuiz,
} from './quiz-engine';
export type {
  QuizAttemptProvider,
  QuizProvider,
  QuizAttemptSession,
  RenderedQuizQuestion,
  SubmitAnswerResult,
  QuizResult,
} from './quiz-engine';

// ─── COMPANION DIALOGUE ──────────────────────────────────────────────
export {
  wrapInsight,
  wrapQuestion,
  selectMood,
  buildContext,
  getCompanionGreeting,
  getTimeGreeting,
} from './companion-dialogue';
export type { TimeOfDay } from './companion-dialogue';

// ─── BUNDLED CONTENT PROVIDER FACTORIES ──────────────────────────────

import type { LessonProvider } from './lesson-engine';
import type { QuizProvider } from './quiz-engine';
import type { UserMode } from '../../types/cycle.types';
import {
  LEARNING_PATHS,
  LESSONS,
  getPathsForMode as bundledGetPathsForMode,
  getLearningPath as bundledGetPath,
  getLessonsForPath as bundledGetLessonsForPath,
  getLesson as bundledGetLesson,
} from '../../content/learning-paths';
import {
  QUIZZES,
  getQuiz as bundledGetQuiz,
  getQuizForLesson as bundledGetQuizForLesson,
} from '../../content/quizzes';

/**
 * Build a LessonProvider backed by the bundled learning-paths.ts content.
 * The content store wires this into the LessonEngine at hydration.
 */
export function buildBundledLessonProvider(): LessonProvider {
  return {
    getPathsForMode: (mode: UserMode) => bundledGetPathsForMode(mode),
    getAllPaths: () => [...LEARNING_PATHS],
    getPath: (pathId: string) => bundledGetPath(pathId),
    getLessonsForPath: (pathId: string) => bundledGetLessonsForPath(pathId),
    getLesson: (lessonId: string) => bundledGetLesson(lessonId),
  };
}

/**
 * Build a QuizProvider backed by the bundled quizzes.ts content.
 * Mirror of buildBundledLessonProvider for the QuizEngine.
 */
export function buildBundledQuizProvider(): QuizProvider {
  return {
    getQuiz: (quizId: string) => bundledGetQuiz(quizId),
    getAllQuizzes: () => [...QUIZZES],
    getQuizForLesson: (lessonId: string) => bundledGetQuizForLesson(lessonId),
  };
}