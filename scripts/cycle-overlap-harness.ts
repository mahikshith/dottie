/**
 * Dottie — Cycle Overlap Harness
 *
 * Invariants for `findCycleOverlaps()` (src/engine/calendar/cycle-overlap.ts) —
 * the "your days and hers could land together" insight added in device-test-8.
 *
 * Two things are worth asserting hard here. First the interval maths: an
 * off-by-one on an inclusive date range produces a plausible-looking but wrong
 * answer that nobody would catch by eye. Second the TONE: this feature sits
 * next to a popular folk claim (menstrual synchrony) that has repeatedly failed
 * to replicate, so the copy must never assert cycles sync or offer a cause.
 *
 * Run: npm run test:overlap
 */

import { findCycleOverlaps, type OverlapPerson } from '../src/engine/calendar/cycle-overlap';

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

function sister(predicted: string | null, name = 'Aisha'): OverlapPerson {
  return { memberId: 'm1', displayName: name, emoji: '🌸', predictedNextPeriod: predicted };
}

const TODAY = '2026-09-01';

// ─── O1 — nothing to say ─────────────────────────────────────────────

scenario('O1 · says nothing when there is nothing to say', () => {
  ok('no user prediction → no findings',
    findCycleOverlaps({ userPredictedStart: null, sisters: [sister('2026-09-10')], today: TODAY }).length === 0);
  ok('no sister prediction → no findings',
    findCycleOverlaps({ userPredictedStart: '2026-09-10', sisters: [sister(null)], today: TODAY }).length === 0);
  ok('no sisters → no findings',
    findCycleOverlaps({ userPredictedStart: '2026-09-10', sisters: [], today: TODAY }).length === 0);
  ok('far apart → no findings',
    findCycleOverlaps({ userPredictedStart: '2026-09-05', sisters: [sister('2026-09-28')], today: TODAY }).length === 0);
});

// ─── O2 — interval maths ─────────────────────────────────────────────

scenario('O2 · identical predictions overlap fully and inclusively', () => {
  const [f] = findCycleOverlaps({
    userPredictedStart: '2026-09-10',
    userPeriodLengthDays: 5,
    userWindowDays: 0,
    sisterWindowDays: 0,
    sisters: [sister('2026-09-10')],
    today: TODAY,
  });
  ok('a finding exists', !!f);
  ok('starts on the shared first day', f!.overlapStart === '2026-09-10', f!.overlapStart);
  ok('ends on the shared last day', f!.overlapEnd === '2026-09-14', f!.overlapEnd);
  ok('counts 5 days inclusively', f!.overlapDays === 5, String(f!.overlapDays));
  ok('is 9 days away', f!.daysAway === 9, String(f!.daysAway));
});

scenario('O3 · partial overlap is clipped to the shared stretch', () => {
  const [f] = findCycleOverlaps({
    userPredictedStart: '2026-09-10',   // 10–14
    userPeriodLengthDays: 5,
    userWindowDays: 0,
    sisterWindowDays: 0,
    sisters: [sister('2026-09-13')],    // 13–17
    today: TODAY,
  });
  ok('starts at the later start', f!.overlapStart === '2026-09-13', f!.overlapStart);
  ok('ends at the earlier end', f!.overlapEnd === '2026-09-14', f!.overlapEnd);
  ok('2 shared days', f!.overlapDays === 2, String(f!.overlapDays));
});

scenario('O4 · touching by exactly one day still counts', () => {
  const [f] = findCycleOverlaps({
    userPredictedStart: '2026-09-10',   // 10–14
    userPeriodLengthDays: 5,
    userWindowDays: 0,
    sisterWindowDays: 0,
    sisters: [sister('2026-09-14')],    // 14–18
    today: TODAY,
  });
  ok('one shared day found', !!f && f.overlapDays === 1, f ? String(f.overlapDays) : 'none');

  const none = findCycleOverlaps({
    userPredictedStart: '2026-09-10',
    userPeriodLengthDays: 5,
    userWindowDays: 0,
    sisterWindowDays: 0,
    sisters: [sister('2026-09-15')],    // 15–19, starts the day after ours ends
    today: TODAY,
  });
  ok('one day apart is NOT an overlap', none.length === 0);
});

// ─── O5 — uncertainty widens the windows ─────────────────────────────

scenario('O5 · the ± windows are what is compared, not bare dates', () => {
  const bare = findCycleOverlaps({
    userPredictedStart: '2026-09-10',
    userPeriodLengthDays: 5,
    userWindowDays: 0,
    sisterWindowDays: 0,
    sisters: [sister('2026-09-17')],
    today: TODAY,
  });
  ok('no overlap with zero uncertainty', bare.length === 0);

  const hedged = findCycleOverlaps({
    userPredictedStart: '2026-09-10',
    userPeriodLengthDays: 5,
    userWindowDays: 2,
    sisterWindowDays: 3,
    sisters: [sister('2026-09-17')],
    today: TODAY,
  });
  ok('the same pair DOES overlap once error bars are included', hedged.length === 1);
});

// ─── O6 — ordering + multiple sisters ────────────────────────────────

scenario('O6 · soonest first', () => {
  const found = findCycleOverlaps({
    userPredictedStart: '2026-09-10',
    userPeriodLengthDays: 8,
    userWindowDays: 3,
    sisterWindowDays: 3,
    sisters: [
      { memberId: 'b', displayName: 'Bea', emoji: '🌷', predictedNextPeriod: '2026-09-16' },
      { memberId: 'a', displayName: 'Ada', emoji: '🌸', predictedNextPeriod: '2026-09-08' },
    ],
    today: TODAY,
  });
  ok('both found', found.length === 2, String(found.length));
  ok('sorted by how soon', found[0]!.daysAway <= found[1]!.daysAway,
    found.map((f) => f.daysAway).join());
});

// ─── O7 — tone ───────────────────────────────────────────────────────

scenario('O7 · never claims cycles sync, never diagnoses', () => {
  const found = findCycleOverlaps({
    userPredictedStart: '2026-09-02',
    sisters: [sister('2026-09-02'), { memberId: 'c', displayName: 'Cara', emoji: '🌼', predictedNextPeriod: '2026-09-03' }],
    today: TODAY,
  });
  ok('findings exist to check', found.length === 2);
  const banned = /\b(sync\w*|in tune|align\w*|because|caused? by|abnormal|irregular)\b/i;
  found.forEach((f) =>
    ok(`"${f.summary.slice(0, 44)}…" makes no synchrony claim`, !banned.test(f.summary), f.summary)
  );
  ok('copy is hedged', found.every((f) => /could|look like|likely|about|around/i.test(f.summary)));
  ok('the sister is named', found.every((f) => f.summary.includes(f.displayName)));
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Cycle overlap harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
