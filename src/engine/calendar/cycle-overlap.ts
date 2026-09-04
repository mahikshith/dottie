/**
 * Dottie — cycle-overlap (pure)
 *
 * "Is my period going to land on the same days as hers?"
 *
 * The owner asked for this directly (device-test-8): "if there are any periods
 * coinciding with them and their sisterhood, we should also show them." It is
 * the one genuinely new thing a shared calendar can tell you that two separate
 * calendars cannot — and it's what people actually want to know when they track
 * for a daughter, a sister or a friend (who needs supplies when, who is going
 * to be having a rough week at the same time you are).
 *
 * ─── WHAT IT WILL NOT DO ────────────────────────────────────────────
 *
 *  It does NOT claim cycles "sync". Menstrual synchrony is a popular belief
 *  that has repeatedly failed to replicate, and asserting it would be exactly
 *  the kind of confident-sounding folk claim this app refuses to make. Two
 *  windows overlapping is a scheduling fact about two predictions, and that is
 *  all this reports — the copy says "land on the same days", never "in sync",
 *  and never offers a cause.
 *
 *  It also respects uncertainty: each side is a WINDOW (± the prediction's own
 *  error bar), not a date, so an "overlap" means the windows intersect, and the
 *  copy is hedged accordingly.
 */

import { addDays, daysBetween } from '../../utils/civil-date';

// ─── TYPES ───────────────────────────────────────────────────────────

export interface OverlapPerson {
  memberId: string;
  displayName: string;
  emoji: string;
  /** ISO predicted first day, or null when there isn't a prediction yet. */
  predictedNextPeriod: string | null;
  /** Expected bleeding days. Defaults to 5 when unknown. */
  periodLengthDays?: number | null;
}

export interface OverlapFinding {
  memberId: string;
  displayName: string;
  emoji: string;
  /** First ISO day both windows cover. */
  overlapStart: string;
  /** Last ISO day both windows cover. */
  overlapEnd: string;
  /** How many days the two windows share (≥1). */
  overlapDays: number;
  /** Days from today to the start of the shared stretch (can be negative). */
  daysAway: number;
  /** One hedged, non-diagnostic sentence. */
  summary: string;
}

export interface OverlapInput {
  /** The user's own predicted first day. */
  userPredictedStart: string | null;
  userPeriodLengthDays?: number | null;
  /** ± days on the user's prediction. Widens their window on both sides. */
  userWindowDays?: number;
  sisters: OverlapPerson[];
  /** Today, for the "days away" figure. */
  today: string;
  /** ± days assumed on a sister's prediction (we don't model hers). */
  sisterWindowDays?: number;
}

const DEFAULT_PERIOD_LEN = 5;

// ─── MAIN ────────────────────────────────────────────────────────────

/**
 * Which sisters' predicted periods overlap the user's, soonest first.
 *
 * Returns an empty list when there is nothing to say — no prediction on either
 * side, or no intersection. Callers should render nothing rather than an
 * "everything is fine" message; absence of an overlap is not news.
 */
export function findCycleOverlaps(input: OverlapInput): OverlapFinding[] {
  const {
    userPredictedStart,
    userPeriodLengthDays,
    userWindowDays = 2,
    sisters,
    today,
    sisterWindowDays = 3,
  } = input;

  if (!userPredictedStart) return [];

  const userLen = clampLen(userPeriodLengthDays);
  const userStart = addDays(userPredictedStart, -Math.abs(userWindowDays));
  const userEnd = addDays(userPredictedStart, userLen - 1 + Math.abs(userWindowDays));

  const findings: OverlapFinding[] = [];

  for (const s of sisters) {
    if (!s.predictedNextPeriod) continue;
    const len = clampLen(s.periodLengthDays);
    const sStart = addDays(s.predictedNextPeriod, -Math.abs(sisterWindowDays));
    const sEnd = addDays(s.predictedNextPeriod, len - 1 + Math.abs(sisterWindowDays));

    // Intersection of two inclusive civil-date ranges.
    const start = userStart > sStart ? userStart : sStart;
    const end = userEnd < sEnd ? userEnd : sEnd;
    if (start > end) continue;

    const overlapDays = daysBetween(start, end) + 1;
    const daysAway = daysBetween(today, start);

    findings.push({
      memberId: s.memberId,
      displayName: s.displayName,
      emoji: s.emoji,
      overlapStart: start,
      overlapEnd: end,
      overlapDays,
      daysAway,
      summary: summarise(s.displayName, overlapDays, daysAway),
    });
  }

  return findings.sort((a, b) => a.daysAway - b.daysAway);
}

// ─── COPY ────────────────────────────────────────────────────────────

function summarise(name: string, overlapDays: number, daysAway: number): string {
  const when =
    daysAway < 0
      ? 'right now'
      : daysAway === 0
        ? 'from today'
        : daysAway === 1
          ? 'from tomorrow'
          : `in about ${daysAway} days`;

  const span = overlapDays === 1 ? 'a day' : `around ${overlapDays} days`;

  // Hedged on purpose: these are two predictions meeting, not a fact about
  // either body, and definitely not a claim that cycles synchronise.
  return `Your predicted days and ${name}'s look like they could land together ${when} — ${span} of overlap. Worth knowing if you're planning anything for both of you.`;
}

function clampLen(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return DEFAULT_PERIOD_LEN;
  return Math.min(8, Math.max(2, Math.round(n)));
}
