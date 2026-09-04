/**
 * Dottie — "Dottie Predicts" Store
 *
 * Lightweight orchestrator that:
 *   1. Fetches the inputs the predicts engine needs (cycle history,
 *      latest prediction, recent symptoms, recent energy, streak)
 *   2. Computes the day-in-cycle annotation for symptom + energy
 *      entries (the engine stays cycle-math-ignorant)
 *   3. Calls the pure engine
 *   4. Caches the result so re-renders are instant
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Read-only orchestration: never writes to repos
 *  - Cache invalidated by:
 *      • Daily rollover (hydrate.ts)
 *      • New cycle saved (cycle store action will call invalidate())
 *      • New check-in / symptom (cycle store action will call invalidate())
 *      • Manual ensureToday()
 *  - The cache is scoped to (userId, date) — switching users or crossing
 *    midnight automatically misses the cache and regenerates.
 *
 * ─── MVP STANCE ─────────────────────────────────────────────────────
 *
 *  Pure on-device. No network, no backend, no analytics. Insights are
 *  generated from the user's own logs and live only in memory.
 */

import { create } from 'zustand';
import {
  DottiePredictsDeck,
} from '../types/dottie-predicts.types';
import {
  buildPredictsDeck,
  PredictsEnergyEntry,
  PredictsEngineInput,
  PredictsSymptomEntry,
} from '../engine/predicts/dottie-predicts';
import { cycleRepository } from '../database/repositories/cycle.repo';
import { checkinRepository } from '../database/repositories/checkin.repo';
import { useUserStore } from './useUserStore';
import { useGamificationStore } from './useGamificationStore';
import { addDays } from '../utils/civil-date';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface PredictsStoreState {
  /** Cached deck, or null before first generation. */
  deck: DottiePredictsDeck | null;
  /** ISO date the cached deck covers. */
  cachedDate: string | null;
  /** userId the cache belongs to — invalidates on account switch. */
  cachedUserId: string | null;
  /** True while the engine is computing. */
  isGenerating: boolean;
  /** True after first generation completes (success or empty). */
  hydrated: boolean;
  /** Most recent error, surfaced to UI for diagnostics. */
  lastError: string | null;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Ensure today's deck is loaded for the active user. Cheap to call
   * on every screen mount — if cached for the current (userId, today)
   * it's a no-op.
   */
  ensureToday: () => Promise<DottiePredictsDeck | null>;

  /** Force a regeneration (e.g., after a new check-in lands). */
  regenerate: () => Promise<DottiePredictsDeck | null>;

  /** Drop the cache (called by daily rollover). */
  invalidate: () => void;

  /** Reset store — called by user.deleteAccount(). */
  reset: () => void;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  deck: null as DottiePredictsDeck | null,
  cachedDate: null as string | null,
  cachedUserId: null as string | null,
  isGenerating: false,
  hydrated: false,
  lastError: null as string | null,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const usePredictsStore = create<PredictsStoreState>((set, get) => ({
  ...initialState,

  // ─── ensureToday ────────────────────────────────────────────────

  ensureToday: async () => {
    const today = todayISO();
    const userId = useUserStore.getState().userId;

    // No user yet → no insights. Mark hydrated so UI doesn't hang.
    if (!userId) {
      set({ deck: null, hydrated: true });
      return null;
    }

    const { deck, cachedDate, cachedUserId } = get();
    if (deck && cachedDate === today && cachedUserId === userId) {
      return deck;
    }

    return runGenerate(set, userId, today);
  },

  // ─── regenerate ─────────────────────────────────────────────────

  regenerate: async () => {
    const today = todayISO();
    const userId = useUserStore.getState().userId;
    if (!userId) {
      set({ deck: null, hydrated: true });
      return null;
    }
    return runGenerate(set, userId, today);
  },

  // ─── invalidate ─────────────────────────────────────────────────

  invalidate: () => {
    set({ deck: null, cachedDate: null, cachedUserId: null });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectPredictsDeck = (
  s: PredictsStoreState
): DottiePredictsDeck | null => s.deck;

export const selectIsPredictsHydrated = (
  s: PredictsStoreState
): boolean => s.hydrated;

export const selectIsPredictsGenerating = (
  s: PredictsStoreState
): boolean => s.isGenerating;

export const selectPredictsError = (
  s: PredictsStoreState
): string | null => s.lastError;

// ─── INTERNAL: THE GENERATE ROUTINE ──────────────────────────────────

async function runGenerate(
  set: (
    partial:
      | Partial<PredictsStoreState>
      | ((s: PredictsStoreState) => Partial<PredictsStoreState>)
  ) => void,
  userId: string,
  today: string
): Promise<DottiePredictsDeck | null> {
  set({ isGenerating: true, lastError: null });

  try {
    // Window of recent days the engine looks at. 90 days ≈ 3 cycles,
    // enough for stable pattern detection without burning memory.
    const lookbackDays = 90;
    const lookbackStart = addDays(today, -lookbackDays);

    // Parallel reads — these don't depend on each other.
    const [
      cycleHistory,
      latestPrediction,
      symptomLogs,
      checkIns,
    ] = await Promise.all([
      cycleRepository.getCycleHistory(userId, 12),
      cycleRepository.getLatestPrediction(userId),
      checkinRepository.getSymptomsInRange(userId, lookbackStart, today),
      checkinRepository.getCheckInsInRange(userId, lookbackStart, today),
    ]);

    // Annotate each symptom / energy with its day-in-cycle, computed
    // from the cycle history. Engine stays cycle-math-ignorant.
    const recentSymptoms: PredictsSymptomEntry[] = symptomLogs.map(s => ({
      symptomType: s.symptomType,
      severity: s.severity,
      date: s.date,
      dayInCycleAtLog: computeDayInCycle(s.date, cycleHistory),
      phaseAtLog: s.phaseAtLog as PredictsSymptomEntry['phaseAtLog'],
    }));

    const recentEnergy: PredictsEnergyEntry[] = checkIns
      .filter(c => c.energyLevel !== null)
      .map(c => ({
        date: c.date,
        energyLevel: c.energyLevel as number,
        dayInCycleAtLog: computeDayInCycle(c.date, cycleHistory),
      }));

    const currentStreakDays =
      useGamificationStore.getState().streak.currentStreak ?? 0;

    const input: PredictsEngineInput = {
      date: today,
      cycleHistory,
      latestPrediction,
      recentSymptoms,
      recentEnergy,
      currentStreakDays,
    };

    const deck = buildPredictsDeck(input);

    set({
      deck,
      cachedDate: today,
      cachedUserId: userId,
      isGenerating: false,
      hydrated: true,
    });

    return deck;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSilentFailure('predicts.generate', message);
    set({
      isGenerating: false,
      hydrated: true,
      lastError: message,
    });
    return null;
  }
}

// ─── INTERNAL: CYCLE-MATH UTILITIES ──────────────────────────────────

/**
 * Given an ISO date and the user's cycle history (newest first),
 * compute which day-in-cycle that date falls on (1-indexed).
 *
 *  - Picks the most recent cycle whose start_date ≤ date.
 *  - Returns null when the date is older than any known cycle.
 *
 * NOTE: This duplicates a small slice of cycle math that the
 * prediction engine also knows. Centralizing further isn't worth it
 * until a third caller needs it — for now we keep this local.
 */
function computeDayInCycle(
  date: string,
  cycleHistory: import('../types/cycle.types').CycleRecord[]
): number | null {
  if (cycleHistory.length === 0) return null;

  // cycleHistory is newest first — find first cycle whose start ≤ date
  for (const c of cycleHistory) {
    if (c.startDate <= date) {
      const day = daysBetween(c.startDate, date) + 1;
      // Clamp within plausible cycle length to avoid huge numbers when
      // a date falls in a later (unrecorded) cycle.
      if (day > c.cycleLength * 1.6) return null;
      return day;
    }
  }
  return null;
}

// ─── INTERNAL: TINY HELPERS ──────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}



function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}
