/**
 * Dottie — Health Adjustments Engine
 *
 * Adjusts cycle predictions based on health conditions, medications,
 * age, weight, and lifestyle factors.
 *
 * KEY PRINCIPLE: These adjustments make predictions MORE honest,
 * not more alarming. If a condition adds uncertainty, we WIDEN
 * the prediction window rather than guessing wildly.
 *
 * SUPPORTED CONDITIONS:
 * - PCOS: Longer, unpredictable cycles (21-60+ days)
 * - Thyroid (hypo/hyper): Shifts cycle length ± 2-5 days
 * - Endometriosis: Heavier flow, pain patterns, slight variability
 * - Perimenopause: Gradually increasing irregularity
 *
 * LIFESTYLE FACTORS:
 * - Weight changes (>5kg in 3 months)
 * - Stress levels (cortisol delays ovulation)
 * - Sleep disruption (circadian → hormonal cascade)
 * - Intense exercise (hypothalamic amenorrhea risk)
 * - Medication changes (birth control, thyroid meds, SSRIs)
 *
 * ALL DATA STAYS LOCAL. These computations happen on-device only.
 */

import { HealthCondition, HealthProfile } from '../../types/cycle.types';

// ��── ADJUSTMENT OUTPUT ───────────────────────────────────────────────

export interface HealthAdjustment {
  /** Days to add/subtract from predicted cycle length */
  cycleLengthShift: number;
  /** Additional window expansion (± days) */
  windowExpansion: number;
  /** Confidence reduction (0.0 - 0.3) */
  confidenceReduction: number;
  /** Human-friendly explanation */
  explanation: string;
  /** Factor name for tracking */
  factorName: string;
}

export interface AdjustmentResult {
  /** Total cycle length adjustment (sum of all shifts) */
  totalShift: number;
  /** Total window expansion */
  totalWindowExpansion: number;
  /** Total confidence reduction */
  totalConfidenceReduction: number;
  /** Individual adjustments applied */
  adjustments: HealthAdjustment[];
  /** Summary message for the user */
  summary: string;
}

// ─── MAIN ADJUSTMENT CALCULATOR ──────────────────────────────────────

/**
 * Calculate all health-based adjustments for a prediction.
 *
 * @param healthProfile - User's health profile
 * @param recentStress - Average stress (1-5) from last 7 days
 * @param recentSleep - Average sleep quality (1-5) from last 7 days
 * @param recentExerciseIntensity - Exercise intensity (1-5) from last 7 days
 * @param weightChangeKg - Weight change in last 3 months (positive = gain)
 * @param medicationChange - Whether medication was recently changed
 */
export function calculateHealthAdjustments(
  healthProfile: HealthProfile,
  recentStress?: number,
  recentSleep?: number,
  recentExerciseIntensity?: number,
  weightChangeKg?: number,
  medicationChange?: boolean
): AdjustmentResult {
  const adjustments: HealthAdjustment[] = [];

  // ─── Condition-based adjustments ─────────────────────────────────
  for (const condition of healthProfile.conditions) {
    if (condition === 'none') continue;
    const adj = getConditionAdjustment(condition, healthProfile);
    if (adj) adjustments.push(adj);
  }

  // ─── Age-based adjustments ───────────────────────────────────────
  const ageAdj = getAgeAdjustment(healthProfile.age);
  if (ageAdj) adjustments.push(ageAdj);

  // ─── Lifestyle factor adjustments ────────────────────────────────
  if (recentStress !== undefined && recentStress >= 3.5) {
    adjustments.push(getStressAdjustment(recentStress));
  }

  if (recentSleep !== undefined && recentSleep <= 2.5) {
    adjustments.push(getSleepAdjustment(recentSleep));
  }

  if (recentExerciseIntensity !== undefined && recentExerciseIntensity >= 4.5) {
    adjustments.push(getExerciseAdjustment(recentExerciseIntensity));
  }

  if (weightChangeKg !== undefined && Math.abs(weightChangeKg) > 3) {
    adjustments.push(getWeightChangeAdjustment(weightChangeKg));
  }

  if (medicationChange) {
    adjustments.push(getMedicationChangeAdjustment());
  }

  // ─── Aggregate results ───────────────────────────────────────────
  const totalShift = adjustments.reduce((sum, a) => sum + a.cycleLengthShift, 0);
  const totalWindowExpansion = adjustments.reduce((sum, a) => sum + a.windowExpansion, 0);
  const totalConfidenceReduction = Math.min(
    0.40, // Cap total reduction so we never go below ~0.2 confidence
    adjustments.reduce((sum, a) => sum + a.confidenceReduction, 0)
  );

  const summary = buildSummaryMessage(adjustments);

  return {
    totalShift: Math.round(totalShift * 10) / 10,
    totalWindowExpansion: Math.min(totalWindowExpansion, 8), // Cap at ±8 days
    totalConfidenceReduction,
    adjustments,
    summary,
  };
}

// ─── CONDITION-SPECIFIC ADJUSTMENTS ──────────────────────────────────

function getConditionAdjustment(
  condition: HealthCondition,
  profile: HealthProfile
): HealthAdjustment | null {
  switch (condition) {
    case 'pcos':
      return {
        cycleLengthShift: 0, // Don't shift — just widen window
        windowExpansion: 4,
        confidenceReduction: 0.15,
        explanation: 'PCOS can make cycles longer or unpredictable. I give extra room in my predictions to stay honest with you 💛',
        factorName: 'pcos',
      };

    case 'thyroid':
      // Hypothyroid tends to lengthen cycles, hyperthyroid shortens
      // Without knowing which, we add uncertainty
      return {
        cycleLengthShift: 0,
        windowExpansion: 2,
        confidenceReduction: 0.08,
        explanation: 'Thyroid conditions can shift cycle timing. If your medication dose changes, predictions may temporarily be less accurate.',
        factorName: 'thyroid',
      };

    case 'endometriosis':
      return {
        cycleLengthShift: 0,
        windowExpansion: 1,
        confidenceReduction: 0.05,
        explanation: 'Endometriosis can cause some cycle variability. I track your patterns carefully to stay accurate.',
        factorName: 'endometriosis',
      };

    default:
      return null;
  }
}

// ─── AGE-BASED ADJUSTMENTS ───────────────────────────────────────────

function getAgeAdjustment(age: number | null): HealthAdjustment | null {
  if (age === null) return null;

  if (age < 14) {
    return {
      cycleLengthShift: 0,
      windowExpansion: 4,
      confidenceReduction: 0.18,
      explanation: "Your body is still finding its rhythm — it's completely normal for cycles to vary a lot right now! Every body is different 🌱",
      factorName: 'age_very_young',
    };
  }

  if (age < 17) {
    return {
      cycleLengthShift: 0,
      windowExpansion: 2,
      confidenceReduction: 0.10,
      explanation: "Teen cycles can take a few years to become regular. You're doing great by tracking! 🌸",
      factorName: 'age_teen',
    };
  }

  if (age >= 42 && age < 48) {
    return {
      cycleLengthShift: 0,
      windowExpansion: 2,
      confidenceReduction: 0.08,
      explanation: 'Cycles may start shifting as your body naturally transitions. Wider predictions help me stay accurate for you.',
      factorName: 'age_early_perimenopause',
    };
  }

  if (age >= 48) {
    return {
      cycleLengthShift: 0,
      windowExpansion: 4,
      confidenceReduction: 0.15,
      explanation: 'Your body may be entering perimenopause — cycles can become quite variable. This is normal and healthy! 🌅',
      factorName: 'age_perimenopause',
    };
  }

  return null; // Ages 17-41: no age adjustment needed
}

// ─── LIFESTYLE FACTOR ADJUSTMENTS ────────────────────────────────────

/**
 * High stress delays ovulation by raising cortisol,
 * which suppresses GnRH → delays LH surge.
 * Effect: Lengthens follicular phase → delays period by 1-3 days.
 */
function getStressAdjustment(stressLevel: number): HealthAdjustment {
  // Scale: 3.5 = mild effect, 5.0 = strong effect
  const intensity = (stressLevel - 3.5) / 1.5; // 0.0 - 1.0
  const shift = Math.round(intensity * 2.5 * 10) / 10; // 0 - 2.5 days

  return {
    cycleLengthShift: shift,
    windowExpansion: 1,
    confidenceReduction: 0.04,
    explanation: "Stress can delay ovulation slightly. If you've been stressed lately, your period might come a bit later than usual 🫂",
    factorName: 'high_stress',
  };
}

/**
 * Poor sleep disrupts circadian rhythm → affects melatonin →
 * downstream impact on reproductive hormones.
 * Effect: Can delay period by ~1 day.
 */
function getSleepAdjustment(sleepQuality: number): HealthAdjustment {
  const intensity = (2.5 - sleepQuality) / 2.5; // 0.0 - 1.0
  const shift = Math.round(intensity * 1.5 * 10) / 10; // 0 - 1.5 days

  return {
    cycleLengthShift: shift,
    windowExpansion: 1,
    confidenceReduction: 0.03,
    explanation: 'Sleep disruption can nudge your cycle timing slightly. Prioritizing rest may help things stay on track 😴',
    factorName: 'poor_sleep',
  };
}

/**
 * Very intense exercise can suppress GnRH if energy availability is low.
 * This is the "relative energy deficiency" pathway.
 * Effect: Can delay or skip periods in extreme cases.
 */
function getExerciseAdjustment(intensity: number): HealthAdjustment {
  const shift = intensity >= 4.8 ? 2.0 : 1.0;

  return {
    cycleLengthShift: shift,
    windowExpansion: 1,
    confidenceReduction: 0.05,
    explanation: 'Very intense training can sometimes delay your cycle. Make sure you\'re fueling your body enough! 💪',
    factorName: 'intense_exercise',
  };
}

/**
 * Significant weight change (>3kg in 3 months) affects estrogen levels.
 * Fat tissue produces estrogen — changes in body composition shift hormonal balance.
 * Effect: Weight gain → can shorten cycles. Weight loss → can lengthen/delay.
 */
function getWeightChangeAdjustment(weightChangeKg: number): HealthAdjustment {
  const isGain = weightChangeKg > 0;
  const magnitude = Math.abs(weightChangeKg);

  let shift: number;
  let windowExp: number;
  let confReduction: number;

  if (magnitude > 10) {
    // Major weight change
    shift = isGain ? -1.5 : 2.5;
    windowExp = 3;
    confReduction = 0.12;
  } else if (magnitude > 5) {
    // Moderate weight change
    shift = isGain ? -1.0 : 1.5;
    windowExp = 2;
    confReduction = 0.08;
  } else {
    // Mild weight change (3-5 kg)
    shift = isGain ? -0.5 : 1.0;
    windowExp = 1;
    confReduction = 0.04;
  }

  const direction = isGain ? 'gained' : 'lost';
  return {
    cycleLengthShift: shift,
    windowExpansion: windowExp,
    confidenceReduction: confReduction,
    explanation: `Your body has ${direction} some weight recently, which can shift cycle timing. Predictions will re-calibrate as your body settles 🌿`,
    factorName: `weight_${isGain ? 'gain' : 'loss'}`,
  };
}

/**
 * Medication changes (starting, stopping, or switching) can temporarily
 * disrupt cycle regularity. Most common: birth control, thyroid meds, SSRIs.
 * Effect: 1-3 cycles of uncertainty after a change.
 */
function getMedicationChangeAdjustment(): HealthAdjustment {
  return {
    cycleLengthShift: 0,
    windowExpansion: 3,
    confidenceReduction: 0.12,
    explanation: "Medication changes can temporarily shift your cycle. It usually takes 2-3 cycles to establish a new pattern. I'll adapt! 💊",
    factorName: 'medication_change',
  };
}

// ─── SUMMARY MESSAGE BUILDER ─────────────────────────────────────────

function buildSummaryMessage(adjustments: HealthAdjustment[]): string {
  if (adjustments.length === 0) {
    return 'No health factors affecting predictions — your data speaks clearly! ✨';
  }

  if (adjustments.length === 1) {
    return adjustments[0]!.explanation;
  }

  const factorNames = adjustments.map(a => a.factorName);

  // Build a gentle, non-alarming summary
  if (factorNames.includes('pcos')) {
    return 'Your predictions account for PCOS variability and other factors. Wider windows = more honest predictions 💛';
  }

  if (factorNames.some(f => f.startsWith('age_'))) {
    return "I've adjusted predictions for your age and lifestyle factors. Every body has its own timeline! 🌸";
  }

  return `I'm considering ${adjustments.length} factors that might affect your cycle. This makes predictions more honest, not less useful 🩷`;
}

// ─── HELPER: CHECK IF ADJUSTMENTS NEEDED ─────────────────────────────

/**
 * Quick check if health profile warrants any adjustments.
 * Used to avoid unnecessary computation.
 */
export function needsHealthAdjustments(healthProfile: HealthProfile): boolean {
  if (healthProfile.conditions.some(c => c !== 'none')) return true;
  if (healthProfile.age !== null && (healthProfile.age < 17 || healthProfile.age > 41)) return true;
  if (healthProfile.onMedications) return true;
  return false;
}

/**
 * Get a list of conditions that make cycle prediction harder.
 * Used for UI to show "factors considered" in prediction display.
 */
export function getActiveFactors(healthProfile: HealthProfile): string[] {
  const factors: string[] = [];

  if (healthProfile.conditions.includes('pcos')) factors.push('PCOS');
  if (healthProfile.conditions.includes('thyroid')) factors.push('Thyroid');
  if (healthProfile.conditions.includes('endometriosis')) factors.push('Endometriosis');
  if (healthProfile.age !== null && healthProfile.age < 17) factors.push('Teen cycles');
  if (healthProfile.age !== null && healthProfile.age > 41) factors.push('Perimenopause');
  if (healthProfile.onMedications) factors.push('Medications');

  return factors;
}
