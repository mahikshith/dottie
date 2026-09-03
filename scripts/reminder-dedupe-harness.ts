/**
 * Dottie — Reminder De-duplication Harness
 *
 * Invariants for src/engine/reminders/dedupe.ts (device-test-6: "duplicate
 * reminders are allowed — we need a dedupe checker/nudge").
 *
 * The rules under test: humans don't distinguish "Vitamin D" from "vitamin d ",
 * a preset bucket and an explicit hour can describe the SAME moment, and the
 * nudge must be gentle and point at the reminder they already have.
 *
 * Run: npm run test:dedupe
 */

import {
  isSameReminder,
  findDuplicateReminder,
  duplicateReminderMessage,
  formatFiringTime,
  firingMinutes,
  normaliseName,
  type ReminderLike,
} from '../src/engine/reminders/dedupe';

let failures = 0;
let current = '';

function scenario(name: string, fn: () => void): void {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✗ threw: ${(err as Error).message}\x1b[0m`);
  }
}

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${current}")`);
}

const r = (over: Partial<ReminderLike> = {}): ReminderLike => ({
  name: 'Vitamin D',
  kind: 'pill',
  time: 'morning',
  ...over,
});

// ─── D1 — name normalisation ─────────────────────────────────────────

scenario('D1 — names are compared the way a human would', () => {
  ok('case is ignored', isSameReminder(r(), r({ name: 'VITAMIN D' })));
  ok('surrounding space is ignored', isSameReminder(r(), r({ name: '  Vitamin D  ' })));
  ok('inner whitespace is collapsed', isSameReminder(r(), r({ name: 'Vitamin   D' })));
  ok('a genuinely different name is not a duplicate', !isSameReminder(r(), r({ name: 'Vitamin C' })));
  ok('normaliseName is stable', normaliseName('  Vitamin   D ') === 'vitamin d');
});

// ─── D2 — kind + time ────────────────────────────────────────────────

scenario('D2 — same name at a different time is NOT a duplicate', () => {
  ok('morning vs evening differ', !isSameReminder(r(), r({ time: 'evening' })));
  ok('different kind differs', !isSameReminder(r(), r({ kind: 'patch' })));
});

scenario('D3 — a preset and an explicit hour describing the same moment ARE duplicates', () => {
  // morning resolves to 09:00, so an explicit 9:00 is the same notification.
  ok('preset morning == explicit 9:00', isSameReminder(r(), r({ hour: 9, minute: 0 })));
  ok('explicit 9:30 is a different moment', !isSameReminder(r(), r({ hour: 9, minute: 30 })));
  ok('firingMinutes resolves the preset', firingMinutes(r()) === 9 * 60);
  ok('firingMinutes prefers the override', firingMinutes(r({ hour: 21, minute: 15 })) === 21 * 60 + 15);
});

// ─── D4 — finding the duplicate ──────────────────────────────────────

scenario('D4 — findDuplicateReminder returns the EXISTING row', () => {
  const existing = [r({ name: 'Iron' }), r({ name: 'Vitamin D' })];
  const hit = findDuplicateReminder(existing, r({ name: 'vitamin d' }));
  ok('a duplicate is found', hit !== null);
  ok('and it is the saved one, so the UI can point at it', hit?.name === 'Vitamin D');

  ok('no false positive on a new reminder',
    findDuplicateReminder(existing, r({ name: 'Magnesium' })) === null);
  ok('empty list is safe', findDuplicateReminder([], r()) === null);
});

// ─── D5 — time formatting ────────────────────────────────────────────

scenario('D5 — firing time reads naturally', () => {
  ok('morning preset', formatFiringTime(r()) === '9:00 am', formatFiringTime(r()));
  ok('midday preset', formatFiringTime(r({ time: 'midday' })) === '1:00 pm', formatFiringTime(r({ time: 'midday' })));
  ok('evening preset', formatFiringTime(r({ time: 'evening' })) === '8:00 pm', formatFiringTime(r({ time: 'evening' })));
  ok('midnight is 12 am, not 0', formatFiringTime(r({ hour: 0, minute: 0 })) === '12:00 am',
    formatFiringTime(r({ hour: 0, minute: 0 })));
  ok('noon is 12 pm', formatFiringTime(r({ hour: 12, minute: 0 })) === '12:00 pm',
    formatFiringTime(r({ hour: 12, minute: 0 })));
  ok('minutes are zero-padded', formatFiringTime(r({ hour: 7, minute: 5 })) === '7:05 am',
    formatFiringTime(r({ hour: 7, minute: 5 })));
});

// ─── D6 — the nudge ──────────────────────────────────────────────────

scenario('D6 — the nudge is specific and gentle', () => {
  const msg = duplicateReminderMessage(r());
  ok('names the reminder', msg.includes('Vitamin D'));
  ok('states the time', msg.includes('9:00 am'));
  ok('explains the consequence', /twice/i.test(msg));
  ok('never scolds', !/wrong|error|invalid|stupid|already told/i.test(msg), msg);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Reminder dedupe harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
