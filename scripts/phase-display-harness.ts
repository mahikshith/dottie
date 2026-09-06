/**
 * Dottie — phase display harness (device-test-24)
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, with a screenshot of an entire month in solid purple: "it is showing
 *  luteal phase for the entire month… we should give complete control to the
 *  user. If the predictions are off, nobody is going to use our app."
 *
 *  `calculateCurrentPhase` counts forward from the last period start and its
 *  final branch is an `else`. So every day past the ovulatory window is
 *  luteal — on day 40, day 90, day 400. For the PREDICTOR that is correct: a
 *  late period is late, and restarting the count at day 1 would invent a
 *  period that never happened. For a CALENDAR it is a claim about sixty days
 *  nobody can place.
 *
 *  Two rules are pinned here:
 *
 *    1. The calculation still extends (the predictor depends on it) and
 *       reports HOW FAR past expected it has gone.
 *    2. Anything DISPLAYING a phase stops at PHASE_DISPLAY_GRACE_DAYS, so a
 *       stale anchor leaves days uncoloured instead of confidently wrong.
 *
 *  Run: npm run test:phase
 */

import './harness/bootstrap';
import {
  calculateCurrentPhase,
  PHASE_DISPLAY_GRACE_DAYS,
} from '../src/engine/prediction/phase-calculator';

let failures = 0;
let checks = 0;
function ok(label: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}
function section(name: string): void {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

const CYCLE = 28;
const PERIOD = 5;
const anchor = new Date('2026-08-01T00:00:00');
const dayN = (n: number): Date => new Date(2026, 7, 1 + (n - 1));

console.log('\x1b[1m\nDottie — phase display bounds\x1b[0m');

// ─── P1 · inside the cycle, every phase still appears ─────────────────

section('P1 · a normal cycle still produces all four phases');

const seen = new Set<string>();
for (let d = 1; d <= CYCLE; d++) {
  const r = calculateCurrentPhase(anchor, dayN(d), CYCLE, PERIOD);
  seen.add(r.phase);
  ok(`day ${d} is inside the cycle`, r.daysPastExpected === 0, `${r.daysPastExpected}`);
}
for (const phase of ['menstrual', 'follicular', 'ovulatory', 'luteal']) {
  ok(`the ${phase} phase occurs`, seen.has(phase));
}

// ─── P2 · past the cycle, the count keeps going (for the predictor) ───

section('P2 · the calculation still extends past the expected cycle');

const late = calculateCurrentPhase(anchor, dayN(CYCLE + 3), CYCLE, PERIOD);
ok('a period three days late is still counted', late.dayInCycle === CYCLE + 3);
ok('and reports how far past it is', late.daysPastExpected === 3, `${late.daysPastExpected}`);
ok('it does NOT wrap to day 1 — that would invent a period', late.dayInCycle > CYCLE);

const veryLate = calculateCurrentPhase(anchor, dayN(120), CYCLE, PERIOD);
ok('day 120 keeps counting', veryLate.dayInCycle === 120);
ok('and is reported as 92 days past', veryLate.daysPastExpected === 120 - CYCLE);

// ─── P3 · but a DISPLAY stops asserting ──────────────────────────────

section('P3 · the display bound is where the colouring stops');

/** The exact test the calendar grid applies. */
const wouldColour = (dayInCycle: number): boolean =>
  calculateCurrentPhase(anchor, dayN(dayInCycle), CYCLE, PERIOD).daysPastExpected <=
  PHASE_DISPLAY_GRACE_DAYS;

ok('a day inside the cycle is coloured', wouldColour(20));
ok('a few days late is still coloured — being late is ordinary', wouldColour(CYCLE + 2));
ok(
  `exactly ${PHASE_DISPLAY_GRACE_DAYS} days past is the last coloured day`,
  wouldColour(CYCLE + PHASE_DISPLAY_GRACE_DAYS)
);
ok(
  'one day beyond the grace is NOT coloured',
  !wouldColour(CYCLE + PHASE_DISPLAY_GRACE_DAYS + 1)
);
ok('and neither is anything far out', !wouldColour(90) && !wouldColour(400));

// THE REGRESSION: a month of days, all far past a stale anchor, must not all
// come back luteal. This is the screenshot.
const staleMonth: string[] = [];
for (let d = 60; d < 91; d++) {
  const r = calculateCurrentPhase(anchor, dayN(d), CYCLE, PERIOD);
  if (r.daysPastExpected <= PHASE_DISPLAY_GRACE_DAYS) staleMonth.push(r.phase);
}
ok(
  'a month 60+ days past the anchor colours NOTHING',
  staleMonth.length === 0,
  `${staleMonth.length} days would still be painted ${staleMonth[0] ?? ''}`
);

// ─── P4 · the grace is a real window, not a rounding accident ─────────

section('P4 · the grace period is deliberate and bounded');

ok('the grace is at least a few days', PHASE_DISPLAY_GRACE_DAYS >= 3);
ok(
  'and never so long it covers a whole extra cycle',
  PHASE_DISPLAY_GRACE_DAYS < CYCLE / 2,
  `${PHASE_DISPLAY_GRACE_DAYS}`
);

// ─── P5 · a short cycle is bounded proportionally, not absolutely ─────

section('P5 · the bound follows the user’s own cycle length');

const short = calculateCurrentPhase(anchor, dayN(24), 21, 4);
ok('day 24 of a 21-day cycle is 3 past expected', short.daysPastExpected === 3);
const long = calculateCurrentPhase(anchor, dayN(24), 35, 6);
ok('day 24 of a 35-day cycle is not past at all', long.daysPastExpected === 0);

console.log(
  failures === 0
    ? `\n\x1b[32m✓ ${checks} checks — the model keeps counting, the calendar stops claiming.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
