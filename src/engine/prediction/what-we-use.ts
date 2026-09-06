/**
 * Dottie — what the forecast is actually made of
 *
 * ─── WHY THIS EXISTS (device-test-23) ───────────────────────────────
 *
 *  Owner: "the user needs complete transparency. Under the scientific
 *  information below the calendar, at the very bottom, we might need to add
 *  what are all the things that are taken into consideration for predicting
 *  their next period. We are collecting a lot of information from the user
 *  like PCOS, their height, weight and all the other stuff. So what are all
 *  the variables, what are all the features?"
 *
 *  This is the right question to be asked, and it deserves a real answer
 *  rather than a marketing one. So this file is the ONE description of the
 *  model's inputs, generated from the same facts the model uses — and it is
 *  deliberately willing to say "we collect this and it changes nothing".
 *
 *  Three things it must never do:
 *
 *   · claim an input the predictor does not read. Height, weight and activity
 *     level are collected by onboarding and the doctor report; the forecast
 *     has never looked at them. Saying otherwise would be the same class of
 *     dishonesty as an invented population statistic (rule 2).
 *   · imply a diagnosis. "PCOS widens the expected range" is a statement
 *     about the MODEL, not about a body (rule 1).
 *   · drift. Every entry names the file and the mechanism, so a reviewer can
 *     check it against the code in one search, and `test:transparency` asserts
 *     that the conditions list and this list agree.
 *
 *  Used by the panel under the calendar (yours AND a sister's) and by the
 *  "What shapes this forecast" sheet in the export.
 */

import type { HealthProfile } from '../../types/cycle.types';
import { CONDITION_OPTIONS, conditionLabel } from '../../content/conditions';

/** Is this input feeding the forecast right now, for THIS person? */
export type FactorState =
  /** The model reads it and this person has a value for it. */
  | 'active'
  /** The model reads it, but this person has not given it yet. */
  | 'missing'
  /** Collected for the user's own records — the forecast does not read it. */
  | 'not_used';

export interface PredictionFactor {
  /** What it is, in the user's words. */
  label: string;
  /** What it does to the forecast — mechanism, never a claim about a body. */
  effect: string;
  state: FactorState;
  /** The value we hold, when there is one worth showing back. */
  value?: string;
}

export interface FactorInput {
  healthProfile: HealthProfile | null;
  /** How many complete cycles have been observed. */
  cycleCount: number;
  lastPeriodStart: string | null;
  /** Today's check-in values, if there is one. */
  stressLevel?: number | null;
  sleepQuality?: number | null;
  /** Whether the premenstrual signal fired in the last few days. */
  premenstrualSignal?: boolean;
  /**
   * Whose forecast this is. A sister's shadow profile carries fewer inputs —
   * she has no check-ins of her own — and the panel must say so rather than
   * listing inputs that could never be filled.
   */
  subject: 'you' | 'sister';
}

/**
 * Every input, in the order it enters the model.
 *
 * The mechanism strings below are the code, in words:
 *
 *   cycle history      bayesian-predictor.ts · posteriorPredictiveCycleLength
 *   reported length    buildPopulationPrior — the prior's mean
 *   age                buildPopulationPrior — widens SD under 16 / over 40
 *   conditions         buildPopulationPrior + predictor.ts window/confidence
 *   stress / sleep     predictor.ts — mean shift of +1.5 / +1 day
 *   premenstrual       predictor.ts — narrows the window by a day
 *   weight change      predictor.ts — widens it; nothing collects this yet
 */
export function predictionFactors(input: FactorInput): PredictionFactor[] {
  const hp = input.healthProfile;
  const isSister = input.subject === 'sister';
  const out: PredictionFactor[] = [];

  // ─── 1. The spine of the whole thing ─────────────────────────────
  out.push({
    label: 'The days you logged as a period',
    effect:
      input.cycleCount === 0
        ? 'Nothing to learn from yet, so the forecast is running on the typical range alone.'
        : `Every complete cycle updates the estimate, with recent ones counting for more. ${input.cycleCount} so far.`,
    state: input.cycleCount > 0 ? 'active' : 'missing',
    value: input.cycleCount > 0 ? `${input.cycleCount} cycle${input.cycleCount === 1 ? '' : 's'}` : undefined,
  });

  out.push({
    label: 'Your last period start',
    effect: 'The date everything counts forward from.',
    state: input.lastPeriodStart ? 'active' : 'missing',
    value: input.lastPeriodStart ?? undefined,
  });

  out.push({
    label: 'The cycle length you told us',
    effect: 'The starting estimate, before your own logs outweigh it.',
    state: hp?.averageCycleLength ? 'active' : 'missing',
    value: hp?.averageCycleLength ? `${hp.averageCycleLength} days` : undefined,
  });

  // ─── 2. What widens or narrows the expected range ────────────────
  out.push({
    label: 'Age',
    effect: 'Under 16 and over 40, cycle length varies more, so the range widens.',
    state: hp?.age != null ? 'active' : 'missing',
    value: hp?.age != null ? `${hp.age}` : undefined,
  });

  const affecting = (hp?.conditions ?? []).filter((c) => {
    const opt = CONDITION_OPTIONS.find((o) => o.id === c);
    return opt?.affectsPrediction === true;
  });
  const recordedOnly = (hp?.conditions ?? []).filter((c) => {
    const opt = CONDITION_OPTIONS.find((o) => o.id === c);
    return opt !== undefined && opt.affectsPrediction === false;
  });

  out.push({
    label: 'Conditions that change the maths',
    effect:
      'PCOS and PCOD widen the expected range the most; a thyroid condition widens it a little. ' +
      'Endometriosis, adenomyosis and fibroids are recorded and shown in your history — many people report they affect flow and pain rather than cycle length.',
    state: affecting.length > 0 ? 'active' : 'missing',
    value: affecting.length > 0 ? affecting.map(conditionLabel).join(', ') : undefined,
  });

  if (recordedOnly.length > 0) {
    out.push({
      label: 'Conditions we keep but do not model',
      effect:
        'Saved with your history and included in your doctor report. The forecast does not read them — we would rather say so than imply a cleverness we do not have.',
      state: 'not_used',
      value: recordedOnly.map(conditionLabel).join(', '),
    });
  }

  // ─── 3. The day-to-day signals ───────────────────────────────────
  if (isSister) {
    out.push({
      label: 'Day-to-day check-ins',
      effect:
        "A shadow profile has no check-ins of its own, so stress, sleep and premenstrual signals are not part of her forecast — only the days you log for her.",
      state: 'not_used',
    });
  } else {
    out.push({
      label: 'Stress, from today’s check-in',
      effect: 'A high reading nudges the estimate about a day and a half later.',
      state: input.stressLevel != null ? 'active' : 'missing',
      value: input.stressLevel != null ? `${input.stressLevel} of 5` : undefined,
    });
    out.push({
      label: 'Sleep, from today’s check-in',
      effect: 'A poor night nudges the estimate about a day later.',
      state: input.sleepQuality != null ? 'active' : 'missing',
      value: input.sleepQuality != null ? `${input.sleepQuality} of 5` : undefined,
    });
    out.push({
      label: 'Premenstrual symptoms in the last few days',
      effect: 'When they show up, the window narrows — the signal says it is close.',
      state: input.premenstrualSignal ? 'active' : 'missing',
    });
  }

  // ─── 4. Collected, and honestly not used ─────────────────────────
  out.push({
    label: 'Height, weight and activity level',
    effect:
      'Collected for your own records and your doctor report. The forecast does not use them today. A large weight change is the one thing the model could read, and nothing in the app asks you for it.',
    state: 'not_used',
    value: [
      hp?.heightCm ? `${hp.heightCm} cm` : null,
      hp?.weightKg ? `${hp.weightKg} kg` : null,
      hp?.activityLevel ?? null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined,
  });

  out.push({
    label: 'Your mood, energy and symptom logs',
    effect:
      'They power your mood map, your insights and what your companion says. Only the premenstrual signal above reaches the forecast.',
    state: 'not_used',
  });

  return out;
}

/** One line for the top of the panel, so the list has a point. */
export function transparencySummary(factors: readonly PredictionFactor[]): string {
  const active = factors.filter((f) => f.state === 'active').length;
  const usable = factors.filter((f) => f.state !== 'not_used').length;
  return `${active} of ${usable} inputs the forecast can use are filled in.`;
}
