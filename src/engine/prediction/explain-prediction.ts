/**
 * Dottie — Prediction Explainer (pure, on-device)
 *
 * Turns the Bayesian predictor's output into a HUMAN explanation of *how* the
 * next-period prediction was made: the predicted date, the ± window, the
 * standard deviation behind it, the confidence, and a plain-language list of
 * the factors that tightened or widened the estimate.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner ask: when we show a prediction, also show — scientifically but in a
 *  way ANYONE can understand — how it's calculated, what's considered, and the
 *  confidence interval / standard deviation. And it must be DYNAMIC: because
 *  `useCycleStore.recomputePrediction()` already re-runs after every log/edit,
 *  a selector built on this module re-renders live as the user changes inputs.
 *
 * ─── CONSISTENCY WITH THE REST OF THE APP ───────────────────────────
 *
 *  The headline interval is the SAME `predictedDate ± windowDays` the calendar
 *  already shades — we do NOT invent a second, conflicting interval. The
 *  posterior standard deviation is surfaced as the *scientific backing* for
 *  that window (the engine sets windowDays ≈ 1.15·SD), and we state the
 *  approximate probability the window covers so the number means something.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  Every sentence is "likely / tends to / for some people" — never "your body
 *  is doing X." Body-weight context (if the user shared height + weight) is
 *  framed gently and only appears at genuinely relevant extremes.
 */

import { PredictionInput, PredictionOutput, predictNextPeriod } from './predictor';
import {
  PosteriorPredictive,
  buildPopulationPrior,
  posteriorPredictiveCycleLength,
} from './bayesian-predictor';
import { toISODate } from '../../utils/date.utils';

// ─── PUBLIC TYPES ────────────────────────────────────────────────────

/** How a single factor moves the prediction. Drives the icon/colour in UI. */
export type FactorEffect =
  | 'tightens'
  | 'widens'
  | 'shifts-later'
  | 'shifts-earlier'
  | 'neutral';

export interface ExplanationFactor {
  /** Stable id for keys/tests. */
  key: string;
  /** Decorative emoji (marked decorative in UI). */
  icon: string;
  /** Short label, e.g. "Your logged cycles". */
  label: string;
  /** One plain sentence a first-time user understands. */
  plain: string;
  /** Direction of influence on the window / date. */
  effect: FactorEffect;
}

export interface PredictionExplanation {
  /** True once at least one full cycle has been observed. */
  hasData: boolean;
  /** ISO predicted next-period date. */
  pointDate: string;
  /** ± days — the SAME band the calendar shades. */
  windowDays: number;
  /** pointDate − windowDays (ISO). */
  intervalStartDate: string;
  /** pointDate + windowDays (ISO). */
  intervalEndDate: string;
  /** Typical cycle length used (days). */
  predictedCycleLength: number;
  /** Posterior predictive standard deviation (days) — the scientific spread. */
  stdDevDays: number;
  /** Cycles the user has actually logged. */
  cyclesObserved: number;
  /** Recency-weighted effective cycle count (1 dp). */
  effectiveCycles: number;
  /** 0–1 confidence. */
  confidence: number;
  confidenceLabel: PredictionOutput['confidenceLabel'];
  /** ~probability (0–1) the true date lands inside the ± window. */
  approxWindowProbability: number;
  /** Human factor list, most influential first. */
  factors: ExplanationFactor[];
  /** 1–2 sentences anyone can read. */
  plainSummary: string;
  /** The "show the science" paragraph. */
  scienceSummary: string;
}

// ─── MAIN ENTRY ──────────────────────────────────────────────────────

/**
 * Build the full explanation from the same input the predictor consumes.
 * Pure — safe to call from a Zustand selector or a Node harness.
 */
export function explainPrediction(input: PredictionInput): PredictionExplanation {
  const output = predictNextPeriod(input);

  // Recompute the (closed-form, nanosecond) posterior to expose SD + effN.
  // Mirrors exactly what predictNextPeriod does internally.
  const prior = buildPopulationPrior({
    reportedCycleLength: input.healthProfile.averageCycleLength,
    age: input.healthProfile.age,
    conditions: input.healthProfile.conditions,
  });
  const posterior = posteriorPredictiveCycleLength(
    input.cycleHistory.map((c) => c.cycleLength),
    prior
  );

  return buildExplanation(input, output, posterior);
}

// ─── BUILDER ─────────────────────────────────────────────────────────

function buildExplanation(
  input: PredictionInput,
  output: PredictionOutput,
  posterior: PosteriorPredictive
): PredictionExplanation {
  const cyclesObserved = input.cycleHistory.length;
  const stdDevDays = round1(posterior.std);
  const windowDays = output.windowDays;

  const intervalStart = addDays(output.predictedDate, -windowDays);
  const intervalEnd = addDays(output.predictedDate, windowDays);

  // How much of the distribution the ± window covers. windowDays ≈ 1.15·SD in
  // the engine, which is ~75% — but computing it from the ACTUAL k = window/SD
  // keeps the stated probability honest and dynamic as the data changes.
  const k = posterior.std > 0 ? windowDays / posterior.std : 3;
  const approxWindowProbability = clamp01(normalCoverage(k));

  const factors = buildFactors(input, output, posterior, cyclesObserved);

  const plainSummary = buildPlainSummary(
    output.predictedDate,
    windowDays,
    cyclesObserved
  );
  const scienceSummary = buildScienceSummary(
    output.predictedCycleLength,
    stdDevDays,
    windowDays,
    cyclesObserved,
    approxWindowProbability
  );

  return {
    hasData: cyclesObserved > 0,
    pointDate: toISODate(output.predictedDate),
    windowDays,
    intervalStartDate: toISODate(intervalStart),
    intervalEndDate: toISODate(intervalEnd),
    predictedCycleLength: output.predictedCycleLength,
    stdDevDays,
    cyclesObserved,
    effectiveCycles: round1(posterior.effectiveN),
    confidence: output.confidence,
    confidenceLabel: output.confidenceLabel,
    approxWindowProbability,
    factors,
    plainSummary,
    scienceSummary,
  };
}

// ─── FACTOR ASSEMBLY ─────────────────────────────────────────────────

/**
 * Human factors. We derive the "how much data / how regular you are" factors
 * from the numbers directly, and translate the predictor's machine tags
 * (factorsUsed) into plain sentences. Ordered most-influential first.
 */
function buildFactors(
  input: PredictionInput,
  output: PredictionOutput,
  posterior: PosteriorPredictive,
  cyclesObserved: number
): ExplanationFactor[] {
  const factors: ExplanationFactor[] = [];

  // 1. How much of your own data we have.
  if (cyclesObserved === 0) {
    factors.push({
      key: 'no_data',
      icon: '🌱',
      label: 'Still learning your rhythm',
      plain:
        'You haven’t logged a full cycle yet, so this is a general estimate. It sharpens with every period you log.',
      effect: 'widens',
    });
  } else {
    factors.push({
      key: 'your_cycles',
      icon: '📆',
      label: 'Your logged cycles',
      plain:
        cyclesObserved === 1
          ? 'We have 1 logged cycle. A couple more and the window tightens noticeably.'
          : `We’re learning from your ${cyclesObserved} logged cycles — more history means a tighter window.`,
      effect: cyclesObserved >= 3 ? 'tightens' : 'widens',
    });
  }

  // 2. How regular YOU are (from the posterior spread).
  if (cyclesObserved > 0) {
    const sd = posterior.std;
    factors.push({
      key: 'your_regularity',
      icon: sd <= 2 ? '🎯' : sd <= 4 ? '〰️' : '🌊',
      label: 'Your own regularity',
      plain:
        sd <= 2
          ? 'Your recent cycles have been very steady, so we can predict a narrow range.'
          : sd <= 4
            ? 'Your cycles vary a little month to month, which sets the width of the window.'
            : 'Your cycles vary quite a bit right now, so we keep the window wide and honest.',
      effect: sd <= 2 ? 'tightens' : 'widens',
    });
  }

  // 3. Recency weighting — always true of the model, worth naming once.
  if (cyclesObserved >= 2) {
    factors.push({
      key: 'recency',
      icon: '⏱️',
      label: 'Recent cycles count more',
      plain:
        'Your most recent cycles carry more weight than older ones, so the prediction follows your current rhythm.',
      effect: 'neutral',
    });
  }

  // 4. Translate the predictor's machine tags into sentences.
  const tagFactors = TAG_FACTORS;
  for (const tag of output.factorsUsed) {
    const f = tagFactors[tag];
    if (f) factors.push({ ...f, key: tag });
  }

  // 5. Body-weight CONTEXT (only if shared AND at a relevant extreme).
  const bmi = computeBmi(input.healthProfile.weightKg, input.healthProfile.heightCm);
  if (bmi !== null && (bmi < 18.5 || bmi > 30)) {
    factors.push({
      key: 'body_context',
      icon: '🫶',
      label: 'Body context',
      plain:
        bmi < 18.5
          ? 'A very low body weight can pause or lengthen cycles for some people, so we widen the window a little.'
          : 'A higher body weight can make cycles longer or less predictable for some people, so we widen the window a little.',
      effect: 'widens',
    });
  }

  return factors;
}

/** Predictor machine tag → human factor (key is overwritten by the tag). */
const TAG_FACTORS: Record<string, Omit<ExplanationFactor, 'key'>> = {
  high_stress_shift: {
    icon: '😮‍💨',
    label: 'Recent stress',
    plain: 'Higher stress lately tends to push periods a little later, so we nudged the date.',
    effect: 'shifts-later',
  },
  poor_sleep_shift: {
    icon: '😴',
    label: 'Recent sleep',
    plain: 'Poorer sleep recently can delay a period slightly, so we accounted for it.',
    effect: 'shifts-later',
  },
  pcos_uncertainty: {
    icon: '🌀',
    label: 'PCOS',
    plain: 'PCOS often means longer, more variable cycles, so we widen the window to stay honest.',
    effect: 'widens',
  },
  thyroid_uncertainty: {
    icon: '🦋',
    label: 'Thyroid',
    plain: 'Thyroid conditions can shift cycle timing, so we allow a little more room.',
    effect: 'widens',
  },
  teen_variability: {
    icon: '🌷',
    label: 'Still finding a rhythm',
    plain: 'In the first years of periods, cycles are naturally irregular — that’s expected, not a problem.',
    effect: 'widens',
  },
  perimenopause_consideration: {
    icon: '🌗',
    label: 'Perimenopause',
    plain: 'Around this life stage cycles can drift, so we keep the window generous.',
    effect: 'widens',
  },
  significant_weight_change: {
    icon: '⚖️',
    label: 'Recent weight change',
    plain: 'A big recent weight change can shift cycle timing, so we widen the window.',
    effect: 'widens',
  },
  pms_detected_narrow: {
    icon: '🩷',
    label: 'PMS signs noticed',
    plain: 'You’ve logged pre-period signs, which suggests your period is close — so we tightened the window.',
    effect: 'tightens',
  },
};

// ─── COPY BUILDERS ───────────────────────────────────────────────────

function buildPlainSummary(date: Date, windowDays: number, cyclesObserved: number): string {
  const pretty = formatFriendly(date);
  const range = `${windowDays} day${windowDays === 1 ? '' : 's'}`;
  if (cyclesObserved === 0) {
    return `While Dottie learns your rhythm, our best estimate is around ${pretty} — but the window is wide on purpose. Log your periods and it gets much sharper.`;
  }
  return `Your next period will most likely start around ${pretty}, give or take ${range}. That window reflects how much your recent cycles have varied — not a guess, but honest uncertainty.`;
}

function buildScienceSummary(
  cycleLength: number,
  stdDevDays: number,
  windowDays: number,
  cyclesObserved: number,
  windowProbability: number
): string {
  const pct = Math.round(windowProbability * 100);
  const from =
    cyclesObserved === 0
      ? 'a population starting point (typical cycle lengths), which is why the window is wide'
      : `your ${cyclesObserved} logged cycle${cyclesObserved === 1 ? '' : 's'}`;
  return (
    `Under the hood, Dottie uses a Bayesian model — a Normal-Inverse-Gamma prior updated into a Student-t prediction. ` +
    `From ${from}, it estimates a typical cycle length of about ${cycleLength} days with a standard deviation of roughly ±${stdDevDays.toFixed(1)} days. ` +
    `The ±${windowDays}-day window shown covers approximately ${pct}% of where your next period is likely to fall. ` +
    `More cycles and steadier lengths narrow this window; things like PCOS, big life changes, or being early in your cycling years widen it. ` +
    `Dottie would rather be honestly uncertain than falsely precise.`
  );
}

// ─── MATH HELPERS ────────────────────────────────────────────────────

/** BMI from kg + cm, or null if either is missing/implausible. */
function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null) return null;
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg < 20 || weightKg > 400 || heightCm < 100 || heightCm > 250) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Normal-approximation two-sided coverage for ±k·SD: P(|Z| ≤ k) = erf(k/√2).
 * The predictive is Student-t, but at these df the normal approx is close
 * enough for a user-facing "~X%" and keeps the number dynamic.
 */
function normalCoverage(k: number): number {
  return erf(k / Math.SQRT2);
}

/** erf approximation (Abramowitz & Stegun 7.1.26), |error| < 1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function formatFriendly(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
