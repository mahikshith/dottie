/**
 * Dottie — Period Blocks Harness
 *
 * Assertive invariants for `groupPeriodBlocks()` / `analysePeriodPattern()`
 * (src/engine/calendar/period-blocks.ts) — the layer that turns loose logged
 * days into real period RANGES and catches data-entry slips (device-test-6:
 * "cap realistic periods per month, count period-range days properly").
 *
 * The tone rules are tested too: these nudges must read as "check your dates",
 * never as a medical opinion. Dottie does not diagnose.
 *
 * Run: npm run test:blocks
 */

import {
  groupPeriodBlocks,
  analysePeriodPattern,
} from '../src/engine/calendar/period-blocks';

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

function run(days: string[], n: number): string[] {
  // n consecutive days starting at each seed date
  return days.flatMap((d) => {
    const out: string[] = [];
    const base = new Date(`${d}T00:00:00`);
    for (let i = 0; i < n; i++) {
      const x = new Date(base.getTime());
      x.setDate(x.getDate() + i);
      out.push(
        `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      );
    }
    return out;
  });
}

// ─── B1 — grouping ───────────────────────────────────────────────────

scenario('B1 — consecutive days collapse into one block', () => {
  const b = groupPeriodBlocks(['2026-09-01', '2026-09-02', '2026-09-03']);
  ok('one block', b.length === 1, `got ${b.length}`);
  ok('start is the first day', b[0]?.start === '2026-09-01');
  ok('end is the last day', b[0]?.end === '2026-09-03');
  ok('length is INCLUSIVE (3, not 2)', b[0]?.lengthDays === 3, `got ${b[0]?.lengthDays}`);
});

scenario('B2 — a single day is a 1-day block, not 0', () => {
  const b = groupPeriodBlocks(['2026-09-07']);
  ok('one block', b.length === 1);
  ok('length 1', b[0]?.lengthDays === 1, `got ${b[0]?.lengthDays}`);
});

scenario('B3 — a gap splits blocks', () => {
  const b = groupPeriodBlocks(['2026-09-01', '2026-09-02', '2026-09-20', '2026-09-21']);
  ok('two blocks', b.length === 2, `got ${b.length}`);
  ok('second starts after the gap', b[1]?.start === '2026-09-20');
});

scenario('B4 — unsorted and duplicated input is handled', () => {
  const b = groupPeriodBlocks(['2026-09-03', '2026-09-01', '2026-09-02', '2026-09-02']);
  ok('still one block', b.length === 1, `got ${b.length}`);
  ok('duplicates do not inflate the length', b[0]?.lengthDays === 3, `got ${b[0]?.lengthDays}`);
});

scenario('B5 — blocks span month boundaries', () => {
  const b = groupPeriodBlocks(['2026-09-29', '2026-09-30', '2026-10-01']);
  ok('one block across the month end', b.length === 1, `got ${b.length}`);
  ok('length 3', b[0]?.lengthDays === 3);
  ok('ends in October', b[0]?.end === '2026-10-01');
});

scenario('B6 — empty input is safe', () => {
  ok('no blocks', groupPeriodBlocks([]).length === 0);
  const p = analysePeriodPattern([]);
  ok('no warnings', p.warnings.length === 0);
});

// ─── B7 — sanity warnings ────────────────────────────────────────────

scenario('B7 — a normal period raises NO warning', () => {
  const p = analysePeriodPattern(run(['2026-09-01'], 5));
  ok('one block of 5', p.blocks.length === 1 && p.blocks[0]?.lengthDays === 5);
  ok('no warnings for a textbook period', p.warnings.length === 0,
    p.warnings.map((w) => w.code).join(','));
});

scenario('B8 — an 8-day period is still normal, 11 days is flagged', () => {
  ok('8 days passes quietly', analysePeriodPattern(run(['2026-09-01'], 8)).warnings.length === 0);
  const long = analysePeriodPattern(run(['2026-09-01'], 11));
  ok('11 days is flagged', long.warnings.some((w) => w.code === 'long-block'));
});

scenario('B9 — two starts too close together are flagged', () => {
  const p = analysePeriodPattern([...run(['2026-09-01'], 3), ...run(['2026-09-08'], 3)]);
  ok('starts-too-close raised', p.warnings.some((w) => w.code === 'starts-too-close'));
  ok('only one such nudge (no nagging)',
    p.warnings.filter((w) => w.code === 'starts-too-close').length === 1);
});

scenario('B10 — a normal 28-day gap is NOT flagged', () => {
  const p = analysePeriodPattern([...run(['2026-09-01'], 5), ...run(['2026-09-29'], 5)]);
  ok('two blocks', p.blocks.length === 2, `got ${p.blocks.length}`);
  ok('no closeness warning', !p.warnings.some((w) => w.code === 'starts-too-close'));
});

scenario('B11 — too many starts inside one cycle window', () => {
  const p = analysePeriodPattern([
    ...run(['2026-09-01'], 2),
    ...run(['2026-09-16'], 2),
    ...run(['2026-09-30'], 2),
  ]);
  ok('three starts in 35 days is flagged', p.warnings.some((w) => w.code === 'too-many-starts'));
});

// ─── B12 — tone ──────────────────────────────────────────────────────

scenario('B12 — warnings are data-entry nudges, never diagnoses', () => {
  const all = [
    ...analysePeriodPattern(run(['2026-09-01'], 12)).warnings,
    ...analysePeriodPattern([...run(['2026-09-01'], 2), ...run(['2026-09-06'], 2)]).warnings,
    ...analysePeriodPattern([
      ...run(['2026-09-01'], 2),
      ...run(['2026-09-16'], 2),
      ...run(['2026-09-30'], 2),
    ]).warnings,
  ];
  ok('some warnings were produced', all.length > 0);
  const banned = /abnormal|not normal|unhealthy|disorder|you should see|diagnos|wrong with/i;
  ok('no diagnostic or alarming language',
    all.every((w) => !banned.test(w.message)),
    all.map((w) => w.message).join(' | '));
  ok('every warning offers a way out',
    all.every((w) => /double-check|check|tap|look/i.test(w.message)));
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Period blocks harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
