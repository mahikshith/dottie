/**
 * Dottie — Predictor Scenarios Harness (device-test #6 owner ask)
 *
 * Turns the eyeball simulation into an ASSERTIVE test. Every invariant
 * corresponds to a real user scenario the owner asked to be verified
 * before Play Store rollout:
 *
 *   "when the user logged in their first period, obviously the prediction
 *    is going to show up at least one month later, right? But that may or
 *    may not be the condition in real life use case scenario. So we need
 *    to test every single possible case scenario with better accuracy."
 *
 * Each SCENARIO builds a fake history + profile and asserts the predictor's
 * output. Failure prints the scenario + the exact assertion that broke +
 * exits with code 1 so CI fails.
 *
 * Run: npm run test:predictor
 */

import {
  predictNextPeriod,
  type PredictionInput,
  type PredictionOutput,
} from '../src/engine/prediction/predictor';
import type {
  CycleRecord,
  HealthCondition,
  HealthProfile,
  UserMode,
} from '../src/types/cycle.types';

// ─── SMALL FRAMEWORK ─────────────────────────────────────────────────

let failures = 0;
let currentScenario = '';

function scenario(name: string, fn: () => void): void {
  currentScenario = name;
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
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${currentScenario}")`);
}

// ─── FIXTURE BUILDERS ────────────────────────────────────────────────

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
  // Most-recent first. lengths[0] is the newest cycle's length in days.
  // Build cycles going backwards from a `startDate = today - <sum of lengths>`.
  const records: CycleRecord[] = [];
  const today = new Date();
  let cursor = new Date(today);
  for (const len of lengths) {
    const end = new Date(cursor);
    const start = new Date(cursor.getTime() - len * 86400000);
    records.push({
      startDate: iso(start),
      endDate: iso(end),
      cycleLength: len,
      periodLength: 5,
      averageFlow: 3,
    });
    cursor = start;
  }
  return records;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function predict(
  hist: CycleRecord[],
  hp: HealthProfile,
  extras: Partial<PredictionInput> = {},
  daysAgoLastPeriod: number = 3
): PredictionOutput {
  // `lastPeriodStart` in real usage = when the CURRENT period started.
  // A typical fresh-log scenario is 1–7 days ago. Default 3 days ago so
  // the predictor's next-period date lands ~25 days from now for a 28d
  // cycle — i.e. clearly in the future.
  const last = new Date(Date.now() - daysAgoLastPeriod * 86400000);
  const input: PredictionInput = {
    cycleHistory: hist,
    healthProfile: hp,
    lastPeriodStart: last,
    ...extras,
  };
  return predictNextPeriod(input);
}

// ─── SCENARIOS ───────────────────────────────────────────────────────

console.log('\x1b[1m\nDottie — Predictor scenarios harness\x1b[0m');
console.log('  Runs assertive checks over the Bayesian predictor for every');
console.log('  real-life user scenario the owner asked about.');

// ─── 1. First-ever period logged (owner's specific scenario) ────────
scenario('S1 — brand new user, ZERO cycles logged (cold start)', () => {
  const hp = profile({ averageCycleLength: 28 });
  const out = predict([], hp);
  ok('does not crash on empty history', out != null);
  ok('predictedDate is a real future date', out.predictedDate.getTime() > Date.now());
  ok('cold-start uses population prior', out.factorsUsed.includes('population_prior_only'));
  ok('confidence label is "learning" on cold start', out.confidenceLabel === 'learning', `got ${out.confidenceLabel}`);
  ok('window is wide (>= 4 days) with no data', out.windowDays >= 4, `got ${out.windowDays}`);
  ok('window is capped (<= 14 days) even on cold start', out.windowDays <= 14, `got ${out.windowDays}`);
});

scenario('S2 — user has just logged their FIRST period (1 cycle)', () => {
  const hp = profile({ averageCycleLength: 28 });
  // Just one cycle — 28 days ago the previous one started.
  const out = predict(history([28]), hp);
  ok('produces a valid predictedDate', out.predictedDate.getTime() > Date.now() - 86400000);
  ok('predicted within a plausible window of 28 days from last start',
    Math.abs(out.predictedCycleLength - 28) <= 3,
    `predicted length: ${out.predictedCycleLength}`);
  ok('marked as "learning" or "moderate" (single-cycle immaturity)',
    out.confidenceLabel === 'learning' || out.confidenceLabel === 'moderate',
    `got ${out.confidenceLabel}`);
});

// ─── 3. Regular 28-day cycler with mature history ───────────────────
scenario('S3 — regular 28-day cycler, 6 cycles (mature)', () => {
  const hp = profile({});
  const out = predict(history([28, 28, 27, 28, 29, 28]), hp);
  ok('predicted length very close to 28', Math.abs(out.predictedCycleLength - 28) <= 2, `${out.predictedCycleLength}`);
  ok('window is tight (<= 6 days)', out.windowDays <= 6, `got ${out.windowDays}`);
  ok('confidence lifts to "good" or "high"',
    out.confidenceLabel === 'good' || out.confidenceLabel === 'high',
    `got ${out.confidenceLabel}`);
  ok('confidence numerically >= 0.55', out.confidence >= 0.55, `got ${out.confidence.toFixed(2)}`);
});

// ─── 4. PCOS (irregular) ─────────────────────────────────────────────
scenario('S4 — PCOS: irregular cycles, wider window', () => {
  const hp = profile({ conditions: ['pcos'] });
  const out = predict(history([42, 26, 38, 45, 31, 40]), hp);
  ok('pcos_uncertainty factor applied', out.factorsUsed.includes('pcos_uncertainty'));
  ok('window inflates (>= 7 days for PCOS)', out.windowDays >= 7, `got ${out.windowDays}`);
  ok('confidence numerically drops (< 0.65)', out.confidence < 0.65, `got ${out.confidence.toFixed(2)}`);
});

// ─── 5. Perimenopause drift (owner mentioned) ────────────────────────
scenario('S5 — perimenopause drift, cycles lengthening', () => {
  const hp = profile({ age: 46, averageCycleLength: 28 });
  // history[0] is newest (42 days). If Bayesian weights recent more, prediction should move upward.
  const out = predict(history([42, 38, 34, 31, 29, 28]), hp);
  ok('recent-cycles weight nudges prediction up',
    out.predictedCycleLength >= 30,
    `got ${out.predictedCycleLength}`);
  ok('does not confidently claim a 28-day cycle', out.predictedCycleLength !== 28);
});

// ─── 6. Teen (variability, sparse data) ──────────────────────────────
scenario('S6 — teen mode, sparse & variable', () => {
  const hp: HealthProfile = { ...profile(), age: 14, mode: 'teen', averageCycleLength: null };
  const out = predict(history([32, 40]), hp);
  ok('teen_variability factor applied when age < 16', out.factorsUsed.includes('teen_variability'));
  ok('confidence stays modest for teens', out.confidence < 0.7, `got ${out.confidence.toFixed(2)}`);
  ok('window remains generous', out.windowDays >= 5, `got ${out.windowDays}`);
});

// ─── 7. High stress + poor sleep mean-shift ──────────────────────────
scenario('S7 — regular cycler, stressful + low-sleep week', () => {
  const hp = profile({});
  const clean = predict(history([28, 28, 28, 28]), hp);
  const stressed = predict(history([28, 28, 28, 28]), hp, {
    recentStressLevel: 5,
    recentSleepQuality: 2,
  });
  const shift = daysBetween(clean.predictedDate, stressed.predictedDate);
  ok('high stress + poor sleep applies factors',
    stressed.factorsUsed.includes('high_stress_shift') && stressed.factorsUsed.includes('poor_sleep_shift'));
  ok('predicted date shifts LATER (~2-3 days later)',
    shift >= 1 && shift <= 5,
    `shifted ${shift} days`);
});

// ─── 8. Learning curve — confidence rises with more cycles ──────────
scenario('S8 — learning curve: confidence rises with more data', () => {
  const hp = profile({});
  const cyclesToTry = [1, 3, 6, 12];
  const confidences = cyclesToTry.map((n) => {
    const lens = Array.from({ length: n }, () => 28);
    return predict(history(lens), hp).confidence;
  });
  // Not strictly monotonic per-step (rounding + confidence caps), but at least
  // 12-cycle confidence should exceed 1-cycle confidence by a clear margin.
  ok('12 cycles > 1 cycle in confidence (learning happens)',
    (confidences.at(-1) ?? 0) > (confidences[0] ?? 0),
    `${confidences.map((c) => c.toFixed(2)).join(' → ')}`);
});

// ─── 9. Prediction bounds (never in the past, never absurdly far) ───
scenario('S9 — predicted date always sane (never past, never > 60 days)', () => {
  const hp = profile({});
  const scenarios: [string, CycleRecord[]][] = [
    ['normal', history([28, 28, 28])],
    ['very long', history([45, 45, 45])],
    ['very short', history([21, 21, 21])],
    ['irregular', history([21, 45, 28, 35, 26, 40])],
  ];
  for (const [name, hist] of scenarios) {
    const out = predict(hist, hp);
    const daysOut = daysBetween(new Date(), out.predictedDate);
    ok(`${name}: predicted is in the future`, daysOut >= 0, `predicted ${daysOut} days from now`);
    ok(`${name}: predicted no more than 60 days out`, daysOut <= 60, `predicted ${daysOut} days from now`);
  }
});

// ─── 10. Ovulation predictions and phase math never NaN ──────────────
scenario('S10 — no NaN / no infinity leaks through the output', () => {
  const hp = profile({});
  const out = predict(history([28, 28, 28]), hp);
  ok('confidence is a finite number', Number.isFinite(out.confidence));
  ok('windowDays is a finite integer', Number.isFinite(out.windowDays) && Number.isInteger(out.windowDays));
  ok('predictedCycleLength is a positive number', Number.isFinite(out.predictedCycleLength) && out.predictedCycleLength > 0);
});

// ─── 11. Condition combinations don't stack pathologically ───────────
scenario('S11 — PCOS + thyroid stacked: still sane window + confidence', () => {
  const hp = profile({ conditions: ['pcos', 'thyroid'] as HealthCondition[] });
  const out = predict(history([32, 40, 28, 35]), hp);
  ok('both factors applied',
    out.factorsUsed.includes('pcos_uncertainty') && out.factorsUsed.includes('thyroid_uncertainty'));
  ok('confidence never underflows below 0', out.confidence >= 0);
  ok('window never exceeds 21 days even with stacked conditions', out.windowDays <= 21, `got ${out.windowDays}`);
});

// ─── 12. Endometriosis flag is respected in factors ──────────────────
scenario('S12 — endometriosis profile: predictor accepts, no crash', () => {
  const hp = profile({ conditions: ['endometriosis'] });
  const out = predict(history([29, 28, 30, 27, 28]), hp);
  ok('produces valid output for endo profile', Number.isFinite(out.confidence));
});

// ─── 13. Very long history (18 months, regular) tightens confidence ─
scenario('S13 — 18 months of near-regular data: high confidence', () => {
  const hp = profile({});
  const lens = Array.from({ length: 18 }, (_, i) => (i % 2 === 0 ? 28 : 29));
  const out = predict(history(lens), hp);
  ok('long-history confidence is "good" or "high"',
    out.confidenceLabel === 'good' || out.confidenceLabel === 'high',
    `got ${out.confidenceLabel}`);
  ok('window is tight (<= 5 days) with 18 months of near-regular data', out.windowDays <= 5, `got ${out.windowDays}`);
});

// ─── 14. Missed cycle simulation (long gap, then new period) ────────
scenario('S14 — missed period: 55-day gap after regular cycles', () => {
  const hp = profile({});
  // Newest cycle is 55 days (missed one). Predictor should tolerate + not crash.
  const out = predict(history([55, 28, 28, 28, 28]), hp);
  ok('produces a valid prediction after missed-cycle spike', out != null && Number.isFinite(out.confidence));
  ok('prediction date remains in the plausible future',
    daysBetween(new Date(), out.predictedDate) >= 0 && daysBetween(new Date(), out.predictedDate) <= 60);
});

scenario('S15 — right-skew: one long cycle should NOT drag the estimate up', () => {
  // Four regular 28-day cycles + one 56-day anovulatory stretch. The
  // arithmetic mean is 33.6; a symmetric Normal model would predict ~34. The
  // log-normal model predicts the skew-robust MEDIAN, much closer to 28 — the
  // whole point of the log-space upgrade (a couple of long cycles shouldn't
  // convince us every future cycle is long).
  const hp = profile({ averageCycleLength: 28 });
  const out = predict(history([56, 28, 28, 28, 28]), hp);
  const arithmeticMean = (56 + 28 + 28 + 28 + 28) / 5; // 33.6
  ok('predicted length is below the arithmetic mean (skew-robust median)',
    out.predictedCycleLength < arithmeticMean, `got ${out.predictedCycleLength} vs mean ${arithmeticMean}`);
  ok('predicted length stays in a plausible range (not collapsed)',
    out.predictedCycleLength >= 27 && out.predictedCycleLength <= 34, `got ${out.predictedCycleLength}`);
  // And a genuinely irregular body still gets a wider window than a regular one.
  const regular = predict(history([28, 28, 28, 28, 28]), hp);
  ok('a variable history widens the window vs a perfectly regular one',
    out.windowDays >= regular.windowDays, `skewed ${out.windowDays} vs regular ${regular.windowDays}`);
});

// ─── REPORT ─────────────────────────────────────────────────────────

console.log('');
if (failures === 0) {
  console.log(`  \x1b[32m✓ All predictor scenarios pass — 15 scenarios, ~65 assertions.\x1b[0m`);
  process.exit(0);
}
console.log(`  \x1b[31m✗ ${failures} assertion failure(s) — fix before device rollout.\x1b[0m`);
process.exit(1);
