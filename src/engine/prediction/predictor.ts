/**
 * Dottie — Multi-Factor Prediction Engine
 *
 * The HEART of Dottie. Most apps use simple arithmetic (last_period + 28).
 * We use multi-factor Bayesian prediction that improves over time.
 *
 * THREE PHASES OF ACCURACY:
 * ─────────────────────────
 * Phase 1 (Cycles 1-2): Simple average, low confidence, wide window
 * Phase 2 (Cycles 3-5): Weighted moving average (recent cycles matter more)
 * Phase 3 (Cycles 6+):  Bayesian adaptive with health/lifestyle adjustments
 *
 * KEY PRINCIPLES:
 * - NEVER show alarming "you're late!" messages
 * - Always provide confidence + window (honest uncertainty)
 * - Gracefully handle irregular cycles (widen, don't panic)
 * - Self-improving: learns from prediction errors
 * - All computation is LOCAL — never leaves device
 *
 * ACCURACY TARGETS:
 * - After 3 cycles:  ±3 days (70% accuracy)
 * - After 6 cycles:  ±2 days (80% accuracy)
 * - After 12 cycles: ±1 day  (85% accuracy)
 */

import { CyclePrediction, CycleRecord, HealthProfile, Phase } from '../../types/cycle.types';
import { calculateCurrentPhase, PhaseResult } from './phase-calculator';

// ─── CONSTANTS ───────────────────────────────────────────────────────

const LUTEAL_PHASE_LENGTH = 14; // Nearly constant for most women

/** Default cycle length when no data available */
const DEFAULT_CYCLE_LENGTH = 28;

/** Minimum cycles needed for each prediction phase */
const PHASE_2_MIN_CYCLES = 3;
const PHASE_3_MIN_CYCLES = 6;

/** Weight factors for prediction inputs */
const WEIGHTS = {
  historicalCycles: 0.40,
  cycleVariability: 0.15,
  ageGroup: 0.10,
  healthConditions: 0.15,
  weightChanges: 0.05,
  recentSymptoms: 0.10,
  stressSleep: 0.05,
};

/** Weighted moving average weights (most recent → oldest) */
const WMA_WEIGHTS = [0.50, 0.30, 0.20];

// ─── MAIN PREDICTION FUNCTION ────────────────────────────────────────

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
  /** Previous prediction errors (for self-improvement) */
  predictionErrors?: number[]; // actual - predicted, in days
}

export interface PredictionOutput {
  /** Predicted next period start date */
  predictedDate: Date;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Window of uncertainty (± days) */
  windowDays: number;
  /** Which prediction phase was used */
  predictionPhase: 1 | 2 | 3;
  /** Predicted cycle length used */
  predictedCycleLength: number;
  /** Factors that contributed to this prediction */
  factorsUsed: string[];
  /** Human-friendly confidence label */
  confidenceLabel: 'learning' | 'moderate' | 'good' | 'high';
}

/**
 * Generate a full cycle prediction.
 * This is the main entry point for the prediction engine.
 */
export function predictNextPeriod(input: PredictionInput): PredictionOutput {
  const cycleCount = input.cycleHistory.length;

  if (cycleCount < 2) {
    return predictPhase1(input);
  } else if (cycleCount < PHASE_3_MIN_CYCLES) {
    return predictPhase2(input);
  } else {
    return predictPhase3(input);
  }
}

// ─── PHASE 1: SIMPLE AVERAGE (1-2 cycles) ────────────────────────────

/**
 * Phase 1: Limited data — use simple average or default.
 * Confidence is low, window is wide. Honest about uncertainty.
 */
function predictPhase1(input: PredictionInput): PredictionOutput {
  const { cycleHistory, lastPeriodStart, healthProfile } = input;
  const factorsUsed: string[] = ['last_period_date'];

  // Use available cycle length or default
  let avgLength: number;
  if (cycleHistory.length >= 1) {
    avgLength = cycleHistory[0].cycleLength;
    factorsUsed.push('single_cycle_history');
  } else if (healthProfile.averageCycleLength) {
    avgLength = healthProfile.averageCycleLength;
    factorsUsed.push('user_reported_length');
  } else {
    avgLength = DEFAULT_CYCLE_LENGTH;
    factorsUsed.push('default_28_day');
  }

  // Calculate predicted date
  const predictedDate = addDays(lastPeriodStart, avgLength);

  // Low confidence, wide window
  let confidence = 0.45;
  let windowDays = 5;

  // Widen for known irregular conditions
  if (healthProfile.conditions.includes('pcos')) {
    windowDays += 3;
    confidence -= 0.10;
    factorsUsed.push('pcos_adjustment');
  }
  if (healthProfile.age !== null && healthProfile.age < 16) {
    windowDays += 2;
    confidence -= 0.08;
    factorsUsed.push('teen_variability');
  }

  return {
    predictedDate,
    confidence: clamp(confidence, 0.2, 1.0),
    windowDays,
    predictedCycleLength: avgLength,
    predictionPhase: 1,
    factorsUsed,
    confidenceLabel: 'learning',
  };
}

// ─── PHASE 2: WEIGHTED MOVING AVERAGE (3-5 cycles) ───────────────────

/**
 * Phase 2: Weighted moving average — recent cycles matter MORE.
 * Moderate confidence, tighter window.
 */
function predictPhase2(input: PredictionInput): PredictionOutput {
  const { cycleHistory, lastPeriodStart, healthProfile } = input;
  const factorsUsed: string[] = ['weighted_moving_average'];

  // Weighted moving average (most recent cycles weighted higher)
  const recentCycles = cycleHistory.slice(0, Math.min(cycleHistory.length, 3));
  let weightedSum = 0;
  let weightSum = 0;

  recentCycles.forEach((cycle, index) => {
    const weight = WMA_WEIGHTS[index] || 0.1;
    weightedSum += cycle.cycleLength * weight;
    weightSum += weight;
  });

  const weightedAvg = Math.round(weightedSum / weightSum);
  factorsUsed.push(`${recentCycles.length}_cycles_weighted`);

  // Calculate variability (standard deviation)
  const lengths = cycleHistory.map(c => c.cycleLength);
  const stdDev = calculateStdDev(lengths);
  factorsUsed.push(`variability_${stdDev.toFixed(1)}_days`);

  // Base confidence from variability
  let confidence = stdDev <= 2 ? 0.75 : stdDev <= 4 ? 0.65 : 0.55;
  let windowDays = Math.max(2, Math.round(stdDev * 1.2));

  // Health condition adjustments
  if (healthProfile.conditions.includes('pcos')) {
    windowDays += 2;
    confidence -= 0.08;
    factorsUsed.push('pcos_widen');
  }
  if (healthProfile.conditions.includes('thyroid')) {
    windowDays += 1;
    confidence -= 0.05;
    factorsUsed.push('thyroid_adjust');
  }
  if (healthProfile.age !== null && healthProfile.age < 16) {
    windowDays += 1;
    confidence -= 0.05;
    factorsUsed.push('teen_adjust');
  }

  const predictedDate = addDays(lastPeriodStart, weightedAvg);

  return {
    predictedDate,
    confidence: clamp(confidence, 0.3, 0.85),
    windowDays: Math.min(windowDays, 7),
    predictedCycleLength: weightedAvg,
    predictionPhase: 2,
    factorsUsed,
    confidenceLabel: confidence >= 0.65 ? 'moderate' : 'learning',
  };
}

// ─── PHASE 3: BAYESIAN ADAPTIVE (6+ cycles) ─────────────────────────

/**
 * Phase 3: Full Bayesian adaptive prediction.
 * Uses all available factors, self-improves from past errors.
 * Highest accuracy, honest about edge cases.
 */
function predictPhase3(input: PredictionInput): PredictionOutput {
  const {
    cycleHistory,
    lastPeriodStart,
    healthProfile,
    recentStressLevel,
    recentSleepQuality,
    premenstrualSymptomsDetected,
    recentWeightChangeKg,
    predictionErrors,
  } = input;

  const factorsUsed: string[] = ['bayesian_adaptive'];

  // ─── PRIOR: Weighted moving average of last 6 cycles ───────────
  const recentSix = cycleHistory.slice(0, 6);
  const weights = [0.30, 0.25, 0.20, 0.12, 0.08, 0.05];
  let weightedSum = 0;
  let weightTotal = 0;

  recentSix.forEach((cycle, i) => {
    const w = weights[i] || 0.05;
    weightedSum += cycle.cycleLength * w;
    weightTotal += w;
  });

  let predictedLength = weightedSum / weightTotal;
  factorsUsed.push(`prior_from_${recentSix.length}_cycles`);

  // ─── HEALTH PROFILE ADJUSTMENTS ────────────────────────────────
  let healthAdjustment = 0;
  let confidenceReduction = 0;
  let windowExpansion = 0;

  // PCOS: cycles tend to be longer and more variable
  if (healthProfile.conditions.includes('pcos')) {
    windowExpansion += 3;
    confidenceReduction += 0.10;
    factorsUsed.push('pcos_uncertainty');
  }

  // Thyroid: can shift cycle length ±2 days depending on medication
  if (healthProfile.conditions.includes('thyroid')) {
    windowExpansion += 2;
    confidenceReduction += 0.05;
    factorsUsed.push('thyroid_uncertainty');
  }

  // Age < 16: expect more variability (still regulating)
  if (healthProfile.age !== null && healthProfile.age < 16) {
    windowExpansion += 2;
    confidenceReduction += 0.08;
    factorsUsed.push('teen_hormonal_variability');
  }

  // Age > 40: perimenopause may be starting
  if (healthProfile.age !== null && healthProfile.age > 40) {
    windowExpansion += 2;
    confidenceReduction += 0.06;
    factorsUsed.push('perimenopause_consideration');
  }

  // Weight change > 5kg in 3 months
  if (recentWeightChangeKg !== undefined && Math.abs(recentWeightChangeKg) > 5) {
    confidenceReduction += 0.08;
    windowExpansion += 1;
    factorsUsed.push('significant_weight_change');
  }

  // ─── LIFESTYLE ADJUSTMENTS ─────────────────────────────────────

  // High stress: tends to delay period by 1-2 days
  if (recentStressLevel !== undefined && recentStressLevel >= 4) {
    healthAdjustment += 1.5;
    factorsUsed.push('high_stress_shift');
  }

  // Poor sleep: can delay by ~1 day
  if (recentSleepQuality !== undefined && recentSleepQuality <= 2) {
    healthAdjustment += 1;
    factorsUsed.push('poor_sleep_shift');
  }

  // Premenstrual symptoms detected: narrow window, boost confidence
  if (premenstrualSymptomsDetected) {
    windowExpansion -= 1; // Narrow!
    confidenceReduction -= 0.05; // Boost!
    factorsUsed.push('pms_detected_narrow');
  }

  // ─── SELF-IMPROVEMENT FROM PAST ERRORS ─────────────────────────
  let errorCorrection = 0;

  if (predictionErrors && predictionErrors.length >= 3) {
    // Calculate rolling average error (bias detection)
    const recentErrors = predictionErrors.slice(0, 5);
    const avgError = recentErrors.reduce((sum, e) => sum + e, 0) / recentErrors.length;

    // If we consistently over/under-predict, adjust
    if (Math.abs(avgError) > 0.5) {
      errorCorrection = avgError * 0.5; // Correct 50% of detected bias
      factorsUsed.push(`error_correction_${avgError > 0 ? 'later' : 'earlier'}`);
    }
  }

  // ─── FINAL CALCULATION ─────────────────────────────────────────
  const finalLength = Math.round(predictedLength + healthAdjustment + errorCorrection);
  const predictedDate = addDays(lastPeriodStart, finalLength);

  // Confidence calculation
  const lengths = cycleHistory.map(c => c.cycleLength);
  const stdDev = calculateStdDev(lengths);
  const dataQualityFactor = Math.min(1.0, cycleHistory.length / 12); // More data = higher quality

  let baseConfidence = stdDev <= 1.5 ? 0.90 : stdDev <= 3 ? 0.80 : stdDev <= 5 ? 0.65 : 0.50;
  baseConfidence *= dataQualityFactor;
  baseConfidence -= confidenceReduction;

  // Window calculation
  let baseWindow = Math.max(1, Math.round(stdDev));
  baseWindow += windowExpansion;
  baseWindow = clamp(baseWindow, 1, 8);

  // Confidence label
  const confidence = clamp(baseConfidence, 0.25, 0.95);
  let confidenceLabel: PredictionOutput['confidenceLabel'];
  if (confidence >= 0.80) confidenceLabel = 'high';
  else if (confidence >= 0.65) confidenceLabel = 'good';
  else if (confidence >= 0.50) confidenceLabel = 'moderate';
  else confidenceLabel = 'learning';

  return {
    predictedDate,
    confidence,
    windowDays: baseWindow,
    predictedCycleLength: finalLength,
    predictionPhase: 3,
    factorsUsed,
    confidenceLabel,
  };
}

// ─── PREDICTION HELPERS ──────────────────────────────────────────────

/**
 * Generate a complete CyclePrediction (for storage/display).
 * Combines predictor output with current phase calculation.
 */
export function generateFullPrediction(input: PredictionInput): CyclePrediction {
  const prediction = predictNextPeriod(input);
  const avgPeriodLength = input.healthProfile.averagePeriodLength || 5;

  // Get current phase
  const phaseResult: PhaseResult = calculateCurrentPhase(
    input.lastPeriodStart,
    new Date(),
    prediction.predictedCycleLength,
    avgPeriodLength
  );

  // Calculate ovulation date (next period - 14 days)
  const ovulationDate = addDays(prediction.predictedDate, -LUTEAL_PHASE_LENGTH);

  return {
    predictedNextPeriod: prediction.predictedDate.toISOString().split('T')[0],
    confidence: prediction.confidence,
    windowDays: prediction.windowDays,
    currentPhase: phaseResult.phase,
    dayInPhase: phaseResult.dayInPhase,
    dayInCycle: phaseResult.dayInCycle,
    predictedOvulation: ovulationDate.toISOString().split('T')[0],
    factorsUsed: prediction.factorsUsed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update prediction errors after an actual period arrives.
 * Used for self-improvement in Phase 3.
 *
 * @param predictedDate - What we predicted
 * @param actualDate - When period actually started
 * @returns Error in days (positive = period came later than predicted)
 */
export function calculatePredictionError(predictedDate: Date, actualDate: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((actualDate.getTime() - predictedDate.getTime()) / msPerDay);
}

/**
 * Get a human-friendly prediction message.
 * NEVER alarming. Always supportive and honest.
 */
export function getPredictionMessage(prediction: PredictionOutput): string {
  const daysUntil = Math.round(
    (prediction.predictedDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  if (daysUntil < 0) {
    // Period is "late" — but we don't use that word!
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

/** Add days to a date (returns new Date) */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Calculate standard deviation of an array of numbers */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 5; // Default high variability with no data
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Format a date in a friendly way (e.g., "Mar 15") */
function formatDateFriendly(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
