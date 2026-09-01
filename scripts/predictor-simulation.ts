/**
 * Dottie — Predictor + Day-Suggestion Simulation Harness
 *
 * Runs the Bayesian predictor and the v2 day-suggestion engine against a
 * curated set of fake cycle histories, then prints a readable report so we
 * can eyeball whether:
 *
 *   • the predictor's `predictedNextPeriod` and `windowDays` look sane
 *     across regular / irregular / cold-start / drifting / condition-aware
 *     scenarios
 *   • its `confidence` shrinks and window widens for known-hard cases
 *     (PCOS, thyroid, teen, sparse history)
 *   • the day-suggestion engine picks the right SUB-PHASE, hormone story,
 *     personal signals from a fake recent-symptom cluster + check-in, and
 *     surfaces condition-tuned tips
 *   • prediction error shrinks as we feed more cycles through
 *     (the "does the posterior actually learn?" check)
 *
 * This is a static, offline eyeballing tool — NOT a test suite. It answers
 * "does the engine feel right?" without waiting for a device build.
 *
 * ─── RUN IT ─────────────────────────────────────────────────────────
 *
 *   npm run simulate
 *
 *   Or targeted:
 *
 *   npx tsx scripts/predictor-simulation.ts
 *   npx tsx scripts/predictor-simulation.ts --scenario pcos
 *   npx tsx scripts/predictor-simulation.ts --learning
 *
 * ─── NON-GOALS ─────────────────────────────────────────────────────
 *
 *   • Automated regression testing (use Jest / Vitest for that later).
 *   • Model tuning — we only PRINT what the current model does.
 *   • Any UI or store code — pure engine, no React Native imports.
 */

import {
  predictNextPeriod,
  generateFullPrediction,
  calculatePredictionError,
  type PredictionInput,
} from '../src/engine/prediction/predictor';
import {
  buildDaySuggestions,
  type DaySuggestionInput,
  type DaySuggestionSet,
  type DaySuggestionSymptom,
  type DaySuggestionCheckIn,
} from '../src/engine/calendar/day-suggestions';
import type {
  CycleRecord,
  HealthProfile,
  HealthCondition,
  UserMode,
} from '../src/types/cycle.types';

// ─── SCENARIOS ───────────────────────────────────────────────────────

interface Scenario {
  key: string;
  title: string;
  description: string;
  profile: HealthProfile;
  /**
   * Cycle lengths in the user's HISTORY, most-recent-last. The harness
   * chains them into `CycleRecord` entries and sets `lastPeriodStart` to
   * the start of the most recent cycle in that history.
   */
  history: number[];
  /** Optional check-in for today — powers personal signals from mood/energy/etc. */
  checkIn?: DaySuggestionCheckIn;
  /** Optional 7-day symptom log — powers the dominant-symptom personal signal. */
  recentSymptoms?: DaySuggestionSymptom[];
  /** Lifestyle inputs the predictor consumes (last-7d averages). */
  recentStressLevel?: number;
  recentSleepQuality?: number;
}

const TODAY = new Date();
const TODAY_ISO = toISO(TODAY);

const SCENARIOS: Scenario[] = [
  {
    key: 'regular',
    title: 'Regular 28-day cycler (6 cycles logged)',
    description: 'Textbook. Predictor should be tight; sub-phase should hit close to day-in-cycle.',
    profile: adultProfile({}),
    history: [28, 28, 27, 28, 29, 28],
  },
  {
    key: 'pcos',
    title: 'PCOS — irregular 6-cycle history',
    description: 'Wider spread. Confidence should drop, window inflate, prediction softeners kick in.',
    profile: adultProfile({ conditions: ['pcos'] }),
    history: [42, 26, 38, 45, 31, 40],
  },
  {
    key: 'cold_start',
    title: 'Cold start — no cycles yet, only reported length',
    description: 'Predictor should fall back to the population prior, not crash. Widest window.',
    profile: adultProfile({ averageCycleLength: 28 }),
    history: [],
  },
  {
    key: 'teen_sparse',
    title: 'Teen — 2 cycles, wide variance',
    description: 'Teen variability + sparse history: confidence should drop, "teen_variability" factor appears.',
    profile: {
      ...adultProfile({}),
      age: 14,
      mode: 'teen',
      averageCycleLength: null,
    },
    history: [32, 40],
  },
  {
    key: 'thyroid',
    title: 'Hypothyroid — moderately irregular',
    description: 'Confidence slightly lower; day-suggestion engine surfaces thyroid-friendly tips.',
    profile: adultProfile({ conditions: ['thyroid'], averageCycleLength: 32 }),
    history: [34, 30, 36, 33, 31],
  },
  {
    key: 'endo',
    title: 'Endometriosis — recent cramps + heavy days',
    description: 'Day sheet should surface endo-friendly comfort/movement lines; personal signal picks up cramps.',
    profile: adultProfile({ conditions: ['endometriosis'] }),
    history: [29, 28, 30, 27, 28],
    recentSymptoms: [
      { symptomType: 'cramps', severity: 8, date: daysBackISO(1) },
      { symptomType: 'cramps', severity: 9, date: daysBackISO(2) },
      { symptomType: 'cramps', severity: 6, date: daysBackISO(4) },
      { symptomType: 'headache', severity: 3, date: daysBackISO(3) },
    ],
  },
  {
    key: 'stressful_week',
    title: 'Regular cycler having a stressful, low-sleep week',
    description: 'Prediction gets a small mean-shift; personal signals should catch high-stress + poor sleep.',
    profile: adultProfile({}),
    history: [28, 28, 29, 28],
    checkIn: { moodScore: 2, energyLevel: 2, sleepQuality: 2, stressLevel: 5 },
    recentStressLevel: 5,
    recentSleepQuality: 2,
    recentSymptoms: [
      { symptomType: 'headache', severity: 6, date: daysBackISO(1) },
      { symptomType: 'headache', severity: 7, date: daysBackISO(2) },
      { symptomType: 'fatigue', severity: 5, date: daysBackISO(1) },
    ],
  },
  {
    key: 'perimenopause_drift',
    title: 'Perimenopause drift — cycles lengthening over time',
    description: 'History is drifting longer; predictor should follow the recent-weight update.',
    profile: {
      ...adultProfile({}),
      age: 46,
      averageCycleLength: 28,
    },
    history: [28, 29, 31, 34, 38, 42],
  },
];

// ─── ENTRY POINT ─────────────────────────────────────────────────────

function main(): void {
  const args = new Set(process.argv.slice(2));
  const only = args.has('--scenario')
    ? process.argv[process.argv.indexOf('--scenario') + 1]
    : null;
  const runLearning = args.has('--learning');

  header('DOTTIE — PREDICTOR + DAY-SUGGESTION SIMULATION');
  console.log(dim(`Today (harness clock): ${TODAY_ISO}`));

  for (const s of SCENARIOS) {
    if (only && s.key !== only) continue;
    reportScenario(s);
  }

  if (runLearning) {
    header('LEARNING CURVE — does the posterior actually improve?');
    learningCurve();
  }

  console.log('');
  console.log(dim('Done. (Rerun with --learning to see the multi-cycle learning curve.)'));
}

// ─── PER-SCENARIO REPORT ─────────────────────────────────────────────

function reportScenario(s: Scenario): void {
  header(`SCENARIO — ${s.title}`);
  console.log(dim(s.description));

  const { history, profile } = s;
  const cycleRecords = buildCycleRecords(history);
  const lastPeriodStart = latestCycleStart(cycleRecords);

  const input: PredictionInput = {
    cycleHistory: [...cycleRecords].reverse(), // engine expects most-recent first
    healthProfile: profile,
    lastPeriodStart,
    ...(s.recentStressLevel !== undefined ? { recentStressLevel: s.recentStressLevel } : {}),
    ...(s.recentSleepQuality !== undefined ? { recentSleepQuality: s.recentSleepQuality } : {}),
  };
  const pred = predictNextPeriod(input);
  const full = generateFullPrediction(input);

  console.log('');
  console.log(bold('Prediction'));
  console.log(`  Next period    : ${toISO(pred.predictedDate)}  (~${daysBetween(TODAY, pred.predictedDate)}d away)`);
  console.log(`  Window (± days): ${pred.windowDays}`);
  console.log(`  Cycle length   : ${pred.predictedCycleLength} d`);
  console.log(`  Confidence     : ${(pred.confidence * 100).toFixed(1)}%  (${pred.confidenceLabel})`);
  console.log(`  Data maturity  : phase ${pred.predictionPhase} of 3`);
  console.log(`  Factors        : ${pred.factorsUsed.join(', ')}`);
  console.log('');
  console.log(bold('Current-phase snapshot (from full prediction)'));
  console.log(`  Phase          : ${full.currentPhase}`);
  console.log(`  Day-in-cycle   : ${full.dayInCycle}`);
  console.log(`  Day-in-phase   : ${full.dayInPhase}`);
  console.log(`  Ovulation      : ${full.predictedOvulation}`);

  // Day-suggestion engine — TODAY.
  const daysUntil = Math.round((pred.predictedDate.getTime() - TODAY.getTime()) / 86_400_000);
  const suggestionInput: DaySuggestionInput = {
    phase: full.currentPhase,
    dayInCycle: full.dayInCycle,
    daysUntilPredictedPeriod: daysUntil,
    isPeriodDay: full.currentPhase === 'menstrual' && full.dayInPhase <= (profile.averagePeriodLength ?? 5),
    mode: profile.mode,
    conditions: profile.conditions,
    daySeed: TODAY.getDate(),
    ...(s.checkIn ? { todayCheckIn: s.checkIn } : {}),
    ...(s.recentSymptoms ? { recentSymptoms: s.recentSymptoms } : {}),
  };
  const set = buildDaySuggestions(suggestionInput);
  printSuggestionSet(set);
}

function printSuggestionSet(set: DaySuggestionSet): void {
  console.log('');
  console.log(bold("Today's day-suggestions"));
  console.log(`  Sub-phase      : ${set.subphaseLabel}   (${set.phase} · ${set.headline})`);
  console.log(`  Hormone story  : ${wrap(set.hormoneStory, 62, '                   ')}`);
  console.log(`  Culture line   : ${wrap(set.cultureLine, 62, '                   ')}`);
  console.log(`  Companion line : ${wrap(set.companionLine, 62, '                   ')}`);
  if (set.prediction) {
    console.log(`  Prediction chip: ${set.prediction.tone} — ${set.prediction.text}`);
  }
  if (set.personalSignals.length > 0) {
    console.log('');
    console.log(dim('  Personal signals (from user data):'));
    for (const p of set.personalSignals) {
      console.log(`    ${p.emoji}  ${bold(p.title)}   [${p.source}]`);
      console.log(`        ${wrap(p.detail, 60, '        ')}`);
    }
  }
  console.log('');
  console.log(dim(`  Top ${Math.min(3, set.suggestions.length)} suggestions:`));
  for (const s of set.suggestions.slice(0, 3)) {
    const why = s.why ? dim(` — ${s.why}`) : '';
    console.log(`    ${s.emoji}  ${bold(s.title)}${why}`);
    console.log(`        ${wrap(s.detail, 60, '        ')}`);
  }
  console.log('');
  console.log(dim(`  Track-today chips: ${set.trackPrompts.map((t) => `${t.emoji} ${t.label}`).join(' · ')}`));
}

// ─── LEARNING CURVE ──────────────────────────────────────────────────
//
// Feed cycles ONE AT A TIME and print how the prediction error changes.
// Uses the PCOS scenario because irregularity makes any learning obvious.

function learningCurve(): void {
  const groundTruth = [28, 30, 26, 32, 29, 33, 27, 31, 30]; // "true" history we'll reveal one at a time
  const conditions: HealthCondition[] = [];
  const profile: HealthProfile = adultProfile({ conditions });

  console.log('');
  console.log(bold('Fed cycles →  predicted next length  ·  actual next length  ·  error (d)'));
  let known: number[] = [];
  for (let i = 0; i < groundTruth.length - 1; i++) {
    known.push(groundTruth[i]!);
    const nextActual = groundTruth[i + 1]!;
    const records = buildCycleRecords(known);
    const lastStart = latestCycleStart(records);
    const pred = predictNextPeriod({
      cycleHistory: [...records].reverse(),
      healthProfile: profile,
      lastPeriodStart: lastStart,
    });
    const predictedDate = pred.predictedDate;
    const actualDate = addDays(lastStart, nextActual);
    const err = calculatePredictionError(predictedDate, actualDate);
    console.log(
      `  ${String(known.length).padStart(2)} cycles     →  ${String(pred.predictedCycleLength).padStart(4)} d           ·  ${String(nextActual).padStart(4)} d           ·  ${err >= 0 ? '+' : ''}${err} d   (conf ${(pred.confidence * 100).toFixed(0)}%, ± ${pred.windowDays}d)`
    );
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function adultProfile(overrides: Partial<HealthProfile>): HealthProfile {
  return {
    age: 30,
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

/**
 * Build a chain of CycleRecords from cycle lengths, ending at TODAY (the
 * most recent cycle's end is TODAY). Each record's dates are stitched so
 * `startDate[i+1] = startDate[i] + cycleLength[i]`.
 */
function buildCycleRecords(cycleLengths: number[]): CycleRecord[] {
  if (cycleLengths.length === 0) return [];
  const totalDays = cycleLengths.reduce((a, b) => a + b, 0);
  const firstStart = addDays(TODAY, -totalDays);
  const records: CycleRecord[] = [];
  let cursor = firstStart;
  for (const len of cycleLengths) {
    const periodLen = 5;
    const end = addDays(cursor, periodLen - 1);
    records.push({
      startDate: toISO(cursor),
      endDate: toISO(end),
      cycleLength: len,
      periodLength: periodLen,
      averageFlow: 3,
    });
    cursor = addDays(cursor, len);
  }
  return records;
}

function latestCycleStart(records: CycleRecord[]): Date {
  if (records.length === 0) return TODAY;
  const last = records[records.length - 1]!;
  return new Date(last.startDate + 'T00:00:00');
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function daysBackISO(n: number): string {
  return toISO(addDays(TODAY, -n));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

// ─── PRESENTATION ────────────────────────────────────────────────────

const ESC = '\x1b[';
function bold(s: string): string { return `${ESC}1m${s}${ESC}22m`; }
function dim(s: string): string  { return `${ESC}2m${s}${ESC}22m`; }

function header(text: string): void {
  const bar = '─'.repeat(Math.max(20, text.length));
  console.log('');
  console.log(bold(bar));
  console.log(bold(text));
  console.log(bold(bar));
}

function wrap(text: string, width: number, indent: string): string {
  if (text.length <= width) return text;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur += ' ' + w;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join('\n' + indent);
}

main();
