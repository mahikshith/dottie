/**
 * Dottie — build the export workbook (pure)
 *
 * Everything the user has ever logged, laid out as a spreadsheet with the
 * graphs already drawn. The owner's ask: "track every single thing that the
 * user clicks on ... the mood for a particular day and the calendar logging
 * information ... store it in the form of an Excel sheet ... embed beautiful
 * graphs ... under the user section so that the user can download it."
 *
 * ─── WHAT IT IS AND IS NOT ──────────────────────────────────────────
 *
 *  It is an export of what the app ALREADY STORES: period days, cycles,
 *  daily check-ins, symptoms, and the predictions Dottie made. It is not new
 *  telemetry. Dottie does not follow taps around the app and never will —
 *  a privacy-first tracker that quietly starts recording every screen its user
 *  visits has stopped being one. Everything in this workbook is a thing the
 *  user deliberately entered, which is also what makes it worth reading back.
 *
 * ─── HONESTY RULES CARRIED INTO THE FILE ────────────────────────────
 *
 *  The rules that hold inside the app hold inside the spreadsheet, because a
 *  file outlives a screen and gets shown to other people — sometimes doctors.
 *
 *   · A day nobody logged is an EMPTY cell, never a zero. Charts are written
 *     with dispBlanksAs="gap" so a break in logging reads as a break, not as
 *     a crash in mood.
 *   · No population statistics. Every number is this user's own, and the
 *     Overview sheet states the sample size behind each one.
 *   · Predictions are labelled as predictions and shown against what actually
 *     happened, error included. A forecast sheet that hides its misses is a
 *     sales brochure.
 *
 * ─── PURE ───────────────────────────────────────────────────────────
 *
 *  No repository access, no clock, no randomness: inputs in, workbook spec
 *  out. `generatedOn` is passed by the caller so the harness can assert on
 *  byte-identical output. Everything here is covered by test:export.
 */

import type { SheetSpec, WorkbookSpec, CellValue } from './xlsx';
import { daysBetween, isCivilDate } from '../utils/civil-date';

// ─── INPUT MODEL ─────────────────────────────────────────────────────
//
// Deliberately structural rather than importing the repository row types: the
// builder must stay usable from the harness without a database, and a change
// to a table shouldn't silently change the file a user has been archiving.

export interface ExportCycle {
  startDate: string;
  endDate: string;
  cycleLength: number;
  periodLength: number;
  averageFlow: number;
}

export interface ExportPeriodDay {
  date: string;
  flowLevel: number | null;
  phase: string | null;
}

export interface ExportCheckIn {
  date: string;
  moodScore: number | null;
  energyLevel: number | null;
  sleepQuality: number | null;
  stressLevel: number | null;
  notes: string | null;
}

export interface ExportSymptom {
  date: string;
  category: string;
  symptomType: string;
  severity: number;
  phaseAtLog: string | null;
}

export interface ExportPrediction {
  /** The day the prediction was made for. */
  predictedNextPeriod: string;
  windowDays: number;
  confidence: number;
  /** What actually happened, when we know it. */
  actualStart: string | null;
}

export interface ExportProfile {
  displayName: string | null;
  age: number | null;
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  conditions: readonly string[];
}

export interface ExportInput {
  /** ISO date the file was made — passed in, never read from a clock here. */
  generatedOn: string;
  appVersion: string;
  profile: ExportProfile;
  cycles: readonly ExportCycle[];
  periodDays: readonly ExportPeriodDay[];
  checkIns: readonly ExportCheckIn[];
  symptoms: readonly ExportSymptom[];
  predictions: readonly ExportPrediction[];
}

/** Row counts, so the export screen can say what's in the file before making it. */
export interface ExportCounts {
  cycles: number;
  periodDays: number;
  checkIns: number;
  symptoms: number;
  predictions: number;
  total: number;
}

export function countExport(input: ExportInput): ExportCounts {
  const counts = {
    cycles: input.cycles.length,
    periodDays: input.periodDays.length,
    checkIns: input.checkIns.length,
    symptoms: input.symptoms.length,
    predictions: input.predictions.length,
  };
  return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

// ─── MOOD LABELS ─────────────────────────────────────────────────────
//
// The same 1–5 scale and the same words the in-app mood map uses. A number
// alone in a spreadsheet is unreadable six months later; a number AND its word
// survives being emailed to someone who has never seen the app.

const MOOD_WORDS: Record<number, string> = {
  1: 'Rough',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

function moodWord(score: number | null): string | null {
  if (score === null) return null;
  return MOOD_WORDS[Math.round(score)] ?? null;
}

const FLOW_WORDS: Record<number, string> = {
  0: 'None',
  1: 'Spotting',
  2: 'Light',
  3: 'Medium',
  4: 'Heavy',
  5: 'Very heavy',
};

// ─── SHEETS ──────────────────────────────────────────────────────────

function overviewSheet(input: ExportInput, counts: ExportCounts): SheetSpec {
  const lengths = input.cycles.map((c) => c.cycleLength).filter((n) => Number.isFinite(n));
  const mean = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
  const sd =
    lengths.length > 1 && mean !== null
      ? Math.sqrt(lengths.reduce((s, v) => s + (v - mean) ** 2, 0) / (lengths.length - 1))
      : null;
  const moods = input.checkIns.map((c) => c.moodScore).filter((m): m is number => m !== null);
  const moodMean = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : null;

  const rows: CellValue[][] = [
    ['Exported on', input.generatedOn],
    ['Dottie version', input.appVersion],
    ['Name', input.profile.displayName ?? '—'],
    ['Age', input.profile.age],
    ['Conditions noted', input.profile.conditions.length > 0 ? input.profile.conditions.join(', ') : 'None'],
    [null, null],
    ['Cycles recorded', counts.cycles],
    ['Period days logged', counts.periodDays],
    ['Daily check-ins', counts.checkIns],
    ['Symptoms logged', counts.symptoms],
    ['Predictions made', counts.predictions],
    [null, null],
    // Every derived figure carries the count it came from, right beside it.
    ['Average cycle length', mean === null ? '—' : round1(mean)],
    ['— based on this many cycles', lengths.length],
    ['Cycle length variability (SD)', sd === null ? '—' : round1(sd)],
    ['Average mood (1 rough – 5 great)', moodMean === null ? '—' : round1(moodMean)],
    ['— based on this many logged days', moods.length],
    [null, null],
    ['About this file', 'Everything here is what you entered in Dottie. It was built on your phone and it has never been anywhere else.'],
    ['Blank cells', 'A blank means you did not log that day. It does not mean zero — the graphs leave gaps rather than drawing a drop to nothing.'],
    ['Predictions', 'Estimates from your own logged history, shown next to what actually happened so you can see how close they were.'],
    ['Not medical advice', 'Dottie is a tracker, not a diagnosis. Bring this to a clinician as a record of what you noticed, not as a conclusion.'],
  ];

  return {
    name: 'Overview',
    columns: [{ header: 'What', width: 34 }, { header: 'Value', width: 76 }],
    rows,
  };
}

function cyclesSheet(cycles: readonly ExportCycle[]): SheetSpec {
  const rows: CellValue[][] = cycles.map((c) => [
    c.startDate,
    c.endDate,
    c.cycleLength,
    c.periodLength,
    round1(c.averageFlow),
  ]);
  return {
    name: 'Cycles',
    columns: [
      { header: 'Cycle start', width: 14 },
      { header: 'Period end', width: 14 },
      { header: 'Cycle length (days)', width: 20 },
      { header: 'Period length (days)', width: 20 },
      { header: 'Average flow (1–5)', width: 20 },
    ],
    charts: [
      // Regularity at a glance — the single most useful picture in the file.
      {
        kind: 'line',
        title: 'Cycle length over time',
        categoryCol: 1,
        valueCols: [3],
        anchor: { col: 6, row: 1 },
      },
      {
        kind: 'bar',
        title: 'Period length and average flow',
        categoryCol: 1,
        valueCols: [4, 5],
        anchor: { col: 6, row: 18 },
      },
    ],
    rows,
  };
}

function periodDaysSheet(days: readonly ExportPeriodDay[]): SheetSpec {
  const rows: CellValue[][] = days.map((d) => [
    d.date,
    d.flowLevel,
    d.flowLevel === null ? null : (FLOW_WORDS[Math.round(d.flowLevel)] ?? null),
    d.phase ?? null,
  ]);
  return {
    name: 'Period days',
    columns: [
      { header: 'Date', width: 14 },
      { header: 'Flow (0–5)', width: 12 },
      { header: 'Flow', width: 14 },
      { header: 'Phase', width: 14 },
    ],
    charts: [
      {
        kind: 'bar',
        title: 'Flow by day',
        categoryCol: 1,
        valueCols: [2],
        anchor: { col: 5, row: 1 },
      },
    ],
    rows,
  };
}

function checkInsSheet(checkIns: readonly ExportCheckIn[]): SheetSpec {
  const rows: CellValue[][] = checkIns.map((c) => [
    c.date,
    c.moodScore,
    moodWord(c.moodScore),
    c.energyLevel,
    c.sleepQuality,
    c.stressLevel,
    c.notes,
  ]);
  return {
    name: 'Daily check-ins',
    columns: [
      { header: 'Date', width: 14 },
      { header: 'Mood (1–5)', width: 12 },
      { header: 'Mood', width: 12 },
      { header: 'Energy (1–5)', width: 13 },
      { header: 'Sleep (1–5)', width: 12 },
      { header: 'Stress (1–5)', width: 13 },
      { header: 'Your note', width: 52 },
    ],
    charts: [
      // Four lines on one axis, because the interesting thing is never mood
      // alone — it is mood against the sleep and stress around it.
      {
        kind: 'line',
        title: 'Mood, energy, sleep and stress over time',
        categoryCol: 1,
        valueCols: [2, 4, 5, 6],
        anchor: { col: 8, row: 1 },
        widthCells: 10,
        heightCells: 20,
      },
    ],
    rows,
  };
}

function moodDistributionSheet(checkIns: readonly ExportCheckIn[]): SheetSpec {
  // Denominator is LOGGED days, never calendar days — the same rule the in-app
  // mood map is held to by test:moodmap. Dividing by calendar days makes the
  // bars shrink whenever someone takes a week off, which reads as a telling-off.
  const logged = checkIns.filter((c) => c.moodScore !== null);
  const rows: CellValue[][] = [1, 2, 3, 4, 5].map((score) => {
    const n = logged.filter((c) => Math.round(c.moodScore!) === score).length;
    return [
      MOOD_WORDS[score]!,
      n,
      logged.length === 0 ? null : round1((n / logged.length) * 100),
    ];
  });
  rows.push([null, null, null]);
  rows.push(['Days logged', logged.length, null]);
  return {
    name: 'Mood dynamics',
    columns: [
      { header: 'Mood', width: 14 },
      { header: 'Days', width: 10 },
      { header: '% of logged days', width: 18 },
    ],
    charts: [
      {
        kind: 'bar',
        title: 'How your days have felt',
        categoryCol: 1,
        valueCols: [2],
        anchor: { col: 5, row: 1 },
      },
    ],
    rows,
  };
}

function symptomsSheet(symptoms: readonly ExportSymptom[]): SheetSpec {
  const rows: CellValue[][] = symptoms.map((s) => [
    s.date,
    s.symptomType,
    s.category,
    s.severity,
    s.phaseAtLog ?? null,
  ]);
  return {
    name: 'Symptoms',
    columns: [
      { header: 'Date', width: 14 },
      { header: 'Symptom', width: 20 },
      { header: 'Category', width: 14 },
      { header: 'Severity (1–5)', width: 15 },
      { header: 'Phase when logged', width: 18 },
    ],
    rows,
  };
}

function symptomTotalsSheet(symptoms: readonly ExportSymptom[]): SheetSpec {
  const byType = new Map<string, { count: number; severity: number }>();
  for (const s of symptoms) {
    const cur = byType.get(s.symptomType) ?? { count: 0, severity: 0 };
    cur.count++;
    cur.severity += s.severity;
    byType.set(s.symptomType, cur);
  }
  // Sorted by count then name — stable, so two exports of the same data match.
  const rows: CellValue[][] = [...byType.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([type, v]) => [type, v.count, round1(v.severity / v.count)]);

  return {
    name: 'Symptom totals',
    columns: [
      { header: 'Symptom', width: 22 },
      { header: 'Times logged', width: 14 },
      { header: 'Average severity', width: 18 },
    ],
    charts: [
      {
        kind: 'bar',
        title: 'What you log most',
        categoryCol: 1,
        valueCols: [2],
        anchor: { col: 5, row: 1 },
      },
    ],
    rows,
  };
}

function predictionsSheet(predictions: readonly ExportPrediction[]): SheetSpec {
  const rows: CellValue[][] = predictions.map((p) => {
    // Error is only knowable once the period actually arrived. Where it hasn't,
    // the cell stays blank — a pending prediction scored as 0 days off would be
    // a flattering lie sitting in the middle of the accuracy chart.
    const error =
      p.actualStart && isCivilDate(p.actualStart) && isCivilDate(p.predictedNextPeriod)
        ? daysBetween(p.predictedNextPeriod, p.actualStart)
        : null;
    return [
      p.predictedNextPeriod,
      p.windowDays,
      Math.round(p.confidence * 100),
      p.actualStart,
      error,
      error === null ? null : Math.abs(error),
    ];
  });
  return {
    name: 'Predictions',
    columns: [
      { header: 'Predicted start', width: 15 },
      { header: '± window (days)', width: 16 },
      { header: 'Confidence %', width: 14 },
      { header: 'Actually started', width: 16 },
      { header: 'Error (days, − = early)', width: 22 },
      { header: 'Error size (days)', width: 17 },
    ],
    charts: [
      {
        kind: 'bar',
        title: 'How far off each prediction was',
        categoryCol: 1,
        valueCols: [6],
        anchor: { col: 8, row: 1 },
      },
    ],
    rows,
  };
}

// ─── ASSEMBLY ────────────────────────────────────────────────────────

/**
 * The workbook, sheet by sheet.
 *
 * A sheet with nothing in it is omitted rather than shipped as a header row
 * over blank space — the "no empty shells" rule applies to a file exactly as it
 * does to a screen. Overview always survives, so the file is never zero sheets.
 */
export function buildExportWorkbook(input: ExportInput): WorkbookSpec {
  const counts = countExport(input);
  const sheets: SheetSpec[] = [overviewSheet(input, counts)];

  if (input.cycles.length > 0) sheets.push(cyclesSheet(input.cycles));
  if (input.periodDays.length > 0) sheets.push(periodDaysSheet(input.periodDays));
  if (input.checkIns.length > 0) {
    sheets.push(checkInsSheet(input.checkIns));
    if (input.checkIns.some((c) => c.moodScore !== null)) {
      sheets.push(moodDistributionSheet(input.checkIns));
    }
  }
  if (input.symptoms.length > 0) {
    sheets.push(symptomsSheet(input.symptoms));
    sheets.push(symptomTotalsSheet(input.symptoms));
  }
  if (input.predictions.length > 0) sheets.push(predictionsSheet(input.predictions));

  return { sheets };
}

/** `dottie-export-2026-09-04.xlsx` — sorts chronologically in a files app. */
export function exportFileName(generatedOn: string): string {
  const safe = isCivilDate(generatedOn) ? generatedOn : 'export';
  return `dottie-export-${safe}.xlsx`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
