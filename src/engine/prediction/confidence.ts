/**
 * Dottie — Confidence Scoring Engine
 *
 * Determines HOW SURE Dottie is about any prediction.
 * This is crucial for user trust — we NEVER pretend to be certain
 * when we're not. Honest uncertainty > false precision.
 *
 * Confidence is affected by:
 * - Amount of historical data (more cycles = more confident)
 * - Cycle regularity (low std deviation = more confident)
 * - Health conditions (PCOS/thyroid = less confident, wider window)
 * - Data freshness (recent logging = more confident)
 * - Prediction track record (past accuracy boosts confidence)
 *
 * OUTPUT:
 * - Numeric score (0.0 - 1.0)
 * - Human-friendly label ("Still learning", "Getting better", "Pretty sure", "Very confident")
 * - Suggested window (± days of uncertainty)
 * - Visual indicator (for UI progress ring)
 */

import { CycleRecord, HealthProfile } from '../../types/cycle.types';

// ─── CONFIDENCE LEVELS ───────────────────────────────────────────────

export type ConfidenceLevel = 'learning' | 'improving' | 'good' | 'high';

export interface ConfidenceScore {
  /** Numeric confidence (0.0 - 1.0) */
  score: number;
  /** Human-friendly label */
  level: ConfidenceLevel;
  /** Suggested prediction window (± days) */
  windowDays: number;
  /** Friendly message for the user */
  message: string;
  /** Factors contributing to confidence (for transparency) */
  factors: ConfidenceFactor[];
  /** Progress toward next confidence level (0.0 - 1.0) */
  progressToNext: number;
}

export interface ConfidenceFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

// ─── THRESHOLDS ──────────────────────────────────────────────────────

const LEVEL_THRESHOLDS = {
  learning: 0.0,    // 0% - 45%
  improving: 0.45,  // 45% - 65%
  good: 0.65,       // 65% - 82%
  high: 0.82,       // 82% - 100%
};

// ─── MAIN CONFIDENCE CALCULATOR ──────────────────────────────────────

/**
 * Calculate overall confidence score for predictions.
 *
 * @param cycleHistory - User's historical cycles (most recent first)
 * @param healthProfile - User's health profile
 * @param lastLogDate - When the user last logged data (ISO string)
 * @param predictionErrors - Past prediction errors in days (optional)
 */
export function calculateConfidence(
  cycleHistory: CycleRecord[],
  healthProfile: HealthProfile,
  lastLogDate: string | null,
  predictionErrors?: number[]
): ConfidenceScore {
  const factors: ConfidenceFactor[] = [];

  // ─── Factor 1: Data Quantity (how many cycles we have) ─────────
  const dataQuantityScore = calculateDataQuantityScore(cycleHistory.length);
  factors.push({
    name: 'Data history',
    impact: dataQuantityScore >= 0.6 ? 'positive' : dataQuantityScore >= 0.3 ? 'neutral' : 'negative',
    weight: 0.30,
    description: getDataQuantityMessage(cycleHistory.length),
  });

  // ─── Factor 2: Cycle Regularity (std deviation) ────────────────
  const regularityScore = calculateRegularityScore(cycleHistory);
  factors.push({
    name: 'Cycle regularity',
    impact: regularityScore >= 0.6 ? 'positive' : regularityScore >= 0.3 ? 'neutral' : 'negative',
    weight: 0.25,
    description: getRegularityMessage(cycleHistory),
  });

  // ─── Factor 3: Health Profile Complexity ───────────────────────
  const healthScore = calculateHealthScore(healthProfile);
  factors.push({
    name: 'Health profile',
    impact: healthScore >= 0.7 ? 'positive' : healthScore >= 0.4 ? 'neutral' : 'negative',
    weight: 0.20,
    description: getHealthMessage(healthProfile),
  });

  // ─── Factor 4: Data Freshness (recent logging) ─────────────────
  const freshnessScore = calculateFreshnessScore(lastLogDate);
  factors.push({
    name: 'Recent logging',
    impact: freshnessScore >= 0.7 ? 'positive' : freshnessScore >= 0.4 ? 'neutral' : 'negative',
    weight: 0.15,
    description: getFreshnessMessage(lastLogDate),
  });

  // ─── Factor 5: Past Prediction Accuracy ────────────────────────
  const accuracyScore = calculateAccuracyScore(predictionErrors);
  factors.push({
    name: 'Prediction track record',
    impact: accuracyScore >= 0.7 ? 'positive' : accuracyScore >= 0.4 ? 'neutral' : 'negative',
    weight: 0.10,
    description: getAccuracyMessage(predictionErrors),
  });

  // ─── Weighted combination ──────────────────────────────────────
  const weightedScore =
    dataQuantityScore * 0.30 +
    regularityScore * 0.25 +
    healthScore * 0.20 +
    freshnessScore * 0.15 +
    accuracyScore * 0.10;

  const finalScore = clamp(weightedScore, 0.1, 0.95);

  // Determine level and window
  const level = getConfidenceLevel(finalScore);
  const windowDays = calculateWindow(finalScore, healthProfile, cycleHistory);
  const message = getConfidenceMessage(level, cycleHistory.length);
  const progressToNext = calculateProgressToNext(finalScore, level);

  return {
    score: Math.round(finalScore * 100) / 100,
    level,
    windowDays,
    message,
    factors,
    progressToNext,
  };
}

// ─── INDIVIDUAL FACTOR CALCULATORS ───────────────────────────────────

/** More cycles = higher confidence (diminishing returns after 12) */
function calculateDataQuantityScore(cycleCount: number): number {
  if (cycleCount === 0) return 0.1;
  if (cycleCount === 1) return 0.25;
  if (cycleCount === 2) return 0.40;
  if (cycleCount <= 4) return 0.55;
  if (cycleCount <= 6) return 0.70;
  if (cycleCount <= 9) return 0.82;
  if (cycleCount <= 12) return 0.90;
  return 0.95; // 12+ cycles = near-maximum data confidence
}

/** Lower cycle length variability = higher confidence */
function calculateRegularityScore(cycleHistory: CycleRecord[]): number {
  if (cycleHistory.length < 2) return 0.4; // Can't calculate with < 2 cycles

  const lengths = cycleHistory.map(c => c.cycleLength);
  const stdDev = calculateStdDev(lengths);

  if (stdDev <= 1.0) return 0.95;  // Extremely regular
  if (stdDev <= 2.0) return 0.85;  // Very regular
  if (stdDev <= 3.0) return 0.70;  // Fairly regular
  if (stdDev <= 5.0) return 0.50;  // Somewhat irregular
  if (stdDev <= 7.0) return 0.35;  // Quite irregular
  return 0.20;                      // Very irregular
}

/** Health conditions that increase prediction difficulty */
function calculateHealthScore(healthProfile: HealthProfile): number {
  let score = 0.85; // Base score (no complications)

  // Each condition reduces confidence
  if (healthProfile.conditions.includes('pcos')) {
    score -= 0.25; // PCOS significantly increases variability
  }
  if (healthProfile.conditions.includes('thyroid')) {
    score -= 0.15; // Thyroid moderately affects predictions
  }
  if (healthProfile.conditions.includes('endometriosis')) {
    score -= 0.10; // Endometriosis has milder prediction impact
  }

  // Age factors
  if (healthProfile.age !== null) {
    if (healthProfile.age < 15) score -= 0.20;      // Very young, still establishing
    else if (healthProfile.age < 18) score -= 0.10; // Teen, somewhat variable
    else if (healthProfile.age > 45) score -= 0.15; // Perimenopause territory
  }

  // Medications can affect regularity (but also can make it MORE regular)
  if (healthProfile.onMedications) {
    // Birth control often INCREASES regularity — slight boost
    score += 0.05;
  }

  return clamp(score, 0.15, 0.95);
}

/** Recent logging = Dottie has fresh data to work with */
function calculateFreshnessScore(lastLogDate: string | null): number {
  if (!lastLogDate) return 0.3; // Never logged

  const daysSinceLog = daysBetween(new Date(lastLogDate), new Date());

  if (daysSinceLog <= 1) return 0.95;   // Logged today/yesterday
  if (daysSinceLog <= 3) return 0.80;   // Recent
  if (daysSinceLog <= 7) return 0.60;   // Last week
  if (daysSinceLog <= 14) return 0.40;  // Two weeks ago
  if (daysSinceLog <= 30) return 0.25;  // A month ago
  return 0.15;                           // Very stale data
}

/** How accurate past predictions were */
function calculateAccuracyScore(predictionErrors?: number[]): number {
  if (!predictionErrors || predictionErrors.length === 0) return 0.5; // Unknown

  const recentErrors = predictionErrors.slice(0, 6);
  const avgAbsError = recentErrors.reduce((sum, e) => sum + Math.abs(e), 0) / recentErrors.length;

  if (avgAbsError <= 1) return 0.95;   // Within 1 day — excellent!
  if (avgAbsError <= 2) return 0.80;   // Within 2 days — great
  if (avgAbsError <= 3) return 0.65;   // Within 3 days — good
  if (avgAbsError <= 5) return 0.45;   // Within 5 days — okay
  return 0.25;                          // Off by more than 5 days
}

// ─── WINDOW CALCULATION ──────────────────────────────────────────────

/** Calculate the ± days window based on confidence and conditions */
function calculateWindow(
  score: number,
  healthProfile: HealthProfile,
  cycleHistory: CycleRecord[]
): number {
  // Base window from confidence score (inverse relationship)
  let window: number;
  if (score >= 0.82) window = 1;
  else if (score >= 0.65) window = 2;
  else if (score >= 0.50) window = 3;
  else if (score >= 0.35) window = 4;
  else window = 5;

  // Expand for health conditions
  if (healthProfile.conditions.includes('pcos')) window += 2;
  if (healthProfile.conditions.includes('thyroid')) window += 1;
  if (healthProfile.age !== null && healthProfile.age < 16) window += 1;

  // Expand based on actual cycle variability
  if (cycleHistory.length >= 3) {
    const stdDev = calculateStdDev(cycleHistory.map(c => c.cycleLength));
    if (stdDev > 5) window += 2;
    else if (stdDev > 3) window += 1;
  }

  return clamp(window, 1, 8);
}

// ─── LEVEL & MESSAGE HELPERS ─────────────────────────────────────────

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= LEVEL_THRESHOLDS.high) return 'high';
  if (score >= LEVEL_THRESHOLDS.good) return 'good';
  if (score >= LEVEL_THRESHOLDS.improving) return 'improving';
  return 'learning';
}

function calculateProgressToNext(score: number, currentLevel: ConfidenceLevel): number {
  const thresholds: Record<ConfidenceLevel, { min: number; max: number }> = {
    learning: { min: 0, max: 0.45 },
    improving: { min: 0.45, max: 0.65 },
    good: { min: 0.65, max: 0.82 },
    high: { min: 0.82, max: 1.0 },
  };

  const range = thresholds[currentLevel];
  return clamp((score - range.min) / (range.max - range.min), 0, 1);
}

function getConfidenceMessage(level: ConfidenceLevel, cycleCount: number): string {
  switch (level) {
    case 'learning':
      if (cycleCount === 0) return "I'm just getting started! Log your first period and I'll begin learning your rhythm 🌱";
      return `I'm still learning your pattern. ${Math.max(0, 3 - cycleCount)} more cycle${3 - cycleCount !== 1 ? 's' : ''} and I'll be much more accurate! 📈`;
    case 'improving':
      return "Getting better! Your pattern is becoming clearer with each cycle 🌸";
    case 'good':
      return "I'm pretty confident about your predictions now! Keep logging for even more accuracy ✨";
    case 'high':
      return "I know your rhythm well! My predictions are highly personalized to you 💛";
  }
}

function getDataQuantityMessage(cycleCount: number): string {
  if (cycleCount === 0) return 'No cycles recorded yet';
  if (cycleCount <= 2) return `${cycleCount} cycle${cycleCount > 1 ? 's' : ''} recorded — still building your profile`;
  if (cycleCount <= 5) return `${cycleCount} cycles — pattern emerging`;
  return `${cycleCount} cycles — strong historical data`;
}

function getRegularityMessage(cycleHistory: CycleRecord[]): string {
  if (cycleHistory.length < 2) return 'Need more data to assess regularity';
  const stdDev = calculateStdDev(cycleHistory.map(c => c.cycleLength));
  if (stdDev <= 2) return 'Your cycles are very consistent — great for predictions!';
  if (stdDev <= 4) return 'Your cycles have some natural variation';
  return 'Your cycles have significant variation — wider prediction windows keep things accurate';
}

function getHealthMessage(healthProfile: HealthProfile): string {
  if (healthProfile.conditions.includes('pcos')) {
    return 'PCOS can make cycles unpredictable — I widen my windows to stay honest';
  }
  if (healthProfile.conditions.includes('thyroid')) {
    return 'Thyroid conditions can shift timing — I account for this in predictions';
  }
  if (healthProfile.age !== null && healthProfile.age < 16) {
    return 'Teen cycles are still establishing — wider windows are normal and healthy!';
  }
  return 'No conditions affecting prediction difficulty';
}

function getFreshnessMessage(lastLogDate: string | null): string {
  if (!lastLogDate) return 'No recent check-ins — log today for better predictions!';
  const days = daysBetween(new Date(lastLogDate), new Date());
  if (days <= 1) return 'Fresh data from today — predictions are up to date!';
  if (days <= 3) return 'Logged recently — predictions are current';
  return `Last log was ${days} days ago — check in to keep predictions sharp`;
}

function getAccuracyMessage(predictionErrors?: number[]): string {
  if (!predictionErrors || predictionErrors.length === 0) {
    return 'No prediction results yet — will improve with each cycle';
  }
  const avgAbsError = predictionErrors.slice(0, 6).reduce((s, e) => s + Math.abs(e), 0) / Math.min(predictionErrors.length, 6);
  if (avgAbsError <= 2) return `Predictions have been within ~${Math.round(avgAbsError)} day${avgAbsError > 1 ? 's' : ''} — excellent!`;
  return `Average prediction is within ~${Math.round(avgAbsError)} days — improving!`;
}

// ─── UTILITIES ───────────────────────────────────────────────────────

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 5;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(Math.floor((date2.getTime() - date1.getTime()) / msPerDay));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
