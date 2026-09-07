/**
 * Dottie — the weight-change term, finally given a source
 *
 * ─── WHY (device-test-29) ───────────────────────────────────────────
 *
 *  `PredictionInput.recentWeightChangeKg` has been a live parameter since the
 *  predictor was written: a swing over 5 kg inflates the window by a day and
 *  cuts confidence by 0.06. `docs/PREDICTION-ENGINE.md` §9 lists it as a dead
 *  parameter — "live parameter, no producer" — because the profile only ever
 *  held ONE weight, and a change needs two readings.
 *
 *  This is the producer.
 *
 * ─── THE RULES ──────────────────────────────────────────────────────
 *
 *  · A change is only meaningful over TIME. Two readings a day apart is a
 *    heavy lunch, not a trend, so readings closer together than
 *    `MIN_SPAN_DAYS` are ignored.
 *  · Only the last `WINDOW_DAYS` matter — the predictor's contract says
 *    "last 3 months", and a two-year-old reading says nothing about this
 *    cycle.
 *  · With fewer than two usable readings the answer is `undefined`, NOT zero.
 *    Zero would be a claim that the weight is steady; undefined is the truth,
 *    which is that we do not know. The predictor skips the term entirely.
 */

import { daysBetween, isCivilDate, type CivilDate } from '../../utils/civil-date';

/** The predictor's own contract: "weight change in the last 3 months". */
export const WINDOW_DAYS = 92;
/** Below this, a difference is noise rather than a trend. */
export const MIN_SPAN_DAYS = 14;

export interface WeightReading {
  date: string;
  kg: number;
}

/**
 * Kilograms gained (positive) or lost (negative) across the usable readings,
 * or `undefined` when there is not enough to say.
 */
export function recentWeightChangeKg(
  readings: readonly WeightReading[],
  today: CivilDate
): number | undefined {
  const usable = readings
    .filter((r) => isCivilDate(r.date) && Number.isFinite(r.kg) && r.kg > 0)
    .filter((r) => {
      const age = daysBetween(r.date, today);
      return age >= 0 && age <= WINDOW_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (usable.length < 2) return undefined;

  const first = usable[0]!;
  const last = usable[usable.length - 1]!;
  if (daysBetween(first.date, last.date) < MIN_SPAN_DAYS) return undefined;

  return Math.round((last.kg - first.kg) * 10) / 10;
}
