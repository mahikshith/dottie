/**
 * Dottie — Sister Cycle Harness
 *
 * A shadow sister has no cycle_records of her own — only the period DAYS you
 * ticked for her. buildSisterCycleHistory turns those into the same
 * CycleRecord[] the predictor and explainer consume, so she gets the real model
 * rather than a simplified stand-in (device-test-16).
 *
 * What's worth asserting rather than eyeballing:
 *  S1 SHAPE       — a cycle is measured BETWEEN two blocks; one block is not a
 *                   cycle, and the final block anchors rather than counts.
 *  S2 GAPS        — a four-month hole is missed logging, not a 120-day cycle.
 *                   Letting one in would widen her window for a year.
 *  S3 HONESTY     — the summary never claims more data than exists, and never
 *                   says anything about her body.
 *  S4 ROBUSTNESS  — malformed dates, duplicates and unsorted input can't throw.
 *
 * Run: npm run test:sistercycle
 */

import {
  buildSisterCycleHistory,
  sisterHistorySummary,
} from '../src/engine/calendar/sister-cycle';
import { addDays } from '../src/utils/civil-date';

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

/** Period days for `blocks` bleeds of `len` days, `gap` apart. */
function bleeds(start: string, gaps: number[], len = 4): string[] {
  const out: string[] = [];
  let cursor = start;
  out.push(...Array.from({ length: len }, (_, d) => addDays(cursor, d)));
  for (const g of gaps) {
    cursor = addDays(cursor, g);
    out.push(...Array.from({ length: len }, (_, d) => addDays(cursor, d)));
  }
  return out;
}

// ─── S1 ──────────────────────────────────────────────────────────────

scenario('S1 · a cycle is the gap between two bleeds, never one bleed', () => {
  const none = buildSisterCycleHistory([]);
  ok('no days at all → empty history', none.records.length === 0 && none.blocksLogged === 0);
  ok('and no anchor to predict from', none.lastPeriodStart === null);

  const one = buildSisterCycleHistory(bleeds('2026-01-01', []));
  ok('one bleed logs a block', one.blocksLogged === 1);
  ok('but yields NO cycle — you cannot measure a length from one start', one.records.length === 0);
  ok('it still anchors the prediction', one.lastPeriodStart === '2026-01-01');

  const three = buildSisterCycleHistory(bleeds('2026-01-01', [28, 30]));
  ok('three bleeds → two completed cycles', three.records.length === 2, String(three.records.length));
  ok('lengths are the gaps between starts', three.records.map((r) => r.cycleLength).join(',') === '28,30');
  ok('the anchor is the LAST bleed, not the first', three.lastPeriodStart === addDays('2026-01-01', 58));
  ok('period length comes from the block', three.records[0]!.periodLength === 4);
  ok('records run oldest first', three.records[0]!.startDate < three.records[1]!.startDate);
});

// ─── S2 ──────────────────────────────────────────────────────────────

scenario('S2 · a logging hole is not a cycle', () => {
  // Jan, Feb, then nothing until June — that gap is missed logging.
  const gappy = buildSisterCycleHistory(bleeds('2026-01-01', [28, 120, 29]));
  ok('the 120-day gap is discarded', gappy.discardedGaps === 1, String(gappy.discardedGaps));
  ok('the real cycles survive', gappy.records.map((r) => r.cycleLength).join(',') === '28,29');
  ok('a discarded gap never becomes a record', gappy.records.every((r) => r.cycleLength <= 90));

  const tooShort = buildSisterCycleHistory(bleeds('2026-01-01', [5], 2));
  ok('an implausibly short gap is discarded too', tooShort.records.length === 0 && tooShort.discardedGaps === 1);

  ok('boundaries are inclusive', buildSisterCycleHistory(bleeds('2026-01-01', [15], 1)).records.length === 1);
  ok('and exclusive past them', buildSisterCycleHistory(bleeds('2026-01-01', [91], 1)).records.length === 0);
});

// ─── S3 ──────────────────────────────────────────────────────────────

scenario('S3 · the summary states only what the data supports', () => {
  const none = sisterHistorySummary(buildSisterCycleHistory([]), 'Vin');
  ok('with nothing logged it asks for days', none.includes('Mark a few') && none.includes('Vin'));

  const one = sisterHistorySummary(buildSisterCycleHistory(bleeds('2026-01-01', [])), 'Vin');
  ok('with one bleed it says a second is needed', one.includes('second'), one);
  ok('and never claims a cycle it does not have', !/\d+ completed cycle/.test(one));

  const many = sisterHistorySummary(buildSisterCycleHistory(bleeds('2026-01-01', [28, 30])), 'Vin');
  ok('with real cycles it names the count', many.includes('2 completed cycles'), many);
  ok('singular reads correctly', sisterHistorySummary(buildSisterCycleHistory(bleeds('2026-01-01', [28])), 'Vin').includes('1 completed cycle'));

  const gappy = sisterHistorySummary(buildSisterCycleHistory(bleeds('2026-01-01', [28, 120, 29])), 'Vin');
  ok('a discarded gap is disclosed, not hidden', gappy.includes('left out as missed logging'), gappy);

  const all = [none, one, many, gappy].join(' ');
  ok('nothing here claims anything about her body', !/your body|she is|her body (is|will)/i.test(all));
  ok('and invents no population statistic', !/\d+\s*%/.test(all));
});

// ─── S4 ──────────────────────────────────────────────────────────────

scenario('S4 · bad input cannot throw or poison the history', () => {
  const messy = buildSisterCycleHistory([
    '2026-02-03', '2026-01-02', 'nonsense', '', '2026-01-01',
    '2026-01-01', '2026-02-02', '01-01-2026', '2026-02-01',
  ]);
  ok('unsorted input is handled', messy.blocksLogged === 2, String(messy.blocksLogged));
  ok('duplicates collapse', messy.records.length === 1);
  ok('malformed dates are dropped, not parsed', messy.records[0]!.cycleLength === 31, String(messy.records[0]?.cycleLength));
  ok('deterministic', JSON.stringify(buildSisterCycleHistory(['2026-01-01'])) === JSON.stringify(buildSisterCycleHistory(['2026-01-01'])));
});

console.log(
  failures === 0
    ? "\n\x1b[32m✓ sister cycle: a sister's model is built only from what you actually logged\x1b[0m\n"
    : `\n\x1b[31m✗ ${failures} failure(s)\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
