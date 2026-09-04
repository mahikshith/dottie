/**
 * Dottie — Cycle Store
 *
 * Holds cycle history, the latest prediction, today's check-in, and
 * recent symptoms for the personalized content state key.
 *
 * ─── COMPUTED VIA SELECTORS ─────────────────────────────────────────
 *
 *  - currentPhase, dayInCycle, dayInPhase
 *  - prediction message (gentle, never alarming)
 *  - recentSymptoms (passed directly to ContentResolver)
 *
 * ─── ENGINE INTEGRATION ─────────────────────────────────────────────
 *
 *  The prediction engine is PURE. This store:
 *    1. Reads cycle history from cycleRepository
 *    2. Calls predictor.predictNextPeriod() with the right inputs
 *    3. Persists the result via cycleRepository.savePrediction()
 *    4. Updates store state
 *
 *  recomputePrediction() is called after EVERY cycle data mutation
 *  (logging a period, finishing a check-in, etc.) so the home screen
 *  always reflects the most up-to-date phase.
 */

import { create } from 'zustand';
import {
  CycleRecord,
  CyclePrediction,
  Phase,
} from '../types/cycle.types';
import { cycleRepository, LogPeriodInput } from '../database/repositories/cycle.repo';
import {
  checkinRepository,
  DailyCheckIn,
  UpsertCheckInInput,
  LogSymptomInput,
} from '../database/repositories/checkin.repo';
import { useUserStore } from './useUserStore';
import {
  predictNextPeriod,
  generateFullPrediction,
  getPredictionMessage,
  PredictionInput,
} from '../engine/prediction/predictor';
import {
  explainPrediction,
  PredictionExplanation,
} from '../engine/prediction/explain-prediction';
import {
  calculateCurrentPhase,
  daysUntilNextPeriod,
} from '../engine/prediction/phase-calculator';
import { RecentSymptom } from '../engine/content';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface CycleStoreState {
  /** Most recent period start (ISO YYYY-MM-DD) */
  lastPeriodStart: string | null;
  /** Last N completed cycle records, newest first */
  cycleHistory: CycleRecord[];
  /** Total number of completed cycles */
  cycleCount: number;
  /** Latest prediction snapshot */
  latestPrediction: CyclePrediction | null;
  /**
   * Human explanation of the latest prediction (how it was calculated: the
   * ± window, the standard deviation, the contributing factors). Recomputed
   * alongside `latestPrediction`, so subscribing to it is reactive AND
   * Zustand-v5-safe (a stable reference that only changes on a real recompute).
   */
  latestExplanation: PredictionExplanation | null;
  /** Signed errors from past predictions (for Bayesian self-improvement) */
  predictionErrors: number[];
  /** Symptoms from the last 7 days (used for content state key) */
  recentSymptoms: RecentSymptom[];
  /** Today's check-in row, if it exists */
  todayCheckIn: DailyCheckIn | null;
  /** True once initial DB load has completed */
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /** Log a period day. Triggers cycle record detection + re-prediction. */
  logPeriodDay: (input: Omit<LogPeriodInput, 'userId'>) => Promise<void>;

  /** Un-mark a period day — the undo for `logPeriodDay`. */
  unlogPeriodDay: (date: string) => Promise<void>;

  /** Upsert today's check-in (mood/energy/sleep). */
  saveCheckIn: (input: Omit<UpsertCheckInInput, 'userId'>) => Promise<DailyCheckIn>;

  /** Append a symptom log. Re-loads recent symptoms after. */
  logSymptom: (input: Omit<LogSymptomInput, 'userId'>) => Promise<void>;

  /** Re-run the prediction engine with the latest inputs. */
  recomputePrediction: () => Promise<CyclePrediction | null>;

  /** Reload all cycle data from SQLite (e.g. after mode change). */
  refresh: () => Promise<void>;

  /** Clear all state — called by user.deleteAccount(). */
  reset: () => void;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  lastPeriodStart: null as string | null,
  cycleHistory: [] as CycleRecord[],
  cycleCount: 0,
  latestPrediction: null as CyclePrediction | null,
  latestExplanation: null as PredictionExplanation | null,
  predictionErrors: [] as number[],
  recentSymptoms: [] as RecentSymptom[],
  todayCheckIn: null as DailyCheckIn | null,
  hydrated: false,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useCycleStore = create<CycleStoreState>((set, get) => ({
  ...initialState,

  // ─── logPeriodDay ───────────────────────────────────────────────

  logPeriodDay: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;

    // Capture the previous predicted date BEFORE we mutate cycle data,
    // so we can record the prediction error.
    const previousPrediction = get().latestPrediction;
    const previousLastPeriod = get().lastPeriodStart;

    // Persist the period day (auto-detects cycle records)
    await cycleRepository.logPeriodDay({ ...input, userId });

    // If this is a NEW period start (different from previous), and we
    // had a prediction, record how off we were.
    if (
      previousPrediction &&
      previousLastPeriod &&
      input.date !== previousLastPeriod
    ) {
      try {
        await cycleRepository.recordPredictionError(
          userId,
          previousPrediction.predictedNextPeriod,
          input.date
        );
      } catch (err) {
        logSilentFailure('cycle:recordPredictionErrorFailed', err);
      }
    }

    // Reload everything that might have changed
    const [history, count, lastPeriod, errors] = await Promise.all([
      cycleRepository.getCycleHistory(userId, 12),
      cycleRepository.getCycleCount(userId),
      cycleRepository.getLastPeriodStart(userId),
      cycleRepository.getPredictionErrors(userId, 10),
    ]);

    set({
      cycleHistory: history,
      cycleCount: count,
      lastPeriodStart: lastPeriod,
      predictionErrors: errors,
    });

    // Re-run prediction with fresh data
    await get().recomputePrediction();
  },

  // ─── unlogPeriodDay ─────────────────────────────────────────────

  unlogPeriodDay: async (date) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;

    await cycleRepository.unlogPeriodDay(userId, date);

    // Same reload as logging: removing a day can change the last period start,
    // the completed-cycle count and the whole history, so nothing is assumed.
    const [history, count, lastPeriod, errors] = await Promise.all([
      cycleRepository.getCycleHistory(userId, 12),
      cycleRepository.getCycleCount(userId),
      cycleRepository.getLastPeriodStart(userId),
      cycleRepository.getPredictionErrors(userId, 10),
    ]);

    set({
      cycleHistory: history,
      cycleCount: count,
      lastPeriodStart: lastPeriod,
      predictionErrors: errors,
    });

    // If that was the only period ever logged there is nothing left to predict
    // from; recomputePrediction() clears the explanation in that case, which is
    // correct — better an honest empty state than a stale prediction.
    await get().recomputePrediction();
  },

  // ─── saveCheckIn ────────────────────────────────────────────────

  saveCheckIn: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) throw new Error('No active user');

    const checkIn = await checkinRepository.upsertCheckIn({ ...input, userId });
    set({ todayCheckIn: checkIn });

    // Stress/sleep can influence prediction — re-run if the user provided them.
    if (input.stressLevel !== undefined || input.sleepQuality !== undefined) {
      await get().recomputePrediction();
    }

    return checkIn;
  },

  // ─── logSymptom ─────────────────────────────────────────────────

  logSymptom: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;

    await checkinRepository.logSymptom({ ...input, userId });

    // Refresh recent symptoms so the content state key updates
    const today = input.date;
    const recent = await checkinRepository.getRecentSymptoms(userId, 7, today);
    set({ recentSymptoms: recent });
  },

  // ─── recomputePrediction ────────────────────────────────────────

  recomputePrediction: async () => {
    const userId = useUserStore.getState().userId;
    const user = useUserStore.getState().user;
    if (!userId || !user) return null;

    const {
      cycleHistory,
      lastPeriodStart,
      predictionErrors,
      todayCheckIn,
    } = get();

    // No last period date = nothing to predict yet
    if (!lastPeriodStart) {
      set({ latestExplanation: null });
      return null;
    }

    const input: PredictionInput = {
      cycleHistory,
      healthProfile: user.healthProfile,
      lastPeriodStart: new Date(lastPeriodStart),
      recentStressLevel: todayCheckIn?.stressLevel ?? undefined,
      recentSleepQuality: todayCheckIn?.sleepQuality ?? undefined,
      predictionErrors,
    };

    const output = predictNextPeriod(input);
    const fullPrediction = generateFullPrediction(input);

    // Persist (append-only — history is valuable for self-improvement)
    try {
      await cycleRepository.savePrediction(userId, fullPrediction, output.predictionPhase);
    } catch (err) {
      logSilentFailure('cycle:savePredictionFailed', err);
    }

    set({
      latestPrediction: fullPrediction,
      latestExplanation: explainPrediction(input),
    });
    return fullPrediction;
  },

  // ─── refresh ────────────────────────────────────────────────────

  refresh: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0]!;
    const [
      history,
      lastPeriod,
      count,
      latestPrediction,
      errors,
      recent,
      checkIn,
    ] = await Promise.all([
      cycleRepository.getCycleHistory(userId, 12),
      cycleRepository.getLastPeriodStart(userId),
      cycleRepository.getCycleCount(userId),
      cycleRepository.getLatestPrediction(userId),
      cycleRepository.getPredictionErrors(userId, 10),
      checkinRepository.getRecentSymptoms(userId, 7, today),
      checkinRepository.getCheckIn(userId, today),
    ]);

    // Rebuild the explanation from the current model + inputs so the
    // "how it's calculated" card is populated immediately on load (not just
    // after the next mutation). Uses the same input shape recompute uses.
    const user = useUserStore.getState().user;
    const latestExplanation: PredictionExplanation | null =
      lastPeriod && user
        ? explainPrediction({
            cycleHistory: history,
            healthProfile: user.healthProfile,
            lastPeriodStart: new Date(lastPeriod),
            recentStressLevel: checkIn?.stressLevel ?? undefined,
            recentSleepQuality: checkIn?.sleepQuality ?? undefined,
            predictionErrors: errors,
          })
        : null;

    set({
      cycleHistory: history,
      lastPeriodStart: lastPeriod,
      cycleCount: count,
      latestPrediction,
      latestExplanation,
      predictionErrors: errors,
      recentSymptoms: recent,
      todayCheckIn: checkIn,
    });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

/**
 * Compute the current phase RIGHT NOW. Falls back to a "starting"
 * placeholder when the user hasn't logged a period yet.
 *
 * NOTE: This selector recomputes on every store change because it
 * reads `lastPeriodStart`. That's fine — the calculation is sub-ms.
 */
export const selectCurrentPhase = (s: CycleStoreState): Phase => {
  return s.latestPrediction?.currentPhase ?? deriveCurrentPhase(s)?.phase ?? 'follicular';
};

export const selectDayInCycle = (s: CycleStoreState): number => {
  // Owner ask (device-test): "default it to zero and once the user logs
  // in their period, we should see the day number." No lastPeriodStart =
  // no cycle to count, so return 0 rather than a fabricated day. Every
  // UI that renders this should ALSO gate on `hasCycleData`, but this
  // makes stale predictions or renders during a data-clear safe too.
  if (s.lastPeriodStart == null) return 0;
  return s.latestPrediction?.dayInCycle ?? deriveCurrentPhase(s)?.dayInCycle ?? 1;
};

export const selectDayInPhase = (s: CycleStoreState): number => {
  if (s.lastPeriodStart == null) return 0;
  return s.latestPrediction?.dayInPhase ?? deriveCurrentPhase(s)?.dayInPhase ?? 1;
};

export const selectLastPeriodStart = (s: CycleStoreState): string | null =>
  s.lastPeriodStart;

/**
 * True once the user has logged at least one period — the signal that we can
 * stop guessing and show real phase-derived content (phase bar, weather,
 * predicts, daily decode, phase questions). Until then the UI must stay honest
 * ("log your period first") rather than assuming follicular / day 1.
 */
export const selectHasCycleData = (s: CycleStoreState): boolean =>
  s.lastPeriodStart != null;

/**
 * The current prediction explanation (how the next-period date was computed).
 * A stable reference that changes only when the prediction is recomputed, so
 * it's safe to subscribe to directly under Zustand v5 (no fresh-object churn).
 */
export const selectPredictionExplanation = (
  s: CycleStoreState
): PredictionExplanation | null => s.latestExplanation;

export const selectPredictionMessage = (s: CycleStoreState): string | null => {
  if (!s.latestPrediction || !s.lastPeriodStart) return null;
  const userMode = useUserStore.getState().user?.mode ?? 'adult';
  const userHealth = useUserStore.getState().user?.healthProfile;

  // Reconstruct a minimal PredictionOutput-shape for the message helper
  const predicted = new Date(s.latestPrediction.predictedNextPeriod);

  return getPredictionMessage({
    predictedDate: predicted,
    confidence: s.latestPrediction.confidence,
    windowDays: s.latestPrediction.windowDays,
    predictedCycleLength: userHealth?.averageCycleLength ?? 28,
    predictionPhase: 1,
    factorsUsed: s.latestPrediction.factorsUsed,
    confidenceLabel:
      s.latestPrediction.confidence >= 0.8
        ? 'high'
        : s.latestPrediction.confidence >= 0.65
          ? 'good'
          : s.latestPrediction.confidence >= 0.5
            ? 'moderate'
            : 'learning',
  });

  // Touch userMode so it's not flagged as unused (keeps the selector
  // honest about the dependencies the message could grow into).
  void userMode;
};

export const selectRecentSymptoms = (s: CycleStoreState): RecentSymptom[] =>
  s.recentSymptoms;

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

/**
 * Derive the current phase from cycle history when no prediction exists
 * (e.g., immediately after onboarding, before recomputePrediction runs).
 *
 * Uses the pure phase-calculator. Returns null if we genuinely don't
 * have enough data (no last period date).
 */
function deriveCurrentPhase(
  s: CycleStoreState
): { phase: Phase; dayInCycle: number; dayInPhase: number } | null {
  if (!s.lastPeriodStart) return null;

  const userHealth = useUserStore.getState().user?.healthProfile;
  const cycleLen = userHealth?.averageCycleLength ?? 28;
  const periodLen = userHealth?.averagePeriodLength ?? 5;

  const result = calculateCurrentPhase(
    new Date(s.lastPeriodStart),
    new Date(),
    cycleLen,
    periodLen
  );

  // Touch unused for future use
  void daysUntilNextPeriod;

  return {
    phase: result.phase,
    dayInCycle: result.dayInCycle,
    dayInPhase: result.dayInPhase,
  };
}