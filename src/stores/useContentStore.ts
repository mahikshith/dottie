/**
 * Dottie — Content Store
 *
 * Holds the per-session content engine instances and the rendered
 * content for the current home screen (today's Daily Decode + questions).
 *
 * ─── ENGINE LIFECYCLE ───────────────────────────────────────────────
 *
 *  Engines are created ONCE during hydration with the shared
 *  ContentResolver and bound providers. They live in the store for
 *  the entire app session. Screens access them via getters and call
 *  methods directly — no re-instantiation per render.
 *
 *  This is critical for performance: ContentResolver maintains the
 *  session cache, DailyDecodeEngine maintains the per-day rendered
 *  cache, and QuestionEngine tracks answered-today in memory. Throwing
 *  these away on every render would invalidate every cache.
 *
 * ─── RENDERED CONTENT ───────────────────────────────────────────────
 *
 *  `todaysCard` and `todaysQuestions` are the UI-ready versions of
 *  today's content. The home screen reads them via selectors with zero
 *  computation.
 *
 *  `refreshTodaysContent()` is called by the home screen on mount AND
 *  whenever a relevant input changes (phase transition, symptom logged,
 *  question answered, companion changed). It's a no-op when the inputs
 *  haven't actually changed thanks to the engines' internal caching.
 */

import { create } from 'zustand';
import {
  ContentResolver,
  DailyDecodeEngine,
  QuestionEngine,
  LessonEngine,
  QuizEngine,
  RenderedDailyDecode,
  RenderedQuestion,
} from '../engine/content';
import { MoodCondition } from '../types/companion.types';
import { useUserStore } from './useUserStore';
import { useCycleStore } from './useCycleStore';
import { useGamificationStore } from './useGamificationStore';
import { checkinRepository } from '../database/repositories/checkin.repo';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface ContentStoreState {
  // ─── Engine instances (set once at hydration) ─────────────────��
  contentResolver: ContentResolver | null;
  dailyDecodeEngine: DailyDecodeEngine | null;
  questionEngine: QuestionEngine | null;
  lessonEngine: LessonEngine | null;
  quizEngine: QuizEngine | null;

  // ─── Rendered content for the home screen ───────────────────────
  todaysCard: RenderedDailyDecode | null;
  todaysQuestions: RenderedQuestion[];
  answeredQuestionIds: string[];

  /** True once the engines are initialized (post-hydration). */
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Re-render today's content. Cheap — caches inside the engines mean
   * subsequent calls hit memory after the first compute.
   */
  refreshTodaysContent: (options?: RefreshOptions) => RenderedSnapshot;

  /**
   * Record an answer to a phase question. Persists to SQLite AND marks
   * the question as answered in the engine so it disappears from the
   * remaining pool.
   */
  answerQuestion: (
    questionId: string,
    response: { value: string; index?: number | null },
    metadata?: { trackedMetric?: string; stateKey?: string }
  ) => Promise<void>;

  /**
   * Prefetch tomorrow's content + phase-transition content. Should be
   * called after a successful check-in to make the next morning instant.
   */
  prefetchTomorrow: () => void;

  /**
   * Clear today's cache (e.g., on midnight rollover). Engines drop their
   * per-day state; next refreshTodaysContent rebuilds from scratch.
   */
  resetForNewDay: (newDate: string) => void;

  /** Reset state (called by user.deleteAccount()). */
  reset: () => void;
}

// ─── OPTION / RESULT TYPES ───────────────────────────────────────────

export interface RefreshOptions {
  /** Override today's date (mostly for testing). */
  today?: string;
  /** Force a specific mood (overrides auto-detection). */
  forceMood?: MoodCondition;
}

export interface RenderedSnapshot {
  card: RenderedDailyDecode | null;
  questions: RenderedQuestion[];
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  contentResolver: null as ContentResolver | null,
  dailyDecodeEngine: null as DailyDecodeEngine | null,
  questionEngine: null as QuestionEngine | null,
  lessonEngine: null as LessonEngine | null,
  quizEngine: null as QuizEngine | null,
  todaysCard: null as RenderedDailyDecode | null,
  todaysQuestions: [] as RenderedQuestion[],
  answeredQuestionIds: [] as string[],
  hydrated: false,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useContentStore = create<ContentStoreState>((set, get) => ({
  ...initialState,

  // ─── refreshTodaysContent ───────────────────────────────────────

  refreshTodaysContent: (options) => {
    const { dailyDecodeEngine, questionEngine, answeredQuestionIds } = get();
    if (!dailyDecodeEngine || !questionEngine) {
      return { card: null, questions: [] };
    }

    const today = options?.today ?? new Date().toISOString().split('T')[0]!;
    const inputs = gatherEngineInputs(today, options?.forceMood);
    if (!inputs) {
      return { card: null, questions: [] };
    }

    // Render Daily Decode — falls back to built-in defaults if cohort
    // table has no card registered for this state yet.
    const card =
      dailyDecodeEngine.getTodaysCard({ ...inputs, today }) ??
      dailyDecodeEngine.getFallbackCard({ ...inputs, today });

    // Render today's questions (filters out already-answered)
    const questions = questionEngine.getTodaysQuestions({
      ...inputs,
      today,
      answeredToday: answeredQuestionIds,
    });

    set({ todaysCard: card, todaysQuestions: questions });
    return { card, questions };
  },

  // ─── answerQuestion ─────────────────────────────────────────────

  answerQuestion: async (questionId, response, metadata) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0]!;

    // Persist the answer
    await checkinRepository.saveQuestionAnswer({
      userId,
      date: today,
      questionId,
      stateKey: metadata?.stateKey,
      tracksMetric: (metadata?.trackedMetric as never) ?? null,
      responseValue: response.value,
      responseIndex: response.index ?? null,
    });

    // Mark in-engine so it filters from today's pool
    get().questionEngine?.markAnswered(questionId, today);

    // Update local answered list
    const nextAnswered = Array.from(
      new Set([...get().answeredQuestionIds, questionId])
    );
    set({ answeredQuestionIds: nextAnswered });

    // Re-render today's questions (cheap — cache hit, just filters)
    get().refreshTodaysContent({ today });

    // Award the symptom_log XP if this question tracks a metric
    if (metadata?.trackedMetric) {
      try {
        await useGamificationStore.getState().awardXp('symptom_log');
      } catch {
        // Non-fatal — never block question answer on gamification failure
      }
    }
  },

  // ─── prefetchTomorrow ───────────────────────────────────────────

  prefetchTomorrow: () => {
    const { contentResolver } = get();
    if (!contentResolver) return;

    const cycleState = useCycleStore.getState();
    const userMode = useUserStore.getState().user?.mode ?? 'adult';
    const phase = cycleState.latestPrediction?.currentPhase ?? 'follicular';
    const dayInPhase = cycleState.latestPrediction?.dayInPhase ?? 1;

    // Compute days until next period for transition detection
    const cycleLen = useUserStore.getState().user?.healthProfile.averageCycleLength ?? 28;
    const dayInCycle = cycleState.latestPrediction?.dayInCycle ?? 1;
    const cycleDaysRemaining = Math.max(0, cycleLen - dayInCycle);

    const futureStateKeys = contentResolver.predictFutureStates({
      phase,
      dayInPhase,
      mode: userMode,
      recentSymptoms: cycleState.recentSymptoms,
      cycleDaysRemaining,
    });

    contentResolver.prefetch(futureStateKeys);
  },

  // ─── resetForNewDay ─────────────────────────────────────────────

  resetForNewDay: (newDate) => {
    const { dailyDecodeEngine, questionEngine, contentResolver } = get();
    dailyDecodeEngine?.clearDailyCache();
    questionEngine?.clearForDate(newDate);
    contentResolver?.clearSession();
    set({
      todaysCard: null,
      todaysQuestions: [],
      answeredQuestionIds: [],
    });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    const { contentResolver, dailyDecodeEngine, questionEngine } = get();
    contentResolver?.clearAll();
    dailyDecodeEngine?.clearDailyCache();
    questionEngine?.clearAll();
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectTodaysCard = (s: ContentStoreState): RenderedDailyDecode | null =>
  s.todaysCard;

export const selectTodaysQuestions = (s: ContentStoreState): RenderedQuestion[] =>
  s.todaysQuestions;

export const selectAnsweredQuestionIds = (s: ContentStoreState): string[] =>
  s.answeredQuestionIds;

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

/**
 * Gather all the cross-store inputs the content engines need to render.
 * Returns null if a critical input is missing (e.g., no user yet).
 */
function gatherEngineInputs(
  today: string,
  forceMood?: MoodCondition
): EngineInputs | null {
  const userState = useUserStore.getState();
  const cycleState = useCycleStore.getState();
  const gamState = useGamificationStore.getState();

  if (!userState.user) return null;

  const companionType = userState.companionConfig?.type ?? 'blossom';
  const mode = userState.user.mode;
  const phase = cycleState.latestPrediction?.currentPhase ?? 'follicular';
  const dayInPhase = cycleState.latestPrediction?.dayInPhase ?? 1;
  const dayInCycle = cycleState.latestPrediction?.dayInCycle ?? 1;
  const streakCount = gamState.streak.currentStreak;

  // Build mood conditions from current behavior signals
  const activeConditions: MoodCondition[] = [];
  if (forceMood) {
    activeConditions.push(forceMood);
  } else {
    // First open today / checked in today
    const checkedInToday =
      cycleState.todayCheckIn !== null ||
      gamState.streak.lastCheckInDate === today;
    if (checkedInToday) activeConditions.push('checked_in_today');

    // Cramp freeze used
    if (gamState.streak.crampFreezeUsedToday) activeConditions.push('cramp_freeze_used');

    // Inactivity signals (gentle, never punishing)
    if (gamState.streak.lastCheckInDate) {
      const lastDate = new Date(gamState.streak.lastCheckInDate + 'T00:00:00');
      const now = new Date(today + 'T00:00:00');
      const daysSince = Math.round((now.getTime() - lastDate.getTime()) / 86400000);
      if (daysSince >= 5) activeConditions.push('inactive_5_days');
      else if (daysSince >= 2) activeConditions.push('inactive_2_days');
    }

    // Near streak milestone (1-2 days away)
    const milestones = [3, 7, 14, 30, 50, 100];
    const nextMilestone = milestones.find(m => m > streakCount);
    if (nextMilestone && nextMilestone - streakCount <= 2) {
      activeConditions.push('near_streak_milestone');
    }
  }

  return {
    phase,
    dayInPhase,
    dayInCycle,
    mode,
    companionType,
    streakCount,
    recentSymptoms: cycleState.recentSymptoms,
    activeConditions,
  };
}

/** Shared input shape for both DailyDecodeEngine and QuestionEngine. */
interface EngineInputs {
  phase: import('../types/cycle.types').Phase;
  dayInPhase: number;
  dayInCycle: number;
  mode: import('../types/cycle.types').UserMode;
  companionType: import('../types/companion.types').CompanionType;
  streakCount: number;
  recentSymptoms: import('../engine/content').RecentSymptom[];
  activeConditions: MoodCondition[];
}