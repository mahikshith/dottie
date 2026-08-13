/**
 * Dottie — Date Utilities
 *
 * Tiny, dependency-free date helpers shared across the app.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  `tsconfig.json` has `noUncheckedIndexedAccess: true`, so the very
 *  common idiom `new Date().toISOString().split('T')[0]` is typed as
 *  `string | undefined`. Sprinkling non-null assertions (`[0]!`) all
 *  over the codebase silences the compiler but leaves a latent runtime
 *  landmine: the day ANY one of those assertions is wrong, the app
 *  throws `Cannot read properties of undefined` deep inside a screen.
 *
 *  Centralizing the "today as YYYY-MM-DD" derivation here means:
 *    - Exactly one place makes the (safe) assumption about ISO shape
 *    - Every caller gets a guaranteed `string`, never `undefined`
 *    - Future changes (e.g. respecting device timezone explicitly)
 *      happen in one file, not scattered across stores + screens
 *
 * ─── TIMEZONE: DELIBERATELY UTC ─────────────────────────────────────
 *
 *  This intentionally preserves the EXISTING app-wide convention:
 *  `new Date().toISOString().split('T')[0]` (UTC calendar day). Every
 *  store, repository, and screen already derives "today" this way, so
 *  this helper must be a behavior-identical drop-in — switching to a
 *  local-time day here would make hydration's rollover date disagree
 *  with the gamification/check-in dates on timezone-boundary hours.
 *
 *  Migrating the whole app to a local-day convention is a valid future
 *  change, but it must be done everywhere at once — not silently here.
 *  See `toISODate()` if a specific call site needs an explicit Date.
 */

/**
 * Today's date as a `YYYY-MM-DD` string (UTC calendar day).
 * Always returns a valid string — never `undefined`.
 */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * Format any Date as its `YYYY-MM-DD` (UTC) calendar-day string.
 * A non-empty ISO string always yields a date part, so the fallback
 * is unreachable in practice — it exists only to satisfy
 * `noUncheckedIndexedAccess` without a non-null assertion.
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '1970-01-01';
}
