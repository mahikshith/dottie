/**
 * Dottie — "Dottie Predicts" Engine (Pure)
 *
 * Takes the user's own data → produces a ranked deck of warm insights.
 *
 * ─── PURITY CONTRACT ────────────────────────────────────────────────
 *
 *  buildPredictsDeck(input) is a pure function:
 *    - Same input → same deck, deterministically
 *    - No singletons, no IO, no side effects
 *    - The store orchestrates fetching the input from repos
 *
 *  This makes the engine trivial to test and lets us swap data sources
 *  later (e.g., adding a "what-if Sisterhood says X" enrichment)
 *  without touching the engine's contract.
 *
 * ─── INPUT SHAPE ────────────────────────────────────────────────────
 *
 *  We accept the *minimal* shape each generator needs, NOT raw repo
 *  rows. That decouples the engine from the storage layer — if
 *  cycle.repo's shape evolves, this engine doesn't shift.
 *
 * ─── EMPTY-STATE PHILOSOPHY ─────────────────────────────────────────
 *
 *  Fewer than 2 completed cycles → only consistency_celebration is
 *  eligible (and only if there's a real streak). Everything else
 *  needs ≥ 2 cycles to make honest claims.
 *
 *  An empty deck is a VALID state. The UI handles it gracefully with
 *  "Dottie is still learning your rhythm" — never filler insights.
 */

import {
  DottieInsight,
  DottiePredictsDeck,
  INSIGHT_PRIORITY,
  MAX_INSIGHTS_PER_DAY,
  MIN_INSIGHT_CONFIDENCE,
} from '../../types/dottie-predicts.types';
import { CyclePrediction, CycleRecord, Phase } from '../../types/cycle.types';
import {
  buildConsistencyCelebration,
  buildCrampWindowAhead,
  buildCycleIrregularityGentle,
  buildCycleRegularityPraise,
  buildEnergyDipAhead,
  buildFocusPeakToday,
  buildPeriodCountdown,
  buildSkinClearWindow,
} from './templates';

// ─── INPUT SHAPES ────────────────────────────────────────────────────

/**
 * The slice of a symptom log the engine needs.
 * `dayInCycleAtLog` is computed by the store from the cycle history,
 * keeping the engine ignorant of cycle math.
 */
export interface PredictsSymptomEntry {
  /** Lowercase symptom type as stored in symptom_logs (e.g., "cramps"). */
  symptomType: string;
  /** Severity 1–10. */
  severity: number;
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** What day of the user's cycle this fell on (1-indexed). null if unknown. */
  dayInCycleAtLog: number | null;
  /** Which phase it was logged in, if known. */
  phaseAtLog: Phase | null;
}

/**
 * Energy snapshot for one check-in.
 * Engine uses these to predict the typical "dip" day for the user.
 */
export interface PredictsEnergyEntry {
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** 1–5. */
  energyLevel: number;
  /** What day of the user's cycle this fell on (1-indexed). null if unknown. */
  dayInCycleAtLog: number | null;
}

/**
 * Complete input to the engine. The store assembles this from repos
 * before calling buildPredictsDeck().
 */
export interface PredictsEngineInput {
  /** ISO date the deck is for (typically today). */
  date: string;
  /** Cycle records, newest first (CycleRepository.getCycleHistory). */
  cycleHistory: CycleRecord[];
  /** Latest cached prediction from the prediction engine. */
  latestPrediction: CyclePrediction | null;
  /** Recent symptoms (last 90d ideal). */
  recentSymptoms: PredictsSymptomEntry[];
  /** Recent check-ins with energy readings (last 90d ideal). */
  recentEnergy: PredictsEnergyEntry[];
  /** Current consecutive check-in streak — feeds celebration insight. */
  currentStreakDays: number;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Build today's deck of insights for the user.
 *
 * Always returns a deck (possibly with empty `insights`). The UI knows
 * to handle empty decks gracefully via the `isLearning` flag.
 */
export function buildPredictsDeck(input: PredictsEngineInput): DottiePredictsDeck {
  const generatedAt = new Date().toISOString();
  const cyclesAvailable = input.cycleHistory.length;

  const candidates: DottieInsight[] = [];

  // Every generator silently no-ops when data is too sparse.
  pushIf(candidates, tryPeriodCountdown(input));
  pushIf(candidates, tryCrampWindowAhead(input));
  pushIf(candidates, tryEnergyDipAhead(input));
  pushIf(candidates, tryFocusPeakToday(input));
  pushIf(candidates, trySkinClearWindow(input));
  pushIf(candidates, tryCycleRegularityPraise(input));
  pushIf(candidates, tryCycleIrregularityGentle(input));
  pushIf(candidates, tryConsistencyCelebration(input));

  // Filter by min confidence, then rank by priority × confidence
  const ranked = candidates
    .filter(i => i.confidence >= MIN_INSIGHT_CONFIDENCE)
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, MAX_INSIGHTS_PER_DAY);

  return {
    date: input.date,
    generatedAt,
    insights: ranked,
    isLearning: ranked.length === 0 && cyclesAvailable < 2,
    cyclesAvailable,
  };
}

// ─── INTERNAL: GENERATORS ────────────────────────────────────────────

function tryPeriodCountdown(input: PredictsEngineInput): DottieInsight | null {
  const pred = input.latestPrediction;
  if (!pred?.predictedNextPeriod) return null;
  if (input.cycleHistory.length < 1) return null;

  const days = daysBetween(input.date, pred.predictedNextPeriod);
  // Show countdown when the predicted period is within ~10 days OR today / past
  if (days > 10) return null;

  return buildPeriodCountdown(
    {
      daysUntilPeriod: Math.max(0, days),
      windowDays: Math.max(1, pred.windowDays),
      confidence: pred.confidence,
    },
    input.date
  );
}

function tryCrampWindowAhead(input: PredictsEngineInput): DottieInsight | null {
  // Pick the most-severe cramp logged in the last 60 days that has a known dayInCycle
  const cramps = input.recentSymptoms.filter(
    s => isCrampSymptom(s.symptomType) && s.dayInCycleAtLog !== null
  );
  if (cramps.length === 0) return null;
  if (input.cycleHistory.length < 1) return null;

  // Use the most recent one as the "last observed"
  cramps.sort((a, b) => (a.date > b.date ? -1 : 1));
  const lastObserved = cramps[0]!;
  const lastDay = lastObserved.dayInCycleAtLog!;

  // Where are we in the current cycle?
  const currentDayInCycle = guessCurrentDayInCycle(input);
  if (currentDayInCycle === null) return null;

  // Cycle length proxy (average) for figuring "days ahead"
  const avgCycleLen = averageCycleLength(input.cycleHistory) ?? 28;

  // Compute the day-distance to the next occurrence of the cramp day
  let daysAhead = lastDay - currentDayInCycle;
  if (daysAhead < 0) daysAhead += avgCycleLen;

  // Only surface this when it's within ~4 days (otherwise it's noise)
  if (daysAhead > 4) return null;

  // Confidence rises with severity and recency
  const severityNorm = Math.min(1, lastObserved.severity / 10);
  const cyclesObserved = input.cycleHistory.length;
  const confidence = clamp01(0.4 + 0.3 * severityNorm + 0.05 * Math.min(cyclesObserved, 4));

  return buildCrampWindowAhead(
    {
      daysAhead,
      lastObservedDayInCycle: lastDay,
      confidence,
    },
    input.date
  );
}

function tryEnergyDipAhead(input: PredictsEngineInput): DottieInsight | null {
  if (input.cycleHistory.length < 2) return null;
  if (input.recentEnergy.length < 8) return null;

  // Find the day-in-cycle with the lowest average energy
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const e of input.recentEnergy) {
    if (e.dayInCycleAtLog === null) continue;
    const b = buckets.get(e.dayInCycleAtLog) ?? { sum: 0, n: 0 };
    b.sum += e.energyLevel;
    b.n += 1;
    buckets.set(e.dayInCycleAtLog, b);
  }
  if (buckets.size < 4) return null;

  let lowestDay: number | null = null;
  let lowestAvg = Infinity;
  for (const [day, b] of buckets.entries()) {
    if (b.n < 2) continue; // need at least 2 samples for confidence
    const avg = b.sum / b.n;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestDay = day;
    }
  }
  if (lowestDay === null) return null;

  // Only surface if the dip is meaningfully below average (≤ 2.6 of 5)
  if (lowestAvg > 2.6) return null;

  const currentDayInCycle = guessCurrentDayInCycle(input);
  if (currentDayInCycle === null) return null;
  const avgCycleLen = averageCycleLength(input.cycleHistory) ?? 28;

  let daysAhead = lowestDay - currentDayInCycle;
  if (daysAhead < 0) daysAhead += avgCycleLen;
  if (daysAhead > 5) return null;

  const cyclesObserved = input.cycleHistory.length;
  const confidence = clamp01(0.45 + 0.05 * Math.min(cyclesObserved, 6) + (3 - lowestAvg) * 0.1);

  return buildEnergyDipAhead(
    {
      daysAhead,
      cyclesObserved,
      confidence,
    },
    input.date
  );
}

function tryFocusPeakToday(input: PredictsEngineInput): DottieInsight | null {
  if (input.cycleHistory.length < 2) return null;
  if (input.recentEnergy.length < 8) return null;

  // Find the day-in-cycle with the HIGHEST average energy
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const e of input.recentEnergy) {
    if (e.dayInCycleAtLog === null) continue;
    const b = buckets.get(e.dayInCycleAtLog) ?? { sum: 0, n: 0 };
    b.sum += e.energyLevel;
    b.n += 1;
    buckets.set(e.dayInCycleAtLog, b);
  }
  if (buckets.size < 4) return null;

  let bestDay: number | null = null;
  let bestAvg = -Infinity;
  for (const [day, b] of buckets.entries()) {
    if (b.n < 2) continue;
    const avg = b.sum / b.n;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = day;
    }
  }
  if (bestDay === null) return null;

  // Only meaningful if energy is genuinely high (≥ 3.8 of 5)
  if (bestAvg < 3.8) return null;

  const currentDayInCycle = guessCurrentDayInCycle(input);
  if (currentDayInCycle === null) return null;

  // Only show on the day itself (±1) — it's a "today's the day" message
  const diff = Math.abs(bestDay - currentDayInCycle);
  if (diff > 1) return null;

  const cyclesObserved = input.cycleHistory.length;
  const confidence = clamp01(0.5 + 0.05 * Math.min(cyclesObserved, 6) + (bestAvg - 3.8) * 0.15);

  return buildFocusPeakToday(
    {
      dayInCycle: bestDay,
      cyclesObserved,
      confidence,
    },
    input.date
  );
}

function trySkinClearWindow(input: PredictsEngineInput): DottieInsight | null {
  // Skin gets surfaced 2–5 days before the typical follicular sweet spot
  // (around day 8 of an average cycle). Light-touch, conservative.
  if (input.cycleHistory.length < 2) return null;
  const currentDayInCycle = guessCurrentDayInCycle(input);
  if (currentDayInCycle === null) return null;
  const avgCycleLen = averageCycleLength(input.cycleHistory) ?? 28;

  // Target day = roughly 30% through the cycle (early follicular)
  const targetDay = Math.round(avgCycleLen * 0.3);
  let daysAhead = targetDay - currentDayInCycle;
  if (daysAhead < 0) daysAhead += avgCycleLen;

  if (daysAhead > 3) return null;

  const cyclesObserved = input.cycleHistory.length;
  // Lower base confidence — this is a general pattern, not user-specific
  const confidence = clamp01(0.4 + 0.04 * Math.min(cyclesObserved, 6));

  return buildSkinClearWindow(
    {
      daysAhead,
      confidence,
    },
    input.date
  );
}

function tryCycleRegularityPraise(input: PredictsEngineInput): DottieInsight | null {
  if (input.cycleHistory.length < 3) return null;
  const lengths = input.cycleHistory.map(c => c.cycleLength);
  const avg = mean(lengths);
  const stdev = standardDeviation(lengths);

  // Regular if stdev <= 2.0 days
  if (stdev > 2.0) return null;

  const cyclesObserved = input.cycleHistory.length;
  const confidence = clamp01(0.6 + 0.06 * Math.min(cyclesObserved, 6) - stdev * 0.1);

  return buildCycleRegularityPraise(
    {
      averageLength: Math.round(avg),
      cyclesObserved,
      confidence,
    },
    input.date
  );
}

function tryCycleIrregularityGentle(input: PredictsEngineInput): DottieInsight | null {
  if (input.cycleHistory.length < 3) return null;
  const lengths = input.cycleHistory.map(c => c.cycleLength);
  const stdev = standardDeviation(lengths);

  // Irregular if stdev > 4.0 days
  if (stdev <= 4.0) return null;

  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const cyclesObserved = input.cycleHistory.length;
  // Confidence reflects how clearly irregular it is
  const confidence = clamp01(0.45 + 0.04 * Math.min(cyclesObserved, 6) + (stdev - 4) * 0.04);

  return buildCycleIrregularityGentle(
    {
      shortest,
      longest,
      cyclesObserved,
      confidence,
    },
    input.date
  );
}

function tryConsistencyCelebration(input: PredictsEngineInput): DottieInsight | null {
  if (input.currentStreakDays < 7) return null;

  // Celebrate at meaningful milestones; quiet on in-between days to
  // avoid feeling spammy. (Streak celebration modal already handles
  // single-day-of fireworks elsewhere.)
  const isMilestone =
    input.currentStreakDays === 7 ||
    input.currentStreakDays === 14 ||
    input.currentStreakDays === 30 ||
    input.currentStreakDays === 60 ||
    input.currentStreakDays === 100 ||
    input.currentStreakDays % 100 === 0;
  if (!isMilestone) return null;

  // Confidence high — this is a hard fact
  const confidence = 0.85;

  return buildConsistencyCelebration(
    {
      streakDays: input.currentStreakDays,
      confidence,
    },
    input.date
  );
}

// ─── INTERNAL: HELPERS ───────────────────────────────────────────────

function pushIf<T>(arr: T[], item: T | null): void {
  if (item !== null) arr.push(item);
}

function rankScore(i: DottieInsight): number {
  return INSIGHT_PRIORITY[i.kind] * i.confidence;
}

function isCrampSymptom(symptomType: string): boolean {
  const lowered = symptomType.toLowerCase();
  return (
    lowered === 'cramps' ||
    lowered === 'cramp' ||
    lowered === 'menstrual cramps' ||
    lowered === 'period cramps'
  );
}

/**
 * Best-effort estimate of the user's current day-in-cycle.
 * Prefers the live prediction's dayInCycle when present;
 * falls back to counting from the most recent period start.
 */
function guessCurrentDayInCycle(input: PredictsEngineInput): number | null {
  if (input.latestPrediction?.dayInCycle != null) {
    return input.latestPrediction.dayInCycle;
  }
  if (input.cycleHistory.length === 0) return null;
  const mostRecent = input.cycleHistory[0]!;
  return daysBetween(mostRecent.startDate, input.date) + 1; // 1-indexed
}

function averageCycleLength(cycles: CycleRecord[]): number | null {
  if (cycles.length === 0) return null;
  return mean(cycles.map(c => c.cycleLength));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squared = arr.map(x => (x - avg) ** 2);
  return Math.sqrt(mean(squared));
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
