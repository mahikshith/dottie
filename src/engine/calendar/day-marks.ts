/**
 * Dottie — what a calendar day IS, decided once
 *
 * ─── WHY THIS FILE EXISTS (device-test-25) ──────────────────────────
 *
 *  The owner asked for the calendar's colours to be readable as text too — a
 *  dated list under the grid ("23–30 Aug is your luteal phase") behind a
 *  toggle, so the visual stays the default and the descriptive version is one
 *  tap away. And then the condition that matters more than the feature:
 *
 *      "But never, ever add contradictory information from the visual
 *       calendar and what we are showing in the information below."
 *
 *  Absolutely right, and it is the reason this module exists rather than the
 *  list simply being written next to the grid. Two renderers reading the same
 *  DATA still drift, because each one re-decides what the data MEANS: the grid
 *  resolves "this day is fertile AND ovulatory AND in the fertile window" by a
 *  precedence chain buried in a styling branch, and any list written
 *  separately would invent its own. One of them changes, and the key starts
 *  lying about the map — which is exactly the failure the DT19 legend rewrite
 *  was already about.
 *
 *  So the precedence lives HERE, once. `dayMark()` is the only thing in the
 *  app allowed to answer "what is this day"; the grid switches on it to pick a
 *  fill, and the dated list groups on it to build ranges. They cannot disagree
 *  because there is nothing left to disagree about — and `test:ranges` asserts
 *  every day the list claims matches the mark the grid drew, cell for cell.
 *
 * ─── THE PRECEDENCE, AND WHY IT IS THIS ORDER ───────────────────────
 *
 *    logged      A fact. Beats everything — a day you were bleeding on is
 *                never drawn as something else, whatever the arithmetic says
 *                (rule 15).
 *    predicted   A future period window. Beats the estimated phases because
 *                it is the more specific claim about the same days.
 *    ovulation   The single most useful estimated day.
 *    fertile     The span it sits inside.
 *    phase       The broad band, when nothing more specific applies.
 *    unknown     Before the first log, or past what we will estimate
 *                (PHASE_DISPLAY_GRACE_DAYS — see phase-calculator).
 */

import type { Phase } from '../../types/cycle.types';
import { getPhaseDescription } from '../prediction/phase-calculator';
import { NOT_CONTRACEPTION } from './fertile-window';

// ─── THE MARKS ───────────────────────────────────────────────────────

export type DayMark =
  | 'logged'
  | 'predicted'
  | 'ovulation'
  | 'fertile'
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown';

/**
 * The minimum shape a day needs to be marked. Structural on purpose — the
 * engine must not import the calendar screen, and the screen's MonthCell
 * satisfies this without being coupled to it.
 */
export interface MarkableDay {
  iso: string;
  inMonth: boolean;
  isPeriodDay: boolean;
  isPredictedPeriod: boolean;
  phase: Phase | null;
  /** Past the expected cycle with nothing new logged — we stop claiming. */
  beyondCycle: boolean;
  fertile: 'fertile' | 'ovulation' | null;
}

/**
 * THE decision. Every renderer of a calendar day goes through here.
 *
 * Days outside the visible month return 'unknown' — they are drawn faint and
 * belong to a neighbouring month's own summary, not this one's.
 */
export function dayMark(day: MarkableDay): DayMark {
  if (!day.inMonth) return 'unknown';
  if (day.isPeriodDay) return 'logged';
  if (day.isPredictedPeriod) return 'predicted';
  if (day.fertile === 'ovulation') return 'ovulation';
  if (day.fertile === 'fertile') return 'fertile';
  if (day.phase) return day.phase;
  return 'unknown';
}

// ─── RANGES ──────────────────────────────────────────────────────────

export interface DayRange {
  mark: DayMark;
  /** First and last ISO date of this run, inclusive. */
  start: string;
  end: string;
  /** How many days the run covers. */
  days: number;
}

/**
 * Group a month's cells into contiguous runs of the same mark.
 *
 * Only days IN the month are grouped, and 'unknown' runs are kept rather than
 * dropped: a gap the list silently skipped would read as "nothing here",
 * when what it means is "we deliberately stopped estimating" (DT24). The
 * screen decides whether to show it; the engine does not hide it.
 */
export function groupDayRanges(days: readonly MarkableDay[]): DayRange[] {
  const out: DayRange[] = [];
  for (const day of days) {
    if (!day.inMonth) continue;
    const mark = dayMark(day);
    const last = out[out.length - 1];
    if (last && last.mark === mark) {
      last.end = day.iso;
      last.days += 1;
      continue;
    }
    out.push({ mark, start: day.iso, end: day.iso, days: 1 });
  }
  return out;
}

// ─── WORDS ───────────────────────────────────────────────────────────

/**
 * The label. These MATCH the legend chips exactly — the toggle swaps one for
 * the other, so a mark that is called one thing in colours and another in
 * words would be the contradiction this whole module exists to prevent.
 */
export const MARK_LABEL: Record<DayMark, string> = {
  logged: 'Period · you logged',
  predicted: 'Predicted period',
  ovulation: 'Ovulation (est.)',
  fertile: 'Fertile (est.)',
  menstrual: 'Menstrual (est.)',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  unknown: 'Not estimated',
};

/**
 * What the phase actually means, for the descriptive view.
 *
 *  Owner: "along with the date, we may want to add the phase information."
 *  Right — a date range and a label tell you WHEN and WHAT, and the reason
 *  anyone opens a cycle app is SO WHAT.
 *
 *  The four phase lines are `getPhaseDescription` verbatim — the app's one
 *  description of each phase, so a phase is never explained two ways in two
 *  places. The fertile line is `NOT_CONTRACEPTION`
 *  verbatim (rule 15): a dated range reads as more authoritative than a
 *  coloured cell, so the caveat matters MORE here, not less.
 *
 *  Every line is non-diagnostic (rule 1). None of them says what a body is
 *  doing; they say what the app is showing and what many people report.
 */
export function markDetail(mark: DayMark): string {
  switch (mark) {
    case 'logged':
      return 'Days you marked yourself. These are the only days here that are recorded rather than estimated.';
    case 'predicted':
      return 'When the next period is expected, from your own logged cycle lengths.';
    case 'ovulation':
    case 'fertile':
      return NOT_CONTRACEPTION;
    case 'menstrual':
      return `Estimated from your cycle length. ${getPhaseDescription('menstrual')}`;
    case 'follicular':
      return getPhaseDescription('follicular');
    case 'ovulatory':
      return getPhaseDescription('ovulatory');
    case 'luteal':
      return getPhaseDescription('luteal');
    case 'unknown':
      return 'More than a week past the cycle we expected, so nothing is estimated here. Log the day your period started and the estimates pick back up.';
  }
}

/**
 * What a screen reader says when it lands on a day.
 *
 * A third renderer of the same day — and it used to carry its OWN copy of the
 * precedence chain, so a blind user could have been told something the grid
 * did not draw. It goes through `dayMark()` like everything else now; only the
 * VOCABULARY differs, because "Period · you logged" is a label to read, not a
 * sentence to hear.
 */
export const MARK_SPOKEN: Record<DayMark, string> = {
  logged: 'period logged',
  predicted: 'predicted period',
  ovulation: 'estimated ovulation day',
  fertile: 'estimated fertile day',
  menstrual: 'estimated menstrual phase',
  follicular: 'follicular phase',
  ovulatory: 'ovulatory phase',
  luteal: 'luteal phase',
  unknown: 'nothing estimated',
};

/** Marks that are recorded fact rather than estimate. Exactly one, today. */
export function isRecorded(mark: DayMark): boolean {
  return mark === 'logged';
}
