/**
 * Dottie — Gentle Rhythm Harness (Learn Redesign Phase 4)
 *
 * Fails loudly if the Learn cadence engine regresses. Runs pure module
 * behavior — no React Native, no MMKV. Runs via tsx: `npm run test:rhythm`.
 *
 *   INV 1  Idempotent — two visits on the same day count once.
 *   INV 2  Rest days count. A gap day is NOT reset; missing days are silent.
 *   INV 3  Never punishes. warmLabel never contains "broken", "lost", "reset",
 *          "you should", "keep it up", "don't miss".
 *   INV 4  30-day window prune — anything older is dropped from state.
 *   INV 5  daysLast7 and daysLast14 are calendar-window counts, capped
 *          correctly (7 and 14 max, 0 min).
 *   INV 6  First-ever-visit label is warm + welcoming ("welcome" wording).
 *   INV 7  Purely functional — recordVisit does not mutate its input.
 *   INV 8  Handles malformed / future dates without crashing.
 */

import {
  createInitialRhythmState,
  recordVisit,
  summarizeRhythm,
  RHYTHM_WINDOW_DAYS,
} from '../src/engine/learn/gentle-rhythm';

let failures = 0;
function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}

/** Shift `YYYY-MM-DD` by `days`. */
function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const t = Date.UTC(y!, m! - 1, d!) + days * 86400000;
  const dt = new Date(t);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

console.log('\n\x1b[1mGentle Rhythm Harness\x1b[22m');

// ─── INV 6: first-ever warm label ────────────────────────────────────
console.log('\nINV 6 — first-ever visit welcomes');
const s0 = createInitialRhythmState();
const emptySummary = summarizeRhythm(s0, '2026-09-02');
ok('empty state → warmLabel welcomes', /welcome/i.test(emptySummary.warmLabel), `label: ${emptySummary.warmLabel}`);
ok('empty state → daysLast7 === 0', emptySummary.daysLast7 === 0);
ok('empty state → mostRecent null', emptySummary.mostRecent === null);

// ─── INV 1: idempotent ───────────────────────────────────────────────
console.log('\nINV 1 — idempotent (double visit same day = one entry)');
const s1 = recordVisit(recordVisit(s0, '2026-09-02'), '2026-09-02T13:33:11Z');
ok('two writes same day → one entry', s1.visitedDays.length === 1);
ok('accepts full ISO and normalises to date', s1.visitedDays[0] === '2026-09-02');

// ─── INV 7: purity ───────────────────────────────────────────────────
console.log('\nINV 7 — recordVisit is pure (input untouched)');
const original = createInitialRhythmState();
const originalRef = original.visitedDays;
recordVisit(original, '2026-09-02');
recordVisit(original, '2026-09-03');
ok('input array is not mutated', original.visitedDays === originalRef && original.visitedDays.length === 0);

// ─── INV 2: rest days count (no reset) ───────────────────────────────
console.log('\nINV 2 — rest days do not reset');
let s = createInitialRhythmState();
s = recordVisit(s, '2026-08-25'); // day A
// skip 3 days
s = recordVisit(s, '2026-08-29'); // day B (3-day gap)
// skip 2 days
s = recordVisit(s, '2026-09-01'); // day C
const restSummary = summarizeRhythm(s, '2026-09-02');
ok('3 visits over 8 days survive gaps', restSummary.windowTotal === 3);
ok('daysLast7 covers today back 6 days (both B and C in window)', restSummary.daysLast7 === 2, `got: ${restSummary.daysLast7}`);
ok('daysLast14 covers both A, B, and C', restSummary.daysLast14 === 3, `got: ${restSummary.daysLast14}`);

// ─── INV 3: never punishes ───────────────────────────────────────────
console.log('\nINV 3 — no punishing language');
const punitive = /(broken|lost|reset|you should|keep it up|don'?t miss|fail(ed)?|missed)/i;
const scenarios: [string, ReturnType<typeof summarizeRhythm>][] = [
  ['zero last week',         summarizeRhythm({ visitedDays: [] }, '2026-09-02')],
  ['one visit today',        summarizeRhythm(recordVisit(createInitialRhythmState(), '2026-09-02'), '2026-09-02')],
  ['3 visits',               summarizeRhythm({ visitedDays: ['2026-08-31', '2026-09-01', '2026-09-02'] }, '2026-09-02')],
  ['6 of 7',                 summarizeRhythm({ visitedDays: ['2026-08-27','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01'] }, '2026-09-02')],
  ['all 7',                  summarizeRhythm({ visitedDays: ['2026-08-27','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-09-02'] }, '2026-09-02')],
  ['long absence then quiet week', summarizeRhythm({ visitedDays: ['2026-07-01'] }, '2026-09-02')],
];
for (const [name, summary] of scenarios) {
  ok(`label passes non-punitive check — ${name}: "${summary.warmLabel}"`, !punitive.test(summary.warmLabel));
}

// ─── INV 4: window prune ─────────────────────────────────────────────
console.log('\nINV 4 — old entries pruned at RHYTHM_WINDOW_DAYS');
const today = '2026-09-02';
const tooOld = shift(today, -(RHYTHM_WINDOW_DAYS + 5));   // beyond window
const justOld = shift(today, -(RHYTHM_WINDOW_DAYS - 1));  // still inside
let pruneState: { visitedDays: string[] } = { visitedDays: [tooOld, justOld] };
pruneState = recordVisit(pruneState, today);
ok('too-old entry pruned', !pruneState.visitedDays.includes(tooOld));
ok('just-inside entry kept', pruneState.visitedDays.includes(justOld));
ok('today added', pruneState.visitedDays.includes(today));

// ─── INV 5: window caps ──────────────────────────────────────────────
console.log('\nINV 5 — daysLast7/14 caps');
const dense: string[] = [];
for (let i = 0; i < 14; i++) dense.push(shift(today, -i));
const denseSummary = summarizeRhythm({ visitedDays: dense.sort() }, today);
ok('14 consecutive days → daysLast7 === 7', denseSummary.daysLast7 === 7);
ok('14 consecutive days → daysLast14 === 14', denseSummary.daysLast14 === 14);

// ─── INV 8: garbage input tolerated ──────────────────────────────────
console.log('\nINV 8 — malformed and future dates tolerated');
const dirty: { visitedDays: string[] } = { visitedDays: ['garbage', '2099-01-01', '2026-09-01'] };
const cleaned = recordVisit(dirty, today);
ok('malformed date dropped', !cleaned.visitedDays.includes('garbage'));
ok('future date dropped', !cleaned.visitedDays.includes('2099-01-01'));
ok('valid entry kept', cleaned.visitedDays.includes('2026-09-01'));

// ─── REPORT ─────────────────────────────────────────────────────────

console.log('');
if (failures === 0) {
  console.log(`  \x1b[32m✓ Gentle Rhythm — all invariants hold.\x1b[0m`);
  process.exit(0);
}
console.log(`  \x1b[31m✗ ${failures} invariant failure(s)\x1b[0m`);
process.exit(1);
