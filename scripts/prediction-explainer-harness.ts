/**
 * Dottie — Prediction Explainer Harness
 *
 * Assertive invariants for `explainPrediction()` (src/engine/prediction/
 * explain-prediction.ts) — the pure layer behind the owner-requested
 * "how your next period is predicted" card.
 *
 * The card must be scientifically honest AND consistent with the rest of the
 * app (same ± window the calendar shades). These invariants lock that in so a
 * future refactor can't quietly make the explainer lie or drift.
 *
 * Run: npm run test:explainer
 */

import { explainPrediction } from '../src/engine/prediction/explain-prediction';
import type { PredictionInput } from '../src/engine/prediction/predictor';
import type { CycleRecord, HealthProfile, UserMode } from '../src/types/cycle.types';

// ─── SMALL FRAMEWORK (matches predictor harness) ─────────────────────

let failures = 0;
let current = '';

function scenario(name: string, fn: () => void): void {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✗ threw: ${(err as Error).message}\x1b[0m`);
  }
}

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${current}")`);
}

// ─── FIXTURES ────────────────────────────────────────────────────────

function profile(overrides: Partial<HealthProfile> = {}): HealthProfile {
  return {
    age: 28,
    mode: 'adult' as UserMode,
    conditions: [],
    weightKg: null,
    heightCm: null,
    activityLevel: null,
    averageCycleLength: 28,
    averagePeriodLength: 5,
    onMedications: false,
    ...overrides,
  };
}

function history(lengths: number[]): CycleRecord[] {
  const records: CycleRecord[] = [];
  let cursor = new Date();
  for (const len of lengths) {
    const end = new Date(cursor);
    const start = new Date(cursor.getTime() - len * 86400000);
    records.push({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      cycleLength: len,
      periodLength: 5,
      averageFlow: 3,
    });
    cursor = start;
  }
  return records;
}

function explain(hist: CycleRecord[], hp: HealthProfile, extras: Partial<PredictionInput> = {}) {
  const input: PredictionInput = {
    cycleHistory: hist,
    healthProfile: hp,
    lastPeriodStart: new Date(Date.now() - 3 * 86400000),
    ...extras,
  };
  return explainPrediction(input);
}

function hasFactor(e: ReturnType<typeof explain>, key: string): boolean {
  return e.factors.some((f) => f.key === key);
}

// ─── SHARED INVARIANTS (asserted on every explanation) ───────────────

function assertUniversalInvariants(e: ReturnType<typeof explain>): void {
  ok('interval brackets the point date', e.intervalStartDate < e.pointDate && e.pointDate < e.intervalEndDate,
    `${e.intervalStartDate} < ${e.pointDate} < ${e.intervalEndDate}`);
  ok('window probability strictly in (0,1)', e.approxWindowProbability > 0 && e.approxWindowProbability < 1,
    `got ${e.approxWindowProbability}`);
  ok('stdDev is positive', e.stdDevDays > 0, `got ${e.stdDevDays}`);
  ok('windowDays >= 1', e.windowDays >= 1, `got ${e.windowDays}`);
  ok('every factor has key+label+plain', e.factors.every((f) => f.key && f.label && f.plain));
  ok('plainSummary is non-empty', e.plainSummary.length > 0);
  ok('scienceSummary names the model', /Bayesian/.test(e.scienceSummary));
  ok('scienceSummary states the stdDev number', e.scienceSummary.includes(e.stdDevDays.toFixed(1)));
}

// ─── SCENARIOS ───────────────────────────────────────────────────────

console.log('\x1b[1m\nDottie — Prediction explainer harness\x1b[0m');

scenario('E1 — cold start (0 cycles logged)', () => {
  const e = explain([], profile());
  assertUniversalInvariants(e);
  ok('hasData is false', e.hasData === false);
  ok('cyclesObserved is 0', e.cyclesObserved === 0);
  ok('shows the "still learning" factor', hasFactor(e, 'no_data'));
  ok('confidence label is "learning"', e.confidenceLabel === 'learning', `got ${e.confidenceLabel}`);
  ok('window is wide with no data (>= 4)', e.windowDays >= 4, `got ${e.windowDays}`);
  ok('plain summary frames it as an estimate', /estimate|learn/i.test(e.plainSummary));
});

const regular = explain(history([28, 27, 29, 28, 28, 27, 29, 28, 28, 29, 27, 28]), profile());
scenario('E2 — regular mature cycler (12 steady cycles)', () => {
  assertUniversalInvariants(regular);
  ok('hasData is true', regular.hasData === true);
  ok('surfaces "your logged cycles"', hasFactor(regular, 'your_cycles'));
  ok('logged-cycles factor tightens with >=3 cycles',
    regular.factors.find((f) => f.key === 'your_cycles')?.effect === 'tightens');
  ok('surfaces "your own regularity"', hasFactor(regular, 'your_regularity'));
  ok('steady cycles → small stdDev (< 3.5)', regular.stdDevDays < 3.5, `got ${regular.stdDevDays}`);
  ok('effectiveCycles > 1', regular.effectiveCycles > 1, `got ${regular.effectiveCycles}`);
  ok('confidence is decent (>= moderate)',
    ['moderate', 'good', 'high'].includes(regular.confidenceLabel), `got ${regular.confidenceLabel}`);
});

const pcos = explain(history([34, 41, 28, 52, 33, 45]), profile({ conditions: ['pcos'] }));
scenario('E3 — PCOS, irregular cycles', () => {
  assertUniversalInvariants(pcos);
  ok('surfaces the PCOS factor', hasFactor(pcos, 'pcos_uncertainty'));
  ok('PCOS factor widens the window', pcos.factors.find((f) => f.key === 'pcos_uncertainty')?.effect === 'widens');
  ok('irregular → wider window than the regular cycler', pcos.windowDays >= regular.windowDays,
    `pcos ${pcos.windowDays} vs regular ${regular.windowDays}`);
  ok('irregular → larger stdDev than the regular cycler', pcos.stdDevDays > regular.stdDevDays,
    `pcos ${pcos.stdDevDays} vs regular ${regular.stdDevDays}`);
});

scenario('E4 — lifestyle shift (high stress + poor sleep)', () => {
  const e = explain(history([28, 28, 28, 28]), profile(), {
    recentStressLevel: 5,
    recentSleepQuality: 1,
  });
  assertUniversalInvariants(e);
  ok('surfaces the stress factor', hasFactor(e, 'high_stress_shift'));
  ok('stress factor shifts later', e.factors.find((f) => f.key === 'high_stress_shift')?.effect === 'shifts-later');
  ok('surfaces the sleep factor', hasFactor(e, 'poor_sleep_shift'));
  ok('predicted length pushed out vs a steady 28-day baseline', e.predictedCycleLength >= 29,
    `got ${e.predictedCycleLength}`);
});

scenario('E5 — PMS signs detected narrows the window', () => {
  const e = explain(history([28, 28, 28, 28]), profile(), { premenstrualSymptomsDetected: true });
  assertUniversalInvariants(e);
  ok('surfaces the PMS factor', hasFactor(e, 'pms_detected_narrow'));
  ok('PMS factor tightens', e.factors.find((f) => f.key === 'pms_detected_narrow')?.effect === 'tightens');
});

scenario('E6 — body-weight context only appears at real extremes', () => {
  const low = explain(history([28, 28, 28]), profile({ weightKg: 45, heightCm: 170 })); // BMI ~15.6
  ok('very low BMI → body_context factor', hasFactor(low, 'body_context'));
  ok('body_context widens', low.factors.find((f) => f.key === 'body_context')?.effect === 'widens');

  const normal = explain(history([28, 28, 28]), profile({ weightKg: 60, heightCm: 165 })); // BMI ~22
  ok('normal BMI → NO body_context factor', !hasFactor(normal, 'body_context'));

  const unknown = explain(history([28, 28, 28]), profile()); // no height/weight shared
  ok('missing height/weight → NO body_context factor', !hasFactor(unknown, 'body_context'));
});

scenario('E7 — more data increases effective cycle count', () => {
  const few = explain(history([28, 28]), profile());
  const many = explain(history([28, 28, 28, 28, 28, 28, 28, 28]), profile());
  ok('effectiveCycles grows with more logged cycles', many.effectiveCycles > few.effectiveCycles,
    `few ${few.effectiveCycles} vs many ${many.effectiveCycles}`);
  ok('more data does not widen the window', many.windowDays <= few.windowDays,
    `few ${few.windowDays} vs many ${many.windowDays}`);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Prediction explainer harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
