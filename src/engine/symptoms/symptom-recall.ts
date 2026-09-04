/**
 * Dottie — Symptom recall (pure)
 *
 * "Last cycle, you logged nausea on day 2." Turns the symptoms already being
 * logged every day into something the calendar can say about the period it is
 * predicting.
 *
 * ─── THE HONESTY RULE THAT SHAPES ALL OF THIS ───────────────────────
 *
 *  The owner asked for lines like "previously PEOPLE felt nauseous on this day".
 *  This module deliberately does NOT say that, and the distinction matters:
 *
 *   • What it CAN say is what THIS user logged, with the sample size attached —
 *     "you logged this in 2 of your last 3 cycles". That is a fact about her own
 *     data, checkable by her, and it gets more useful the longer she uses the
 *     app.
 *
 *   • What it will NOT do is invent a population statistic. Dottie has no
 *     cohort — it is local-first, nothing leaves the phone, there is no "other
 *     users" to aggregate. A line like "68% of people report nausea on day 2"
 *     would be fabricated, and this app already had to remove exactly that kind
 *     of invented number once (the "You & 12,363 others" counters, DT6).
 *
 *  Where a general pattern IS well established — cramps clustering on the first
 *  couple of bleeding days — the copy uses the app's existing non-diagnostic
 *  hedge ("many people find…") and never attaches a fabricated percentage.
 *
 * ─── WHY SAMPLE SIZE IS IN THE OUTPUT, NOT JUST THE COPY ────────────
 *
 *  One occurrence is an anecdote. The caller gets `cycles` and `occurrences`
 *  so the UI can choose to stay quiet on n=1 rather than dressing a coincidence
 *  up as a forecast — which is what "dynamic prediction" has to mean if it is
 *  going to be trusted.
 */

import { addDays, daysBetween, isCivilDate } from '../../utils/civil-date';

// ─── INPUT ───────────────────────────────────────────────────────────

export interface SymptomLog {
  date: string;
  /** Free-form type as stored, e.g. 'nausea', 'headache', 'cramps'. */
  symptomType: string;
  /** 1..5. */
  severity: number;
}

export interface RecallInput {
  /** Every symptom the user has logged (any range; older is fine). */
  symptoms: readonly SymptomLog[];
  /** Start date of each past period, newest first. */
  periodStarts: readonly string[];
  /** How many days into a period to look. Bleeding days only by default. */
  windowDays?: number;
  /** Ignore symptoms logged below this severity — a 1 is noise. */
  minSeverity?: number;
}

// ─── OUTPUT ──────────────────────────────────────────────────────────

export interface RecalledSymptom {
  /** As stored. */
  symptomType: string;
  /** Human label, e.g. "nausea". */
  label: string;
  /** Cycle day it most often showed up on (1 = first day of bleeding). */
  typicalDay: number;
  /** How many past periods it appeared in. */
  occurrences: number;
  /** How many past periods we had data for — the denominator. */
  cycles: number;
  /** Mean severity when it did appear, 1 dp. */
  averageSeverity: number;
  /** True once it has happened in more than one cycle. */
  repeated: boolean;
}

export interface SymptomRecall {
  items: RecalledSymptom[];
  /** Past periods with any symptom data at all. */
  cyclesWithData: number;
  /** Nothing to say — the caller should render nothing, not an empty card. */
  empty: boolean;
  /** One honest sentence for the header, sample size included. */
  summary: string;
}

const DEFAULT_WINDOW = 6;
const DEFAULT_MIN_SEVERITY = 2;

/**
 * What tended to happen, and on which day of the period.
 *
 * Symptoms are bucketed by their offset from the period start they fall in, so
 * "day 2" means the second day of bleeding — not the second of the month, and
 * not a day of the fertility cycle.
 */
export function recallSymptoms(input: RecallInput): SymptomRecall {
  const windowDays = clampInt(input.windowDays ?? DEFAULT_WINDOW, 1, 14);
  const minSeverity = clampInt(input.minSeverity ?? DEFAULT_MIN_SEVERITY, 1, 5);

  const starts = input.periodStarts.filter(isCivilDate).slice().sort().reverse();
  if (starts.length === 0) {
    return { items: [], cyclesWithData: 0, empty: true, summary: '' };
  }

  // symptomType → cycleIndex → { day, severity }
  const seen = new Map<string, Map<number, { day: number; severity: number }>>();
  const cyclesTouched = new Set<number>();

  for (const log of input.symptoms) {
    if (!isCivilDate(log.date)) continue;
    if (!Number.isFinite(log.severity) || log.severity < minSeverity) continue;

    // Which period window does this fall in?
    for (let ci = 0; ci < starts.length; ci++) {
      const start = starts[ci]!;
      const offset = daysBetween(start, log.date);
      if (offset < 0 || offset >= windowDays) continue;

      const day = offset + 1;
      const key = log.symptomType.trim().toLowerCase();
      if (key.length === 0) break;

      let perCycle = seen.get(key);
      if (!perCycle) {
        perCycle = new Map();
        seen.set(key, perCycle);
      }
      // Keep the EARLIEST day it appeared in that cycle — the question is when
      // it starts, not when it was last re-logged.
      const existing = perCycle.get(ci);
      if (!existing || day < existing.day) {
        perCycle.set(ci, { day, severity: log.severity });
      }
      cyclesTouched.add(ci);
      break;
    }
  }

  const cycles = starts.length;
  const items: RecalledSymptom[] = [];

  for (const [key, perCycle] of seen) {
    const entries = [...perCycle.values()];
    if (entries.length === 0) continue;
    items.push({
      symptomType: key,
      label: labelFor(key),
      typicalDay: modeDay(entries.map((e) => e.day)),
      occurrences: entries.length,
      cycles,
      averageSeverity: round1(entries.reduce((s, e) => s + e.severity, 0) / entries.length),
      repeated: entries.length > 1,
    });
  }

  // Most consistent first, then earliest in the period — the ones you'd want
  // warning about soonest.
  items.sort((a, b) => b.occurrences - a.occurrences || a.typicalDay - b.typicalDay);

  const cyclesWithData = cyclesTouched.size;
  return {
    items,
    cyclesWithData,
    empty: items.length === 0,
    summary: summarise(items, cyclesWithData),
  };
}

/**
 * The line to show against a predicted period day.
 *
 * Returns null when there is nothing honest to say — no data, or a single
 * occurrence that would be dressing a coincidence up as a forecast.
 */
export function recallForDay(
  recall: SymptomRecall,
  periodDay: number
): string | null {
  const onThisDay = recall.items.filter((i) => i.typicalDay === periodDay && i.repeated);
  if (onThisDay.length === 0) return null;

  const names = onThisDay.slice(0, 3).map((i) => i.label);
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const top = onThisDay[0]!;

  return `On day ${periodDay} you've logged ${list} in ${top.occurrences} of your last ${top.cycles} periods. It may show up again — worth having what helps within reach.`;
}

function summarise(items: RecalledSymptom[], cyclesWithData: number): string {
  if (items.length === 0) return '';
  if (cyclesWithData < 2) {
    return 'From one period so far — log another and Dottie can start telling you what repeats.';
  }
  const repeated = items.filter((i) => i.repeated).length;
  if (repeated === 0) {
    return `From your last ${cyclesWithData} periods. Nothing has repeated yet — these are one-offs so far.`;
  }
  return `From your last ${cyclesWithData} periods — ${repeated} thing${repeated === 1 ? '' : 's'} that showed up more than once.`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/** Most frequent day; ties resolve to the earliest. */
function modeDay(days: number[]): number {
  const counts = new Map<number, number>();
  for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best = days[0]!;
  let bestN = 0;
  for (const [day, n] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > bestN) {
      best = day;
      bestN = n;
    }
  }
  return best;
}

const LABELS: Record<string, string> = {
  cramps: 'cramps',
  nausea: 'nausea',
  headache: 'a headache',
  bloating: 'bloating',
  fatigue: 'fatigue',
  backache: 'backache',
  acne: 'breakouts',
  tender_breasts: 'tenderness',
  mood_swings: 'mood swings',
  insomnia: 'trouble sleeping',
  sleeplessness: 'trouble sleeping',
  anxiety: 'anxiety',
  low_energy: 'low energy',
  bleeding: 'heavier bleeding',
};

function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ');
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Whether recent symptoms look premenstrual — the signal the predictor already
 * accepts (`premenstrualSymptomsDetected`) but nothing was ever passing it.
 *
 * Kept narrow on purpose: only the symptoms that genuinely cluster before a
 * period, only in the last few days, and only when at least two distinct ones
 * show up. One headache is not a signal.
 */
const PMS_MARKERS = new Set([
  'cramps',
  'bloating',
  'tender_breasts',
  'mood_swings',
  'acne',
  'backache',
  'low_energy',
  'fatigue',
]);

export function detectPremenstrualSignal(
  symptoms: readonly SymptomLog[],
  today: string,
  lookbackDays = 3
): boolean {
  const since = addDays(today, -Math.abs(lookbackDays));
  const distinct = new Set<string>();
  for (const s of symptoms) {
    if (!isCivilDate(s.date)) continue;
    if (s.date < since || s.date > today) continue;
    if (!Number.isFinite(s.severity) || s.severity < 2) continue;
    const key = s.symptomType.trim().toLowerCase();
    if (PMS_MARKERS.has(key)) distinct.add(key);
  }
  return distinct.size >= 2;
}
