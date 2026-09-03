/**
 * Dottie — civil-date
 *
 * Arithmetic on CIVIL dates: "2026-09-01" as a calendar day, with no time and
 * no timezone. Every date the app stores — period days, check-ins, cycle
 * records — is one of these, so this is the only module allowed to do date
 * maths on them.
 *
 * ─── WHY THIS EXISTS (device-test-7, the freeze) ────────────────────
 *
 *  Six files had each grown their own copy of `addDay`/`subtractDay`, and every
 *  copy made the same mistake:
 *
 *      const d = new Date(`${date}T00:00:00`);   // parsed as LOCAL midnight
 *      d.setDate(d.getDate() + 1);
 *      return d.toISOString().split('T')[0];     // serialised as UTC
 *
 *  Local in, UTC out. East of Greenwich local midnight is still the PREVIOUS
 *  day in UTC, so the +1 day is cancelled by the -offset and the function
 *  returns the date it was given:
 *
 *      TZ=UTC              addDay('2026-09-01') -> '2026-09-02'   ✅
 *      TZ=America/New_York addDay('2026-09-01') -> '2026-09-02'   ✅
 *      TZ=Asia/Kolkata     addDay('2026-09-01') -> '2026-09-01'   ❌ identity
 *
 *  `addDay` being the identity turned this loop in `cycle.repo.ts` into an
 *  infinite one, wedging the JS thread forever the first time a period day was
 *  logged AFTER an existing one:
 *
 *      while (true) {
 *        const nextDay = addDay(cursor);      // === cursor
 *        if (priorDates.has(nextDay)) { cursor = nextDay; }   // always true
 *        else break;
 *      }
 *
 *  That is the "log a period on a second date and the app freezes, force-close
 *  required" bug that survived two wrong diagnoses. It never reproduced in CI
 *  or in any harness because both run at UTC+0, where the broken helper is
 *  accidentally correct.
 *
 * ─── HOW THIS MODULE AVOIDS IT ──────────────────────────────────────
 *
 *  It never constructs a local Date. Parsing, arithmetic and formatting all go
 *  through UTC getters/setters, so the result depends only on the input string
 *  — identical in Kolkata, Auckland, UTC and New York. `Date.UTC` also
 *  normalises overflow, so month ends, leap days and year boundaries are the
 *  platform's problem, not ours.
 *
 *  There is deliberately no `new Date()` here: "what is today" is a separate
 *  question (it IS timezone-dependent) and belongs to the caller.
 */

/** A civil date string, `YYYY-MM-DD`. */
export type CivilDate = string;

const DAY_MS = 86_400_000;

/** True when `iso` is a well-formed, real calendar date. */
export function isCivilDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  // Round-trip guards against overflow strings like "2026-02-31".
  return new Date(t).toISOString().slice(0, 10) === iso;
}

/** Civil date → UTC epoch ms at midnight. Throws on a malformed date. */
function toUtcMs(iso: CivilDate): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) throw new RangeError(`civil-date: not a date: "${iso}"`);
  return t;
}

/** UTC epoch ms → civil date. */
function fromUtcMs(ms: number): CivilDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * `iso` shifted by `days` (negative shifts back).
 *
 * Timezone-independent by construction — this is the function whose broken
 * local/UTC copies caused the freeze, so it is the one that must never be
 * reimplemented inline.
 */
export function addDays(iso: CivilDate, days: number): CivilDate {
  if (!Number.isFinite(days)) throw new RangeError(`civil-date: bad shift: ${days}`);
  return fromUtcMs(toUtcMs(iso) + Math.trunc(days) * DAY_MS);
}

/** The day after `iso`. */
export function nextDay(iso: CivilDate): CivilDate {
  return addDays(iso, 1);
}

/** The day before `iso`. */
export function prevDay(iso: CivilDate): CivilDate {
  return addDays(iso, -1);
}

/** Signed whole days from `from` to `to` (positive = `to` is later). */
export function daysBetween(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Absolute whole days between two civil dates. */
export function daysApart(a: CivilDate, b: CivilDate): number {
  return Math.abs(daysBetween(a, b));
}

/**
 * Today as a civil date in the DEVICE's timezone — the one place where the
 * local calendar legitimately matters (what the user calls "today").
 */
export function todayCivil(now: Date = new Date()): CivilDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A JS Date rendered as a civil date in the device's timezone. */
export const toCivilDate = todayCivil;
