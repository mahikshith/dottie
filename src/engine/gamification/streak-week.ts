/**
 * Dottie — the streak week
 *
 * ─── WHY (device-test-27) ───────────────────────────────────────────
 *
 *  Owner, holding up Duolingo's streak screen: "look at how they celebrate the
 *  streak… the streak moving from the previous day to the current day. It is
 *  so cool. That is why people have 10,000-day streaks."
 *
 *  The number alone is not what does that work. The row of seven days under it
 *  is: it shows the run you are ON, the days you already banked, and the empty
 *  circles waiting — all in one glance, without a sentence. A "7" is a score;
 *  a filled row with three empty seats is an invitation.
 *
 *  This builds that row. It is pure, so `test:streakweek` can pin it, and it
 *  goes through `civil-date` for every date step (rule 3 — a local-parse here
 *  would put the whole strip a day out east of Greenwich).
 *
 * ─── WHAT COUNTS AS A DAY ───────────────────────────────────────────
 *
 *  A day is "done" when the app HAS a check-in for it. Not "probably", not
 *  "the streak count implies it" — the caller passes the dates it actually
 *  holds. That matters because the strip is a claim about the user's own
 *  history, and rule 2's spirit is that we never draw one we cannot back.
 */

import { addDays, isCivilDate, type CivilDate } from '../../utils/civil-date';

export interface StreakDay {
  date: CivilDate;
  /** Single letter for the column head — S M T W T F S. */
  label: string;
  /** The app holds a check-in for this day. */
  done: boolean;
  isToday: boolean;
}

export interface StreakWeek {
  days: StreakDay[];
  /** How many consecutive done days end at (or just before) today. */
  runLength: number;
  /** Index range of that run in `days`, or null when there is no run. */
  runStart: number | null;
  runEnd: number | null;
}

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Weekday index for a civil date, read in UTC so it cannot drift by timezone. */
function dayOfWeek(iso: CivilDate): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * The seven days ending today, oldest first.
 *
 * Seven and not "this calendar week" on purpose: a Monday-anchored week shows
 * one filled square on a Monday evening no matter how long the run is, which is
 * the opposite of encouraging. A rolling window always shows the run.
 */
export function buildStreakWeek(
  loggedDates: readonly string[],
  today: CivilDate,
  span = 7
): StreakWeek {
  const have = new Set<string>();
  for (const d of loggedDates) if (isCivilDate(d)) have.add(d);

  const size = Math.max(3, Math.min(14, Math.round(span)));
  const days: StreakDay[] = [];
  for (let i = size - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    days.push({
      date,
      label: LETTER[dayOfWeek(date)] ?? '?',
      done: have.has(date),
      isToday: i === 0,
    });
  }

  // The run that reaches the present. Today not being logged YET does not
  // break it — the run is then measured to yesterday, which is exactly the
  // state the screen wants to show at 9am: "you are on 4, keep it".
  let end = days.length - 1;
  if (!days[end]?.done && days.length >= 2 && days[end - 1]?.done) end -= 1;
  let start = end;
  if (!days[end]?.done) {
    return { days, runLength: 0, runStart: null, runEnd: null };
  }
  while (start - 1 >= 0 && days[start - 1]?.done) start -= 1;

  return { days, runLength: end - start + 1, runStart: start, runEnd: end };
}
