/**
 * Dottie — Chart Data Harness
 *
 * Assertive invariants for `buildCycleLengthSeries()` / `buildFlowShape()`
 * (src/engine/prediction/chart-data.ts) — the numbers behind the two figures
 * added in device-test-7 ("you are only showing one graph ... make sure these
 * graph and scientific explanation are mandatory no matter what").
 *
 * The point of testing these is that a chart CANNOT be eyeballed for
 * correctness: a wrong SD still draws a plausible band. So the statistics are
 * checked against hand-computed values, the domain is checked to always
 * contain the band it has to draw, and the copy is checked for tone.
 *
 * Run: npm run test:charts
 */

import {
  buildCycleLengthSeries,
  buildFlowShape,
} from '../src/engine/prediction/chart-data';
import type { CycleRecord } from '../src/types/cycle.types';

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

function cycle(startDate: string, cycleLength: number, averageFlow = 3): CycleRecord {
  return { startDate, endDate: startDate, cycleLength, periodLength: 5, averageFlow };
}

// ─── C1 — cycle length series ────────────────────────────────────────

scenario('C1 · empty history still yields a drawable, honest series', () => {
  const s = buildCycleLengthSeries([]);
  ok('no points', s.points.length === 0);
  ok('flagged provisional', s.provisional);
  ok('domain is still a valid range', s.maxLength > s.minLength);
  ok('caption invites logging rather than showing a blank',
    /log/i.test(s.caption), s.caption);
});

scenario('C2 · mean and SD match hand-computed values', () => {
  // Lengths 26, 28, 30 → mean 28, sample SD = 2.
  const s = buildCycleLengthSeries([
    cycle('2026-01-01', 26),
    cycle('2026-01-27', 28),
    cycle('2026-02-24', 30),
  ]);
  ok('mean is 28', s.mean === 28, String(s.mean));
  ok('sample SD is 2', s.sd === 2, String(s.sd));
  ok('not provisional with 3 cycles', !s.provisional);
});

scenario('C3 · points are chronological, oldest first', () => {
  const s = buildCycleLengthSeries([
    cycle('2026-03-01', 31),
    cycle('2026-01-01', 27),
    cycle('2026-02-01', 29),
  ]);
  const dates = s.points.map((p) => p.startDate);
  ok('sorted ascending', dates.join() === '2026-01-01,2026-02-01,2026-03-01', dates.join());
  ok('index is 1-based and dense',
    s.points.every((p, i) => p.index === i + 1));
});

scenario('C4 · domain always contains the ±SD band it must draw', () => {
  // A big outlier: if the domain were computed from the dots alone the band
  // would be clipped at the frame and the figure would lie.
  const s = buildCycleLengthSeries([
    cycle('2026-01-01', 27),
    cycle('2026-01-28', 28),
    cycle('2026-02-25', 45),
  ]);
  ok('band top inside domain', s.mean + s.sd <= s.maxLength, `${s.mean + s.sd} > ${s.maxLength}`);
  ok('band bottom inside domain', s.mean - s.sd >= s.minLength, `${s.mean - s.sd} < ${s.minLength}`);
  ok('every dot inside domain',
    s.points.every((p) => p.length >= s.minLength && p.length <= s.maxLength));
});

scenario('C5 · implausible lengths are dropped, not plotted', () => {
  const s = buildCycleLengthSeries([
    cycle('2026-01-01', 3),    // data-entry noise
    cycle('2026-01-05', 28),
    cycle('2026-02-02', 400),  // noise
    cycle('2026-03-02', 30),
  ]);
  ok('only the two plausible cycles survive', s.points.length === 2, String(s.points.length));
  ok('mean unaffected by noise', s.mean === 29, String(s.mean));
});

scenario('C6 · limit keeps the most RECENT cycles', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    cycle(`2026-01-${String(i + 1).padStart(2, '0')}`, 20 + i)
  );
  const s = buildCycleLengthSeries(many, 5);
  ok('exactly 5 plotted', s.points.length === 5, String(s.points.length));
  ok('they are the newest five',
    s.points[0]!.startDate === '2026-01-16' && s.points[4]!.startDate === '2026-01-20',
    s.points.map((p) => p.startDate).join());
});

scenario('C7 · a single cycle cannot claim a spread', () => {
  const s = buildCycleLengthSeries([cycle('2026-01-01', 28)]);
  ok('SD is 0, not NaN', s.sd === 0);
  ok('provisional', s.provisional);
  ok('caption explains why there is no band', /two/i.test(s.caption), s.caption);
});

// ─── C8 — flow shape ─────────────────────────────────────────────────

scenario('C8 · flow shape length follows the predicted period length', () => {
  ok('3-day period → 3 bars', buildFlowShape(3, []).points.length === 3);
  ok('7-day period → 7 bars', buildFlowShape(7, []).points.length === 7);
  ok('absurd input is clamped to 8', buildFlowShape(40, []).points.length === 8);
  ok('absurd small input is clamped to 2', buildFlowShape(0, []).points.length === 2);
});

scenario('C9 · heaviness decreases monotonically and stays in range', () => {
  const s = buildFlowShape(6, []);
  ok('day 1 is the peak', s.points[0]!.level >= s.points[1]!.level);
  ok('never increases later in the period',
    s.points.every((p, i) => i === 0 || p.level <= s.points[i - 1]!.level),
    s.points.map((p) => p.level).join());
  ok('all levels within 0–1', s.points.every((p) => p.level > 0 && p.level <= 1));
  ok('at least one day flagged heavy', s.points.some((p) => p.heavy));
});

scenario('C10 · own logged flow is used when present, and is declared', () => {
  const light = buildFlowShape(5, [
    cycle('2026-01-01', 28, 1),
    cycle('2026-01-29', 28, 1),
  ]);
  const heavy = buildFlowShape(5, [
    cycle('2026-01-01', 28, 5),
    cycle('2026-01-29', 28, 5),
  ]);
  ok('light logs produce a lower day-1 level than heavy logs',
    light.points[0]!.level < heavy.points[0]!.level,
    `${light.points[0]!.level} vs ${heavy.points[0]!.level}`);
  ok('source is declared as the user’s own', light.source === 'your-logs');
  ok('not provisional when own flow exists', !light.provisional);
  ok('caption says how many cycles it used', /cycle/i.test(light.caption), light.caption);
});

scenario('C11 · with no flow logged it says so instead of implying measurement', () => {
  const s = buildFlowShape(5, []);
  ok('source is the population pattern', s.source === 'typical-pattern');
  ok('provisional', s.provisional);
  ok('caption attributes it to most people',
    /most people|typical/i.test(s.caption), s.caption);
});

scenario('C12 · tone — no diagnostic or judging language anywhere', () => {
  const banned = /abnormal|irregular|disorder|unhealthy|concerning|problem|wrong with/i;
  const captions = [
    buildCycleLengthSeries([]).caption,
    buildCycleLengthSeries([cycle('2026-01-01', 28)]).caption,
    buildCycleLengthSeries([cycle('2026-01-01', 21), cycle('2026-02-01', 45)]).caption,
    buildCycleLengthSeries([cycle('2026-01-01', 28), cycle('2026-01-29', 28)]).caption,
    buildFlowShape(5, []).caption,
    buildFlowShape(5, [cycle('2026-01-01', 28, 4)]).caption,
  ];
  captions.forEach((c, i) =>
    ok(`caption ${i + 1} is non-diagnostic`, !banned.test(c), c)
  );
  ok('a wide spread is described, not judged',
    /common/i.test(
      buildCycleLengthSeries([cycle('2026-01-01', 21), cycle('2026-02-01', 45)]).caption
    ));
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Chart data harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
