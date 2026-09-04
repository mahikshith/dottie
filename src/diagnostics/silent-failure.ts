/**
 * Dottie — logSilentFailure
 *
 * For the `catch` blocks that must not break the flow they sit in, but must not
 * disappear either.
 *
 * ─── THE PROBLEM THIS REPLACES ──────────────────────────────────────
 *
 *  Several of these blocks read:
 *
 *      catch (err) { if (__DEV__) console.warn('...', err); }
 *
 *  `__DEV__` is FALSE in the release build the owner actually tests on. So on
 *  the only build that matters, the failure produced no console line, no log
 *  entry, and no user-visible sign. The worst case is real: if the onboarding
 *  seed of "when did your last period start" ever failed, the user would
 *  complete onboarding having typed their date and land on an app that says it
 *  has no cycle data, with nothing anywhere to say why.
 *
 *  Routing these to the diagnostic logger means they land in the trail the
 *  owner shares from Profile → Diagnostics, which is exactly where we go
 *  looking when something is inexplicably empty.
 *
 * ─── WHY IT STILL SWALLOWS ──────────────────────────────────────────
 *
 *  These call sites are deliberately non-fatal: a failed reminder sync must not
 *  block onboarding, a failed prediction-error write must not block logging a
 *  period. The decision to continue is right; the silence was not.
 */

import { log } from './logger';

/**
 * Record a swallowed error. `code` is a stable, greppable identifier — not a
 * sentence — so a report can be matched to a call site without leaking
 * whatever the user was doing at the time.
 */
export function logSilentFailure(code: string, err: unknown): void {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown';
  log.error(code, { message: message.slice(0, 160) });
  if (__DEV__) console.warn(`[silent] ${code}:`, err);
}
