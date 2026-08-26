/**
 * Dottie — Cycle Prediction Engine (design-v2: Bayesian upgrade)
 *
 * The HEART of Dottie. Most apps use simple arithmetic (last_period + 28).
 * We now use a REAL Bayesian model (see `bayesian-predictor.ts`): a
 * Normal-Inverse-Gamma conjugate model whose posterior predictive is a
 * Student-t distribution. It runs on-device in closed form (no ML runtime,
 * no server) and produces the predicted date PLUS a principled window +
 * confidence that widen with little data and for irregular bodies.
 *
 * This file is the domain layer around that model: it builds the population
 * prior from the health profile, applies lifestyle mean-shifts (stress/sleep)
 * and condition-based window/confidence adjustments, and maps everything to the
 * SAME PredictionOutput / CyclePrediction shapes the stores + UI already
 * consume — so this is a drop-in replacement for the old heuristic.
 *
 * KEY PRINCIPLES (unchanged):
 * - NEVER show alarming "you're late!" messages.
 * - Always provide confidence + window (honest uncertainty).
 * - Gracefully handle irregular cycles (widen, don't panic) — now this falls
 *   out of the posterior instead of being hand-tuned.
 * - Self-improving: the posterior updates as cycles are logged.
 * - All computation is LOCAL — never leaves the device.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Verify the numbers on a Node machine;
 *  a few unit tests over known cycle histories would be worth adding.
 */

import { CyclePrediction, CycleRecord, HealthProfile } from '../../types/cycle.types';
import { calculateCurrentPhase, PhaseResult } from './phase-calculator';
import {
  buildPopulationPrior,
  posteriorPredictiveCycleLength,
} from './bayesian-predictor';
import { toISODate } from '../../utils/date.utils';

// ─── CONSTANTS ───────────────────────────────────────────────────────

const LUTEAL_PHASE_LENGTH = 14; // Nearly constant for most people

// ─── PUBLIC TYPES (unchanged — drop-in compatible) ───────────────────

export interface PredictionInput {
  /** Historical cycle records (most recent first) */
  cycleHistory: CycleRecord[];
  /** User's health profile */
  healthProfile: HealthProfile;
  /** Last period start date */
  lastPeriodStart: Date;
  /** Recent stress level (1-5, from last 7 days average) */
  recentStressLevel?: number;
  /** Recent sleep quality (1-5, from last 7 days average) */
  recentSleepQuality?: number;
  /** Whether premenstrual symptoms detected in last 3 days */
  premenstrualSymptomsDetected?: boolean;
  /** Weight change in last 3 months (kg, positive = gain) */
  recentWeightChangeKg?: number;
  /** Previous prediction errors (kept for compatibility; the Bayesian
   *  posterior now self-corrects, so this is no longer applied directly) */
  predictionErrors?: number[];
}

export interface PredictionOutput {
  /** Predicted next period start date */
  predictedDate: Date;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Window of uncertainty (± days) */
  windowDays: number;
  /** Data-maturity label kept for UI continuity (1 learning → 3 mature) */
  predictionPhase: 1 | 2 | 3;
  /** Predicted cycle length used */
  predictedCycleLength: number;
  /** Factors that contributed to this prediction */
  factorsUsed: string[];
  /** Human-friendly confidence label */
  confidenceLabel: 'learning' | 'moderate' | 'good' | 'high';
}

// ─── MAIN PREDICTION FUNCTION ────────────────────────────────────────

/**
 * Generate a full cycle prediction from the Bayesian model + domain layer.
 */
export function predictNextPeriod(input: PredictionInput): PredictionOutput {
  const { cycleHistory, healthProfile, lastPeriodStart } = input;
  const cycleCount = cycleHistory.length;
  const factorsUsed: string[] = ['bayesian_nig_model'];

  // ─── 1. Posterior predictive of the next cycle length ───────────
  const prior = buildPopulationPrior({
    reportedCycleLength: healthProfile.averageCycleLength,
    age: healthProfile.age,
    conditions: healthProfile.conditions,
  });
  const cycleLengths = cycleHistory.map((c) => c.cycleLength);
  const posterior = posteriorPredictiveCycleLength(cycleLengths, prior);

  factorsUsed.push(
    cycleCount === 0 ? 'population_prior_only' : `posterior_from_${cycleCount}_cycles`
  );

  // ─── 2. Lifestyle mean-shifts (applied to the posterior mean) ────
  let meanShift = 0;
  if (input.recentStressLevel !== undefined && input.recentStressLevel >= 4) {
    meanShift += 1.5; // high stress tends to delay
    factorsUsed.push('high_stress_shift');
  }
  if (input.recentSleepQuality !== undefined && input.recentSleepQuality <= 2) {
    meanShift += 1; // poor sleep can delay ~1 day
    factorsUsed.push('poor_sleep_shift');
  }

  // ─── 3. Condition-based window / confidence adjustments ──────────
  let windowInflation = 0;
  let confidenceReduction = 0;

  if (healthProfile.conditions.includes('pcos')) {
    windowInflation += 1;
    confidenceReduction += 0.08;
    factorsUsed.push('pcos_uncertainty');
  }
  if (healthProfile.conditions.includes('thyroid')) {
    confidenceReduction += 0.04;
    factorsUsed.push('thyroid_uncertainty');
  }
  if (healthProfile.age !== null && healthProfile.age < 16) {
    confidenceReduction += 0.05;
    factorsUsed.push('teen_variability');
  }
  if (healthProfile.age !== null && healthProfile.age > 40) {
    confidenceReduction += 0.05;
    factorsUsed.push('perimenopause_consideration');
  }
  if (input.recentWeightChangeKg !== undefined && Math.abs(input.recentWeightChangeKg) > 5) {
    windowInflation += 1;
    confidenceReduction += 0.06;
    factorsUsed.push('significant_weight_change');
  }
  // Premenstrual symptoms detected → period is imminent AND signalled: narrow
  // the window and nudge confidence up.
  if (input.premenstrualSymptomsDetected) {
    windowInflation -= 1;
    confidenceReduction -= 0.05;
    factorsUsed.push('pms_detected_narrow');
  }

  // ─── 4. Final length + date ──────────────────────────────────────
  const predictedCycleLength = Math.round(posterior.mean + meanShift);
  const predictedDate = addDays(lastPeriodStart, predictedCycleLength);

  // ─── 5. Window from the posterior predictive spread (principled) ─
  // ±~1.15·SD is roughly a 75–80% band for the Student-t at these df.
  let windowDays = Math.round(posterior.std * 1.15) + windowInflation;
  windowDays = clamp(windowDays, 1, 8);

  // ─── 6. Confidence from predictive spread + data volume ──────────
  let confidence = spreadToConfidence(posterior.std);
  const dataQuality = Math.min(1, posterior.effectiveN / 6); // saturates ~6 eff. cycles
  confidence *= 0.55 + 0.45 * dataQuality; // never fully trust with little data
  confidence -= confidenceReduction;
  confidence = clamp(confidence, 0.25, 0.95);

  // ─── 7. Labels ───────────────────────────────────────────────────
  const predictionPhase: 1 | 2 | 3 = cycleCount < 2 ? 1 : cycleCount < 6 ? 2 : 3;

  let confidenceLabel: PredictionOutput['confidenceLabel'];
  if (confidence >= 0.8) confidenceLabel = 'high';
  else if (confidence >= 0.65) confidenceLabel = 'good';
  else if (confidence >= 0.5) confidenceLabel = 'moderate';
  else confidenceLabel = 'learning';

  return {
    predictedDate,
    confidence,
    windowDays,
    predictedCycleLength,
    predictionPhase,
    factorsUsed,
    confidenceLabel,
  };
}

/** Map the posterior predictive SD (days) to a base confidence. */
function spreadToConfidence(std: number): number {
  if (std <= 1.5) return 0.92;
  if (std <= 2.5) return 0.82;
  if (std <= 3.5) return 0.72;
  if (std <= 5) return 0.6;
  return 0.48;
}

// ─── PREDICTION HELPERS (public API unchanged) ───────────────────────

/**
 * Generate a complete CyclePrediction (for storage/display).
 * Combines predictor output with current phase calculation.
 */
export function generateFullPrediction(input: PredictionInput): CyclePrediction {
  const prediction = predictNextPeriod(input);
  const avgPeriodLength = input.healthProfile.averagePeriodLength || 5;

  const phaseResult: PhaseResult = calculateCurrentPhase(
    input.lastPeriodStart,
    new Date(),
    prediction.predictedCycleLength,
    avgPeriodLength
  );

  // Ovulation ≈ next period − 14 days (luteal phase is near-constant).
  const ovulationDate = addDays(prediction.predictedDate, -LUTEAL_PHASE_LENGTH);

  return {
    predictedNextPeriod: toISODate(prediction.predictedDate),
    confidence: prediction.confidence,
    windowDays: prediction.windowDays,
    currentPhase: phaseResult.phase,
    dayInPhase: phaseResult.dayInPhase,
    dayInCycle: phaseResult.dayInCycle,
    predictedOvulation: toISODate(ovulationDate),
    factorsUsed: prediction.factorsUsed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Error in days between a prediction and the actual period start.
 * (positive = period came later than predicted). Kept for the store's
 * accuracy log; the Bayesian posterior now self-corrects from cycle data.
 */
export function calculatePredictionError(predictedDate: Date, actualDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((actualDate.getTime() - predictedDate.getTime()) / msPerDay);
}

/**
 * Human-friendly prediction message. NEVER alarming. Always supportive.
 */
export function getPredictionMessage(prediction: PredictionOutput): string {
  const daysUntil = Math.round(
    (prediction.predictedDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  if (daysUntil < 0) {
    return `Your period might arrive any day now. Every body has its own rhythm 💛`;
  } else if (daysUntil === 0) {
    return `Your period may start today. You've got this! 🌸`;
  } else if (daysUntil <= 3) {
    return `Your period is likely in about ${daysUntil} day${daysUntil > 1 ? 's' : ''}. Time to prep! 🎒`;
  } else if (daysUntil <= 7) {
    return `About ${daysUntil} days until your next period. You're in good hands 🩷`;
  } else {
    return `Your next period is predicted around ${formatDateFriendly(prediction.predictedDate)} ✨`;
  }
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────

/** Add days to a date (returns new Date). */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Format a date in a friendly way (e.g., "Mar 15"). */
function formatDateFriendly(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
