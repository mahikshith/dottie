/**
 * Dottie — Doctor Report Engine (Pure Aggregation)
 *
 * Takes raw cycle records, symptom logs, and check-ins → produces a
 * fully-formed DoctorReportData. No IO. No DB. No side effects.
 *
 * ─── PURITY CONTRACT ────────────────────────────────────────────────
 *
 *  generateDoctorReport(input) is a pure function:
 *    - Same input → same output, always
 *    - No reads from singletons / repos / storage
 *    - No writes anywhere
 *    - Safe to call on the JS thread without await
 *
 *  The store layer is responsible for fetching the inputs from
 *  cycleRepository + checkinRepository and passing them in. This keeps
 *  the engine trivially unit-testable and lets us swap data sources
 *  later (e.g., medication tracker integration in Batch 2) without
 *  rewriting the math.
 *
 * ─── DESIGN NOTES ───────────────────────────────────────────────────
 *
 *  - Regularity classification uses standard deviation of cycle lengths
 *    rather than a simple min/max spread, so a single outlier doesn't
 *    push a generally-regular user into "irregular" land.
 *  - Top symptoms cap at 8 entries — beyond that, the doctor report
 *    starts feeling like a wall of text. The store can expose the full
 *    list later if needed.
 *  - "Most common phase" per symptom is computed from `phase_at_log`
 *    when available; we never re-derive phase from dates here (that's
 *    the prediction engine's job).
 *  - Sparse detection trips when there's < 1 complete cycle AND < 5
 *    symptom logs AND < 3 check-ins. Below that threshold the report
 *    is misleading more than helpful.
 */

import {
  CycleRecord,
  Phase,
} from '../../types/cycle.types';
import {
  DailyCheckIn,
  SymptomLog,
} from '../../database/repositories/checkin.repo';
import {
  DoctorReportData,
  ReportCycleSummary,
  ReportDateRange,
  ReportMedicationSection,
  ReportRecentCyclesSection,
  ReportSymptomEntry,
  ReportSymptomSection,
  ReportTemplate,
  ReportWellbeingSection,
} from '../../types/report.types';

// ─── INPUT SHAPE ─────────────────────────────────────────────────────

/**
 * Everything the engine needs to produce a report. The store assembles
 * this from repos before calling generateDoctorReport().
 */
export interface DoctorReportInput {
  template: ReportTemplate;
  range: ReportDateRange;
  /** Cycle records whose START date falls inside the range. */
  cycleRecords: CycleRecord[];
  /** Symptoms logged inside the range. */
  symptoms: SymptomLog[];
  /** Check-ins logged inside the range. */
  checkIns: DailyCheckIn[];
  /** Current app version (from expo-constants or similar). */
  appVersion: string;
  /** Generation timestamp — injected so tests can pin it. */
  now?: Date;
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────

/**
 * Generate the full Doctor Report.
 *
 * Returns a deterministic snapshot — pass the same inputs, get the
 * same output. Safe to call as often as the user requests.
 */
export function generateDoctorReport(input: DoctorReportInput): DoctorReportData {
  const generatedAt = (input.now ?? new Date()).toISOString();

  const cycleSummary = computeCycleSummary(input.cycleRecords);
  const symptoms = computeSymptomSection(input.symptoms);
  const wellbeing = computeWellbeingSection(input.checkIns, input.range);
  const recentCycles = computeRecentCyclesSection(input.cycleRecords);
  const medications = computeMedicationSection();

  const isSparse =
    cycleSummary.cyclesTracked < 1 &&
    symptoms.totalLogged < 5 &&
    wellbeing.daysWithCheckIn < 3;

  return {
    template: input.template,
    range: input.range,
    generatedAt,
    appVersion: input.appVersion,
    cycleSummary,
    symptoms,
    wellbeing,
    recentCycles,
    medications,
    isSparse,
  };
}

// ─── CYCLE SUMMARY ───────────────────────────────────────────────────

function computeCycleSummary(records: CycleRecord[]): ReportCycleSummary {
  if (records.length === 0) {
    return {
      cyclesTracked: 0,
      averageCycleLength: null,
      cycleLengthRange: null,
      averagePeriodLength: null,
      periodLengthRange: null,
      regularity: 'insufficient_data',
      regularityNote: "Not enough complete cycles yet — keep logging and your patterns will show up here.",
    };
  }

  const cycleLengths = records.map(r => r.cycleLength).filter(n => n > 0);
  const periodLengths = records.map(r => r.periodLength).filter(n => n > 0);

  const avgCycle = cycleLengths.length > 0 ? mean(cycleLengths) : null;
  const avgPeriod = periodLengths.length > 0 ? mean(periodLengths) : null;

  const cycleRange: [number, number] | null = cycleLengths.length > 0
    ? [Math.min(...cycleLengths), Math.max(...cycleLengths)]
    : null;
  const periodRange: [number, number] | null = periodLengths.length > 0
    ? [Math.min(...periodLengths), Math.max(...periodLengths)]
    : null;

  // Regularity = standard deviation of cycle lengths
  const { regularity, regularityNote } = classifyRegularity(cycleLengths);

  return {
    cyclesTracked: records.length,
    averageCycleLength: avgCycle !== null ? round1(avgCycle) : null,
    cycleLengthRange: cycleRange,
    averagePeriodLength: avgPeriod !== null ? round1(avgPeriod) : null,
    periodLengthRange: periodRange,
    regularity,
    regularityNote,
  };
}

function classifyRegularity(
  cycleLengths: number[]
): { regularity: ReportCycleSummary['regularity']; regularityNote: string } {
  if (cycleLengths.length < 2) {
    return {
      regularity: 'insufficient_data',
      regularityNote: 'A few more cycles and we can describe your regularity with confidence.',
    };
  }

  const sd = standardDeviation(cycleLengths);

  if (sd <= 2) {
    return {
      regularity: 'regular',
      regularityNote: 'Your cycles arrive on a steady rhythm — very low variation.',
    };
  }
  if (sd <= 4) {
    return {
      regularity: 'mostly_regular',
      regularityNote: 'Your cycles follow a clear pattern with a little natural variation.',
    };
  }
  return {
    regularity: 'irregular',
    regularityNote: 'Your cycle lengths vary noticeably — completely valid to share this with your clinician.',
  };
}

// ─── SYMPTOM SECTION ─────────────────────────────────────────────────

const MAX_SYMPTOM_ENTRIES = 8;

function computeSymptomSection(symptoms: SymptomLog[]): ReportSymptomSection {
  if (symptoms.length === 0) {
    return { entries: [], totalLogged: 0 };
  }

  // Group by symptom_type
  type Bucket = {
    symptomType: string;
    category: SymptomLog['category'];
    severities: number[];
    phases: (string | null)[];
  };
  const buckets = new Map<string, Bucket>();

  for (const s of symptoms) {
    const key = s.symptomType;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        symptomType: s.symptomType,
        category: s.category,
        severities: [],
        phases: [],
      };
      buckets.set(key, bucket);
    }
    bucket.severities.push(s.severity);
    bucket.phases.push(s.phaseAtLog);
  }

  // Convert buckets → entries, sort by occurrences DESC
  const entries: ReportSymptomEntry[] = Array.from(buckets.values())
    .map(b => ({
      symptomType: b.symptomType,
      category: b.category,
      occurrences: b.severities.length,
      averageSeverity: round1(mean(b.severities)),
      mostCommonPhase: pickMostCommonPhase(b.phases),
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, MAX_SYMPTOM_ENTRIES);

  return {
    entries,
    totalLogged: symptoms.length,
  };
}

function pickMostCommonPhase(phases: (string | null)[]): Phase | null {
  const counts = new Map<string, number>();
  for (const p of phases) {
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [phase, count] of counts) {
    if (count > bestCount) {
      best = phase;
      bestCount = count;
    }
  }

  // Defensive: only return known Phase values
  if (best === 'menstrual' || best === 'follicular' || best === 'ovulatory' || best === 'luteal') {
    return best;
  }
  return null;
}

// ─── WELLBEING SECTION ───────────────────────────────────────────────

function computeWellbeingSection(
  checkIns: DailyCheckIn[],
  range: ReportDateRange
): ReportWellbeingSection {
  const moodValues = checkIns.map(c => c.moodScore).filter(isNumber);
  const energyValues = checkIns.map(c => c.energyLevel).filter(isNumber);
  const sleepValues = checkIns.map(c => c.sleepQuality).filter(isNumber);
  const stressValues = checkIns.map(c => c.stressLevel).filter(isNumber);

  return {
    averageMood: moodValues.length > 0 ? round1(mean(moodValues)) : null,
    averageEnergy: energyValues.length > 0 ? round1(mean(energyValues)) : null,
    averageSleep: sleepValues.length > 0 ? round1(mean(sleepValues)) : null,
    averageStress: stressValues.length > 0 ? round1(mean(stressValues)) : null,
    daysWithCheckIn: checkIns.length,
    totalDaysInRange: daysBetweenInclusive(range.startDate, range.endDate),
  };
}

// ─── RECENT CYCLES SECTION ───────────────────────────────────────────

const MAX_RECENT_CYCLES = 6;

function computeRecentCyclesSection(records: CycleRecord[]): ReportRecentCyclesSection {
  // Records are already newest-first from cycleRepository.getCycleHistory()
  const rows = records.slice(0, MAX_RECENT_CYCLES).map(r => ({
    startDate: r.startDate,
    endDate: r.endDate,
    cycleLength: r.cycleLength,
    periodLength: r.periodLength,
  }));

  return {
    rows,
    hasMore: records.length > MAX_RECENT_CYCLES,
  };
}

// ─── MEDICATION SECTION (stubbed — full tracker lands later) ─────────

function computeMedicationSection(): ReportMedicationSection {
  // Full medication integration will land alongside the medication
  // tracker feature. For now we always render a graceful empty state
  // so the report shape stays consistent.
  return {
    hasMedicationsLogged: false,
    note: 'No medications logged yet. When you add medications, they will appear here automatically.',
  };
}

// ─── MATH HELPERS ────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isNumber(v: number | null | undefined): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}

// ─── DATE HELPERS ────────────────────────────────────────────────────

function daysBetweenInclusive(startISO: string, endISO: string): number {
  const a = new Date(`${startISO}T00:00:00`);
  const b = new Date(`${endISO}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay) + 1;
}

// ─── SHARE-FRIENDLY PLAIN-TEXT FORMATTER ─────────────────────────────

/**
 * Serialize a DoctorReportData into a clinician-friendly plain-text
 * format suitable for the native Share sheet. Lives in the engine so
 * UI never has to know how to "stringify" a report — UI just calls
 * formatDoctorReportText(data) and shares the result.
 *
 * Format intentionally uses simple Unicode separators, no Markdown,
 * so it pastes cleanly into doctor's notes / EHRs / messaging apps.
 */
export function formatDoctorReportText(data: DoctorReportData): string {
  const lines: string[] = [];
  const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  lines.push('Dottie Health Summary');
  lines.push(sep);
  lines.push(`Range: ${data.range.label}`);
  lines.push(`Generated: ${formatDate(data.generatedAt)}`);
  lines.push('');

  // Cycle Summary
  lines.push('CYCLE SUMMARY');
  lines.push(sep);
  const cs = data.cycleSummary;
  lines.push(`Cycles tracked:        ${cs.cyclesTracked}`);
  if (cs.averageCycleLength !== null) {
    const range = cs.cycleLengthRange
      ? ` (range: ${cs.cycleLengthRange[0]}–${cs.cycleLengthRange[1]})`
      : '';
    lines.push(`Average cycle length:  ${cs.averageCycleLength} days${range}`);
  }
  if (cs.averagePeriodLength !== null) {
    const range = cs.periodLengthRange
      ? ` (range: ${cs.periodLengthRange[0]}–${cs.periodLengthRange[1]})`
      : '';
    lines.push(`Average period length: ${cs.averagePeriodLength} days${range}`);
  }
  lines.push(`Regularity:            ${regularityLabel(cs.regularity)}`);
  lines.push(`  ${cs.regularityNote}`);
  lines.push('');

  // Top Symptoms
  lines.push('MOST FREQUENT SYMPTOMS');
  lines.push(sep);
  if (data.symptoms.entries.length === 0) {
    lines.push('No symptoms logged in this range.');
  } else {
    for (const entry of data.symptoms.entries) {
      const phase = entry.mostCommonPhase
        ? ` · usually in ${entry.mostCommonPhase} phase`
        : '';
      lines.push(
        `${entry.symptomType.padEnd(18)} ${entry.occurrences}×  avg severity ${entry.averageSeverity}/10${phase}`
      );
    }
    lines.push(`(${data.symptoms.totalLogged} total symptom logs in range)`);
  }
  lines.push('');

  // Wellbeing
  lines.push('WELLBEING TRENDS');
  lines.push(sep);
  const w = data.wellbeing;
  lines.push(`Avg mood:    ${formatScore(w.averageMood)} / 5`);
  lines.push(`Avg energy:  ${formatScore(w.averageEnergy)} / 5`);
  lines.push(`Avg sleep:   ${formatScore(w.averageSleep)} / 5`);
  lines.push(`Avg stress:  ${formatScore(w.averageStress)} / 5`);
  lines.push(
    `Check-ins:   ${w.daysWithCheckIn} of ${w.totalDaysInRange} days in range`
  );
  lines.push('');

  // Recent Cycles
  lines.push('MOST RECENT CYCLES');
  lines.push(sep);
  if (data.recentCycles.rows.length === 0) {
    lines.push('No complete cycles in this range.');
  } else {
    for (const row of data.recentCycles.rows) {
      lines.push(
        `${formatShortDate(row.startDate)} → ${formatShortDate(row.endDate)}  (${row.cycleLength} days)  Period: ${row.periodLength} days`
      );
    }
    if (data.recentCycles.hasMore) {
      lines.push('… and earlier cycles in app history');
    }
  }
  lines.push('');

  // Medications
  lines.push('MEDICATIONS');
  lines.push(sep);
  lines.push(data.medications.note);
  lines.push('');

  // Footer
  lines.push(sep);
  lines.push(`Generated by Dottie v${data.appVersion}`);
  lines.push('This is a summary of self-reported data.');
  lines.push('It is not a medical diagnosis.');

  return lines.join('\n');
}

function regularityLabel(r: ReportCycleSummary['regularity']): string {
  switch (r) {
    case 'regular':         return 'Regular';
    case 'mostly_regular':  return 'Mostly regular';
    case 'irregular':       return 'Variable';
    case 'insufficient_data': return 'Still learning';
  }
}

function formatScore(n: number | null): string {
  return n === null ? '—' : n.toFixed(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
