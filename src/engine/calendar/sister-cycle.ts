/**
 * Dottie — a sister's cycle history, built from the days you marked for her
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, device-test-16: "when the user shifts to their sisterhood after
 *  adding a sister, we should show the graphs, the information and all the
 *  other important related stuff OF THE SISTER rather than themselves."
 *
 *  Until now the Cycle tab did half the job: selecting a sister switched the
 *  GRID to her days, but every panel underneath — the window, the spread, the
 *  three graphs — stayed the user's, and the screen said so in small print.
 *  Reading someone else's calendar above your own statistics is the kind of
 *  inconsistency that makes people distrust both numbers.
 *
 *  A shadow sister has no cycle_records table of her own: all that exists is
 *  the set of period DAYS you have ticked for her. This turns those days into
 *  the same `CycleRecord[]` the predictor and the explainer already consume, so
 *  she gets the real model rather than a simplified one.
 *
 * ─── WHAT IT REFUSES TO INVENT ──────────────────────────────────────
 *
 *  A cycle is only counted when there are TWO consecutive period blocks to
 *  measure between — one block tells you when she bled, not how long her cycle
 *  is. Implausible gaps are dropped rather than averaged in, because the most
 *  likely cause of a 200-day "cycle" is that nobody logged for four months,
 *  and letting that into the history would widen her window for a year.
 *
 *  With fewer than two blocks this returns an empty history, and the caller
 *  shows the honest "not enough yet" state. That is the correct answer, not a
 *  failure.
 */

import type { CycleRecord } from '../../types/cycle.types';
import { groupPeriodBlocks } from './period-blocks';
import { daysBetween, isCivilDate } from '../../utils/civil-date';

/** Same bounds the Bayesian model uses — outside this is a logging gap. */
const MIN_PLAUSIBLE_CYCLE = 15;
const MAX_PLAUSIBLE_CYCLE = 90;

export interface SisterCycleHistory {
  /** Oldest first, like the repositories return. */
  records: CycleRecord[];
  /** First day of the most recent bleed — the predictor's anchor. */
  lastPeriodStart: string | null;
  /** How many period BLOCKS were logged, including the one still open. */
  blocksLogged: number;
  /** Gaps discarded as logging holes rather than real cycles. */
  discardedGaps: number;
}

/**
 * Build a cycle history from a flat list of logged period days.
 *
 * Pure and deterministic: same days in, same history out, no clock.
 */
export function buildSisterCycleHistory(periodDays: readonly string[]): SisterCycleHistory {
  const clean = periodDays.filter(isCivilDate);
  const blocks = groupPeriodBlocks(clean);

  if (blocks.length === 0) {
    return { records: [], lastPeriodStart: null, blocksLogged: 0, discardedGaps: 0 };
  }

  const records: CycleRecord[] = [];
  let discardedGaps = 0;

  // A cycle runs from one block's start to the NEXT block's start. The final
  // block has no successor, so it anchors the prediction instead of becoming a
  // record — its cycle hasn't finished yet.
  for (let i = 0; i < blocks.length - 1; i++) {
    const start = blocks[i]!;
    const next = blocks[i + 1]!;
    const cycleLength = daysBetween(start.start, next.start);
    if (cycleLength < MIN_PLAUSIBLE_CYCLE || cycleLength > MAX_PLAUSIBLE_CYCLE) {
      discardedGaps++;
      continue;
    }
    records.push({
      startDate: start.start,
      endDate: start.end,
      cycleLength,
      periodLength: start.lengthDays,
      // Flow isn't logged per-day for a shadow member, so this stays at the
      // neutral middle rather than pretending to a measurement.
      averageFlow: 3,
    });
  }

  return {
    records,
    lastPeriodStart: blocks[blocks.length - 1]!.start,
    blocksLogged: blocks.length,
    discardedGaps,
  };
}

/**
 * One honest line about how much her model is standing on, for the UI to show
 * beside her graphs. Never a claim about her body — only about the data.
 */
export function sisterHistorySummary(
  history: SisterCycleHistory,
  displayName: string
): string {
  if (history.blocksLogged === 0) {
    return `Mark a few of ${displayName}'s period days on this calendar and her own model appears here.`;
  }
  if (history.records.length === 0) {
    return `One period logged for ${displayName} so far. A second one gives her a cycle length to work from.`;
  }
  const n = history.records.length;
  const gap =
    history.discardedGaps > 0
      ? ` ${history.discardedGaps} long gap${history.discardedGaps === 1 ? ' was' : 's were'} left out as missed logging.`
      : '';
  return `Built from ${n} completed cycle${n === 1 ? '' : 's'} you've marked for ${displayName}.${gap}`;
}
