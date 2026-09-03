/**
 * Dottie — Civil Date Harness
 *
 * The regression test for the freeze that survived two wrong diagnoses
 * (device-test-7). The bug was never in the UI: `addDay`/`subtractDay` parsed a
 * date as LOCAL midnight and serialised it as UTC, so east of Greenwich
 * `addDay(x) === x`, and a `while (true)` walk over it wedged the JS thread
 * forever the first time a period day was logged after an existing one.
 *
 * ─── WHY THIS HARNESS RE-EXECS ITSELF ───────────────────────────────
 *
 *  The reason CI never caught it is that CI runs at UTC+0, where the broken
 *  helper is accidentally correct. A test that only runs in the harness's own
 *  timezone would have passed on the broken code too — so it would not have
 *  been a test at all. This file therefore re-runs its own body under a set of
 *  timezones spanning both sides of Greenwich (Node reads TZ at process start,
 *  so a child process is the only honest way to do it).
 *
 *  Asia/Kolkata is the owner's timezone and the one that froze the app.
 *
 * Run: npm run test:dates
 */

import { execFileSync } from 'node:child_process';
import {
  addDays,
  nextDay,
  prevDay,
  daysBetween,
  daysApart,
  isCivilDate,
} from '../src/utils/civil-date';

const TIMEZONES = [
  'UTC',
  'America/Los_Angeles', // -8
  'America/New_York',    // -5
  'Europe/London',       // +0/+1 — broke in summer only
  'Europe/Berlin',       // +1/+2
  'Asia/Kolkata',        // +5:30 — the owner's device
  'Asia/Tokyo',          // +9
  'Pacific/Kiritimati',  // +14, the extreme
];

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

// ─── THE BODY, RUN ONCE PER TIMEZONE ─────────────────────────────────

function runInvariants(): void {
  const tz = process.env.TZ ?? '(default)';

  scenario(`D1 · [${tz}] a day forward is a DIFFERENT, later day`, () => {
    // The exact assertion the old helper failed. addDay returning its own
    // argument is what turned the period-block walk into an infinite loop.
    for (const d of ['2026-09-01', '2026-01-31', '2026-02-28', '2026-12-31', '2024-02-28']) {
      const n = nextDay(d);
      ok(`nextDay(${d}) advances`, n > d, `got ${n}`);
      ok(`nextDay(${d}) is exactly one day`, daysBetween(d, n) === 1, `got ${daysBetween(d, n)}`);
    }
  });

  scenario(`D2 · [${tz}] a day back is a DIFFERENT, earlier day`, () => {
    for (const d of ['2026-09-01', '2026-03-01', '2026-01-01', '2024-03-01']) {
      const p = prevDay(d);
      ok(`prevDay(${d}) goes back`, p < d, `got ${p}`);
      ok(`prevDay(${d}) is exactly one day`, daysBetween(p, d) === 1, `got ${daysBetween(p, d)}`);
    }
  });

  scenario(`D3 · [${tz}] next and prev are exact inverses`, () => {
    for (const d of ['2026-09-01', '2026-02-28', '2026-03-01', '2025-12-31', '2024-02-29']) {
      ok(`round-trip ${d}`, prevDay(nextDay(d)) === d, `got ${prevDay(nextDay(d))}`);
    }
  });

  scenario(`D4 · [${tz}] known calendar answers`, () => {
    ok('2026-01-31 + 1 = 2026-02-01', nextDay('2026-01-31') === '2026-02-01', nextDay('2026-01-31'));
    ok('2026-02-28 + 1 = 2026-03-01 (non-leap)', nextDay('2026-02-28') === '2026-03-01', nextDay('2026-02-28'));
    ok('2024-02-28 + 1 = 2024-02-29 (leap)', nextDay('2024-02-28') === '2024-02-29', nextDay('2024-02-28'));
    ok('2024-02-29 + 1 = 2024-03-01', nextDay('2024-02-29') === '2024-03-01', nextDay('2024-02-29'));
    ok('2026-12-31 + 1 = 2027-01-01', nextDay('2026-12-31') === '2027-01-01', nextDay('2026-12-31'));
    ok('2026-01-01 - 1 = 2025-12-31', prevDay('2026-01-01') === '2025-12-31', prevDay('2026-01-01'));
    ok('2026-03-01 + 28 = 2026-03-29', addDays('2026-03-01', 28) === '2026-03-29', addDays('2026-03-01', 28));
    ok('2026-03-29 - 28 = 2026-03-01', addDays('2026-03-29', -28) === '2026-03-01', addDays('2026-03-29', -28));
  });

  scenario(`D5 · [${tz}] DST transitions do not shift a civil date`, () => {
    // Every one of these spans a DST boundary somewhere in the TZ list. A
    // local-time implementation loses or gains an hour here and can land on
    // the wrong calendar day; UTC arithmetic cannot.
    const spans: [string, number, string][] = [
      ['2026-03-07', 7, '2026-03-14'],  // US spring forward
      ['2026-03-28', 2, '2026-03-30'],  // EU spring forward
      ['2026-10-31', 2, '2026-11-02'],  // US/EU fall back
      ['2026-04-01', 30, '2026-05-01'], // Southern-hemisphere transitions
    ];
    for (const [from, n, expect] of spans) {
      ok(`${from} + ${n} = ${expect}`, addDays(from, n) === expect, addDays(from, n));
      ok(`${expect} - ${n} = ${from}`, addDays(expect, -n) === from, addDays(expect, -n));
    }
  });

  scenario(`D6 · [${tz}] the period-block walk terminates`, () => {
    // This is the freeze itself, reduced to its essentials: walk forward
    // through a contiguous set of logged period days. With the old helper the
    // cursor never moved and this loop never returned.
    const walk = (days: string[], start: string): string => {
      const set = new Set(days);
      let end = start;
      let cursor = start;
      for (let step = 0; step < 30; step++) {
        const candidate = nextDay(cursor);
        if (candidate <= cursor) break;
        if (!set.has(candidate)) break;
        end = candidate;
        cursor = candidate;
      }
      return end;
    };
    ok('single day block ends on itself',
      walk(['2026-09-01'], '2026-09-01') === '2026-09-01');
    ok('5-day block ends on day 5',
      walk(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'], '2026-09-01')
        === '2026-09-05',
      walk(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'], '2026-09-01'));
    ok('block stops at the gap',
      walk(['2026-09-01', '2026-09-02', '2026-09-04'], '2026-09-01') === '2026-09-02');
    ok('block across a month boundary',
      walk(['2026-01-30', '2026-01-31', '2026-02-01'], '2026-01-30') === '2026-02-01',
      walk(['2026-01-30', '2026-01-31', '2026-02-01'], '2026-01-30'));
  });

  scenario(`D7 · [${tz}] the "most recent period start" scan`, () => {
    // The second victim of the same helper: getLastPeriodStart() asks "is the
    // PREVIOUS day also a period day?". Off by one, it returns the wrong start,
    // which is what produced the bogus "Day 168 / 0 cycles" on Home.
    const lastStart = (daysDesc: string[]): string | null => {
      const set = new Set(daysDesc);
      for (const d of daysDesc) if (!set.has(prevDay(d))) return d;
      return daysDesc[daysDesc.length - 1] ?? null;
    };
    ok('contiguous block → its first day',
      lastStart(['2026-09-03', '2026-09-02', '2026-09-01']) === '2026-09-01');
    ok('two blocks → the newer block’s first day',
      lastStart(['2026-09-12', '2026-09-11', '2026-08-02', '2026-08-01']) === '2026-09-11',
      String(lastStart(['2026-09-12', '2026-09-11', '2026-08-02', '2026-08-01'])));
    ok('single day → itself', lastStart(['2026-09-09']) === '2026-09-09');
  });

  scenario(`D8 · [${tz}] distances are signed correctly`, () => {
    ok('forward is positive', daysBetween('2026-09-01', '2026-09-05') === 4);
    ok('backward is negative', daysBetween('2026-09-05', '2026-09-01') === -4);
    ok('same day is zero', daysBetween('2026-09-01', '2026-09-01') === 0);
    ok('daysApart is unsigned', daysApart('2026-09-05', '2026-09-01') === 4);
    ok('a 28-day cycle measures 28', daysApart('2026-01-01', '2026-01-29') === 28);
  });

  scenario(`D9 · [${tz}] malformed input is rejected, not silently wrong`, () => {
    ok('valid date accepted', isCivilDate('2026-09-01'));
    ok('overflow date rejected', !isCivilDate('2026-02-31'));
    ok('wrong shape rejected', !isCivilDate('2026-9-1'));
    ok('empty rejected', !isCivilDate(''));
    let threw = false;
    try { addDays('not-a-date', 1); } catch { threw = true; }
    ok('addDays throws on garbage rather than returning NaN-ish text', threw);
  });
}

// ─── DRIVER ──────────────────────────────────────────────────────────
//
//  Parent: re-exec once per timezone. Child (TZ_CHILD set): run the body.

if (process.env.DOTTIE_TZ_CHILD) {
  runInvariants();
  process.exit(failures === 0 ? 0 : 1);
} else {
  let bad = 0;
  for (const tz of TIMEZONES) {
    console.log(`\n\x1b[36m━━━ TZ=${tz} ━━━\x1b[0m`);
    try {
      const out = execFileSync(
        process.execPath,
        ['--import', 'tsx', __filename],
        { env: { ...process.env, TZ: tz, DOTTIE_TZ_CHILD: '1' }, encoding: 'utf8' }
      );
      process.stdout.write(out);
    } catch (err) {
      bad++;
      const e = err as { stdout?: string; stderr?: string };
      if (e.stdout) process.stdout.write(e.stdout);
      if (e.stderr) process.stderr.write(e.stderr);
      console.log(`\x1b[31m✗ failures under TZ=${tz}\x1b[0m`);
    }
  }
  if (bad === 0) {
    console.log('\n\x1b[32m✓ Civil date harness — every invariant holds in all 8 timezones.\x1b[0m');
    process.exit(0);
  }
  console.log(`\n\x1b[31m✗ ${bad} timezone(s) failed.\x1b[0m`);
  process.exit(1);
}
