/**
 * Dottie — Sister Calendar Overlay Harness
 *
 * Assertive invariants for `buildSisterOverlay()` (src/engine/calendar/
 * sister-overlay.ts) — the pure layer that paints the people you care for onto
 * YOUR cycle calendar (device-test-6: "reuse the same calendar, show the
 * sister's days in a different colour, and tell me when her period is coming").
 *
 * These lock in the rules that matter: a real log always beats a guess, nothing
 * leaks outside the visible month, several sisters can share one day, and the
 * heads-up window is honest about how far ahead it looks.
 *
 * Run: npm run test:sister
 */

import {
  buildSisterOverlay,
  addDays,
  diffDays,
  type SisterCycleInput,
} from '../src/engine/calendar/sister-overlay';

// ─── SMALL FRAMEWORK (matches the other harnesses) ───────────────────

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

// ─── FIXTURES ────────────────────────────────────────────────────────

const MONTH_START = '2026-09-01';
const MONTH_END = '2026-09-30';
const TODAY = '2026-09-10';

function sister(over: Partial<SisterCycleInput> = {}): SisterCycleInput {
  return {
    memberId: 'm1',
    displayName: 'Maya',
    emoji: '🌸',
    periodDays: [],
    predictedNextPeriod: null,
    ...over,
  };
}

function build(sisters: SisterCycleInput[], today = TODAY, headsUpWindowDays?: number) {
  return buildSisterOverlay({
    sisters,
    rangeStart: MONTH_START,
    rangeEnd: MONTH_END,
    today,
    ...(headsUpWindowDays !== undefined ? { headsUpWindowDays } : {}),
  });
}

function kindsOn(o: ReturnType<typeof build>, iso: string): string[] {
  return (o.marksByDate.get(iso) ?? []).map((m) => m.kind);
}

// ─── S1 — logged days ────────────────────────────────────────────────

scenario('S1 — logged period days are marked', () => {
  const o = build([sister({ periodDays: ['2026-09-04', '2026-09-05'] })]);
  ok('4th marked', kindsOn(o, '2026-09-04').includes('logged'));
  ok('5th marked', kindsOn(o, '2026-09-05').includes('logged'));
  ok('untouched day has no marks', !o.marksByDate.has('2026-09-06'));
  const mark = o.marksByDate.get('2026-09-04')![0]!;
  ok('mark carries who it belongs to', mark.memberId === 'm1' && mark.displayName === 'Maya');
});

scenario('S2 — days outside the visible range never leak in', () => {
  const o = build([
    sister({ periodDays: ['2026-08-30', '2026-09-01', '2026-10-02'] }),
  ]);
  ok('previous month excluded', !o.marksByDate.has('2026-08-30'));
  ok('next month excluded', !o.marksByDate.has('2026-10-02'));
  ok('in-range boundary day included', kindsOn(o, '2026-09-01').includes('logged'));
});

scenario('S3 — duplicate logged rows collapse to one mark', () => {
  const o = build([sister({ periodDays: ['2026-09-04', '2026-09-04', '2026-09-04'] })]);
  ok('only one mark for the day', (o.marksByDate.get('2026-09-04') ?? []).length === 1,
    `got ${(o.marksByDate.get('2026-09-04') ?? []).length}`);
});

// ─── S4 — predicted band ─────────────────────────────────────────────

scenario('S4 — predicted band spans the period length', () => {
  const o = build([sister({ predictedNextPeriod: '2026-09-20', periodLengthDays: 4 })]);
  for (let i = 0; i < 4; i++) {
    const iso = addDays('2026-09-20', i);
    ok(`${iso} predicted`, kindsOn(o, iso).includes('predicted'));
  }
  ok('day after the band is clear', !o.marksByDate.has('2026-09-24'));
});

scenario('S5 — a real log always beats a prediction on the same day', () => {
  const o = build([
    sister({ periodDays: ['2026-09-20'], predictedNextPeriod: '2026-09-20', periodLengthDays: 3 }),
  ]);
  const marks = o.marksByDate.get('2026-09-20') ?? [];
  ok('exactly one mark on the overlapping day', marks.length === 1, `got ${marks.length}`);
  ok('and it is the logged one', marks[0]?.kind === 'logged');
  ok('the rest of the band still predicts', kindsOn(o, '2026-09-21').includes('predicted'));
});

// ─── S6 — several sisters ────────────────────────────────────────────

scenario('S6 — several sisters can share one day', () => {
  const o = build([
    sister({ memberId: 'm1', displayName: 'Maya', periodDays: ['2026-09-12'] }),
    sister({ memberId: 'm2', displayName: 'Ana', emoji: '🌷', periodDays: ['2026-09-12'] }),
  ]);
  const marks = o.marksByDate.get('2026-09-12') ?? [];
  ok('two marks on the shared day', marks.length === 2, `got ${marks.length}`);
  ok('both sisters identified',
    marks.some((m) => m.memberId === 'm1') && marks.some((m) => m.memberId === 'm2'));
});

// ─── S7 — heads-up ───────────────────────────────────────────────────

scenario('S7 — heads-up only fires inside the window, soonest first', () => {
  const o = build([
    sister({ memberId: 'far', displayName: 'Far', predictedNextPeriod: addDays(TODAY, 20) }),
    sister({ memberId: 'soon', displayName: 'Soon', predictedNextPeriod: addDays(TODAY, 2) }),
    sister({ memberId: 'today', displayName: 'Tod', predictedNextPeriod: TODAY }),
  ]);
  ok('far-off sister excluded', !o.headsUp.some((h) => h.memberId === 'far'));
  ok('two sisters flagged', o.headsUp.length === 2, `got ${o.headsUp.length}`);
  ok('soonest first', o.headsUp[0]?.memberId === 'today', o.headsUp.map((h) => h.memberId).join(','));
  ok('daysUntil is correct', o.headsUp[1]?.daysUntil === 2, `got ${o.headsUp[1]?.daysUntil}`);
});

scenario('S8 — heads-up copy is warm, specific and non-diagnostic', () => {
  const o = build([
    sister({ memberId: 'a', displayName: 'Maya', predictedNextPeriod: TODAY }),
    sister({ memberId: 'b', displayName: 'Ana', predictedNextPeriod: addDays(TODAY, 1) }),
    sister({ memberId: 'c', displayName: 'Zoe', predictedNextPeriod: addDays(TODAY, 4) }),
  ]);
  const byId = (id: string) => o.headsUp.find((h) => h.memberId === id)!;
  ok('today wording', byId('a').message.includes('today'), byId('a').message);
  ok('tomorrow wording', byId('b').message.includes('tomorrow'), byId('b').message);
  ok('n-days wording', byId('c').message.includes('4 days'), byId('c').message);
  ok('every message names the sister',
    o.headsUp.every((h) => h.message.includes(h.displayName)));
  ok('never states certainty', o.headsUp.every((h) => h.message.includes('likely')));
});

scenario('S9 — a past predicted date does not raise a heads-up', () => {
  const o = build([sister({ predictedNextPeriod: addDays(TODAY, -3) })]);
  ok('no heads-up for a date already gone', o.headsUp.length === 0);
});

scenario('S10 — no sisters / no data is safe and empty', () => {
  const empty = build([]);
  ok('no marks', empty.marksByDate.size === 0);
  ok('no heads-up', empty.headsUp.length === 0);

  const noCycle = build([sister()]);
  ok('a sister with no cycle data adds nothing', noCycle.marksByDate.size === 0 && noCycle.headsUp.length === 0);
});

scenario('S11 — date helpers are sane across month boundaries', () => {
  ok('addDays crosses a month end', addDays('2026-09-30', 1) === '2026-10-01', addDays('2026-09-30', 1));
  ok('addDays goes backwards', addDays('2026-09-01', -1) === '2026-08-31', addDays('2026-09-01', -1));
  ok('diffDays is signed', diffDays('2026-09-12', '2026-09-10') === 2);
  ok('diffDays negative in the past', diffDays('2026-09-08', '2026-09-10') === -2);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Sister overlay harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
