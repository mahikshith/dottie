/**
 * Dottie — Period Blocks (device-test-6)
 *
 * Turns a loose set of logged period DAYS into the thing a person actually
 * thinks in: period BLOCKS with a start, an end and a length.
 *
 * ─── WHY ────────────────────────────────────────────────────────────
 *
 *  Everything upstream treated a period as a scatter of independent day flags,
 *  so the app could neither say "your last period ran 5 days" nor notice that a
 *  slipped tap had recorded eleven days of bleeding or three separate starts in
 *  one month. Competitor research (Flo / Clue / Bearable) all model a period as
 *  a RANGE anchored on its start, with cycles derived from consecutive starts —
 *  this is that model.
 *
 * ─── TONE (non-negotiable) ──────────────────────────────────────────
 *
 *  The warnings here are DATA-ENTRY sanity checks, never medical opinions.
 *  They say "worth double-checking the dates", never "this is abnormal". Dottie
 *  does not diagnose. Clinical reference points (a period is typically 3-7 days,
 *  2-8 can still be normal; adult cycles usually run 21-35 days) are used only
 *  to decide when a LOG looks like a mistake.
 */

import { isCivilDate } from '../../utils/civil-date';

const DAY_MS = 86400000;

export interface PeriodBlock {
  /** First logged day of the run (ISO). */
  start: string;
  /** Last logged day of the run (ISO). */
  end: string;
  /** Inclusive day count — a single-day period is 1, not 0. */
  lengthDays: number;
}

export type PeriodWarningCode = 'long-block' | 'starts-too-close' | 'too-many-starts';

export interface PeriodWarning {
  code: PeriodWarningCode;
  /** Gentle, non-diagnostic copy for the UI. */
  message: string;
}

export interface PeriodPattern {
  blocks: PeriodBlock[];
  warnings: PeriodWarning[];
}

/** A logged run longer than this looks like a stuck/slipped tap, not a period. */
const IMPLAUSIBLE_BLOCK_DAYS = 10;
/** Two period STARTS closer than this are almost certainly one period. */
const MIN_PLAUSIBLE_GAP_DAYS = 15;
/** More starts than this inside `WINDOW_DAYS` can't all be real periods. */
const MAX_STARTS_IN_WINDOW = 2;
const WINDOW_DAYS = 35;

/**
 * Group loose period days into consecutive blocks.
 * Input may be unsorted and may contain duplicates; output is sorted ascending.
 */
/**
 * Dates that are not well-formed civil dates are DROPPED, not thrown on.
 *
 * These functions read whatever is in the database, and a single malformed row
 * used to make every one of them throw — one bad write and the calendar was
 * dead for that user until the data was deleted (device-test-9). The repository
 * now refuses to store junk, but a phone that already has some must still be
 * able to open its calendar, so the read side heals rather than crashes.
 */
function usableDates(days: readonly string[]): string[] {
  return days.filter((d) => isCivilDate(d));
}

export function groupPeriodBlocks(days: readonly string[]): PeriodBlock[] {
  const sorted = Array.from(new Set(usableDates(days))).sort();
  const blocks: PeriodBlock[] = [];

  for (const day of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && diffDays(day, last.end) === 1) {
      last.end = day;
      last.lengthDays += 1;
    } else {
      blocks.push({ start: day, end: day, lengthDays: 1 });
    }
  }
  return blocks;
}

/**
 * Group into blocks AND flag logs that look like data-entry slips.
 * Pure: pass the days in, get the same answer every time.
 */
export function analysePeriodPattern(days: readonly string[]): PeriodPattern {
  const blocks = groupPeriodBlocks(days);
  const warnings: PeriodWarning[] = [];

  // 1. A single run that's implausibly long.
  const longest = blocks.reduce<PeriodBlock | null>(
    (acc, b) => (acc === null || b.lengthDays > acc.lengthDays ? b : acc),
    null
  );
  if (longest && longest.lengthDays > IMPLAUSIBLE_BLOCK_DAYS) {
    warnings.push({
      code: 'long-block',
      message:
        `That's ${longest.lengthDays} days logged in a row from ${longest.start}. ` +
        `Periods usually run about 3-7 days, so it's worth double-checking those dates — ` +
        `you can tap any day again to undo it.`,
    });
  }

  // 2. Two starts closer together than a period realistically repeats.
  for (let i = 1; i < blocks.length; i++) {
    const gap = diffDays(blocks[i]!.start, blocks[i - 1]!.start);
    if (gap < MIN_PLAUSIBLE_GAP_DAYS) {
      warnings.push({
        code: 'starts-too-close',
        message:
          `Two period starts logged only ${gap} ${gap === 1 ? 'day' : 'days'} apart ` +
          `(${blocks[i - 1]!.start} and ${blocks[i]!.start}). If that's right, leave it — ` +
          `if a tap slipped, tapping the day again removes it.`,
      });
      break; // one nudge is enough; don't nag per pair
    }
  }

  // 3. More starts inside a cycle-length window than could be real.
  for (let i = 0; i < blocks.length; i++) {
    const windowEnd = addDays(blocks[i]!.start, WINDOW_DAYS);
    const startsInWindow = blocks.filter(
      (b) => b.start >= blocks[i]!.start && b.start <= windowEnd
    ).length;
    if (startsInWindow > MAX_STARTS_IN_WINDOW) {
      warnings.push({
        code: 'too-many-starts',
        message:
          `${startsInWindow} separate period starts logged within ${WINDOW_DAYS} days. ` +
          `Adult cycles usually run 21-35 days, so some of these may be taps you didn't mean — ` +
          `worth a quick look.`,
      });
      break;
    }
  }

  return { blocks, warnings };
}

// ─── DATE HELPERS (string in, string out) ────────────────────────────

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function diffDays(iso: string, from: string): number {
  return Math.round((toDate(iso).getTime() - toDate(from).getTime()) / DAY_MS);
}

function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
