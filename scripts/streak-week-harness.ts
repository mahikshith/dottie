/**
 * Dottie — streak week harness (device-test-27)
 *
 *  The strip under the flame is a claim about the user's own history: these
 *  days you logged, these you did not, this run is live. Getting it wrong in
 *  either direction is bad in a different way — a missing tick reads as "the
 *  app lost my day", an invented one as "the app is flattering me".
 *
 *  So the rules are pinned:
 *
 *    W1  the window is the last seven days, oldest first, ending today
 *    W2  a day is done only when the caller actually holds that date
 *    W3  the run reaches the present, and today-not-yet-logged does not
 *        break it (that is the 9am state, and it must still say "you're on 4")
 *    W4  a gap ends the run — the capsule never spans a missed day
 *    W5  every date step goes through civil-date, so the strip is identical
 *        in every timezone (rule 3)
 *
 *  Run: npm run test:streakweek
 */

import './harness/bootstrap';
import { buildStreakWeek } from '../src/engine/gamification/streak-week';
import { addDays } from '../src/utils/civil-date';

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

const TODAY = '2026-09-06';
const back = (n: number): string => addDays(TODAY, -n);

console.log('\x1b[1m\nDottie — the streak week\x1b[0m');

// ─── W1 · the window ─────────────────────────────────────────────────

section('W1 · seven days, oldest first, ending today');
const empty = buildStreakWeek([], TODAY);
ok('seven columns', empty.days.length === 7, String(empty.days.length));
ok('the last one is today', empty.days[6]?.date === TODAY && empty.days[6]?.isToday === true);
ok('the first is six days back', empty.days[0]?.date === back(6));
ok(
  'they are consecutive and forward-moving',
  empty.days.every((d, i) => i === 0 || addDays(empty.days[i - 1]!.date, 1) === d.date)
);
ok('exactly one day is today', empty.days.filter((d) => d.isToday).length === 1);
ok('every column has a weekday letter', empty.days.every((d) => /^[SMTWF]$/.test(d.label)));

// ─── W2 · only what we hold ──────────────────────────────────────────

section('W2 · a tick means a check-in the app actually has');
ok('nothing logged, nothing ticked', empty.days.every((d) => !d.done));
ok('and no run', empty.runLength === 0 && empty.runStart === null && empty.runEnd === null);

const partial = buildStreakWeek([back(4), back(2)], TODAY);
ok(
  'only the two held days are ticked',
  partial.days.filter((d) => d.done).length === 2
);
ok(
  'and they are the right two',
  partial.days.find((d) => d.date === back(4))?.done === true &&
    partial.days.find((d) => d.date === back(2))?.done === true
);
ok(
  'a date outside the window is ignored, not drawn',
  buildStreakWeek([back(40)], TODAY).days.every((d) => !d.done)
);
ok(
  'malformed dates are dropped rather than throwing',
  buildStreakWeek(['not-a-date', '2026-13-45', back(1)], TODAY).days.filter((d) => d.done)
    .length === 1
);

// ─── W3 · the live run ───────────────────────────────────────────────

section('W3 · the run reaches the present');
const live = buildStreakWeek([back(3), back(2), back(1), TODAY], TODAY);
ok('four in a row counts four', live.runLength === 4, String(live.runLength));
ok('the run ends on today', live.runEnd === 6, String(live.runEnd));
ok('and starts three days back', live.runStart === 3, String(live.runStart));

// THE 9AM CASE: yesterday and before are logged, today is not yet.
const morning = buildStreakWeek([back(4), back(3), back(2), back(1)], TODAY);
ok(
  'today not logged yet does NOT break the run',
  morning.runLength === 4,
  String(morning.runLength)
);
ok('the run ends at yesterday', morning.runEnd === 5, String(morning.runEnd));
ok('today is drawn as an open day', morning.days[6]?.done === false);

// ─── W4 · a gap ends it ──────────────────────────────────────────────

section('W4 · the capsule never spans a missed day');
const gapped = buildStreakWeek([back(6), back(5), back(3), back(2), back(1), TODAY], TODAY);
ok('the run is the four since the gap', gapped.runLength === 4, String(gapped.runLength));
ok('and it starts after the gap', gapped.runStart === 3, String(gapped.runStart));
ok(
  'the days before the gap are still ticked — they happened',
  gapped.days[0]?.done === true && gapped.days[1]?.done === true
);
const stale = buildStreakWeek([back(6), back(5)], TODAY);
ok('an old run that does not reach the present is not live', stale.runLength === 0);
ok('but its days still show', stale.days.filter((d) => d.done).length === 2);

// ─── W5 · timezone-proof ─────────────────────────────────────────────

section('W5 · the same strip in every timezone (rule 3)');
const zones = ['UTC', 'Pacific/Kiritimati', 'Pacific/Niue', 'Asia/Kolkata', 'America/Los_Angeles'];
const reference = JSON.stringify(buildStreakWeek([back(2), back(1), TODAY], TODAY));
for (const tz of zones) {
  process.env.TZ = tz;
  ok(`identical under ${tz}`, JSON.stringify(buildStreakWeek([back(2), back(1), TODAY], TODAY)) === reference);
}
process.env.TZ = 'UTC';

// ─── W6 · a full week ────────────────────────────────────────────────

section('W6 · a perfect week');
const perfect = buildStreakWeek([0, 1, 2, 3, 4, 5, 6].map(back), TODAY);
ok('all seven ticked', perfect.days.every((d) => d.done));
ok('the run is the whole strip', perfect.runLength === 7 && perfect.runStart === 0 && perfect.runEnd === 6);

console.log(
  failures === 0
    ? `\n\x1b[32m✓ ${checks} checks — the strip only ever draws days we hold.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
