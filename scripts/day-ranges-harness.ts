/**
 * Dottie — calendar day-range harness (device-test-25)
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  The owner asked for the calendar to be readable as WORDS as well as
 *  colour — a dated list under the grid, behind a toggle — and attached one
 *  condition to it:
 *
 *      "But never, ever add contradictory information from the visual
 *       calendar and what we are showing in the information below."
 *
 *  That condition is the feature. A key that disagrees with its map is worse
 *  than no key: the grid says you were bleeding, the list underneath says the
 *  same days were follicular, and now nothing on the screen can be trusted.
 *
 *  The design answer is `src/engine/calendar/day-marks.ts` — ONE function
 *  decides what a day is, the grid switches on it to paint and the list groups
 *  on it to write. This harness is the proof that the arrangement holds:
 *
 *    R1  the precedence is what it claims to be, and a fact always wins
 *    R2  the ranges tile the month — every in-month day, exactly once, in order
 *    R3  every day the list covers carries the mark the grid painted, cell for
 *        cell, over a month of pseudo-random grids
 *    R4  the words: one label per mark, matching the legend chips verbatim
 *    R5  the swatches are the grid's own colours, not a parallel palette
 *    R6  the screen still goes through dayMark() and cannot re-derive its own
 *
 *  R3 is the one that would actually catch a regression. R6 is the one that
 *  stops someone quietly reintroducing a second decision.
 *
 *  Run: npm run test:ranges
 */

import './harness/bootstrap';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dayMark,
  groupDayRanges,
  markDetail,
  isRecorded,
  MARK_LABEL,
  MARK_SPOKEN,
  type DayMark,
  type MarkableDay,
} from '../src/engine/calendar/day-marks';
import { NOT_CONTRACEPTION } from '../src/engine/calendar/fertile-window';
import { getPhaseDescription } from '../src/engine/prediction/phase-calculator';
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

const ALL_MARKS: DayMark[] = [
  'logged',
  'predicted',
  'ovulation',
  'fertile',
  'menstrual',
  'follicular',
  'ovulatory',
  'luteal',
  'unknown',
];

const CALENDAR = readFileSync(join(__dirname, '..', 'app', '(tabs)', 'calendar.tsx'), 'utf8');

function day(iso: string, over: Partial<MarkableDay> = {}): MarkableDay {
  return {
    iso,
    inMonth: true,
    isPeriodDay: false,
    isPredictedPeriod: false,
    phase: null,
    beyondCycle: false,
    fertile: null,
    ...over,
  };
}

console.log('\x1b[1m\nDottie — the calendar says one thing\x1b[0m');

// ─── R1 · the precedence ─────────────────────────────────────────────

section('R1 · a day resolves to exactly one mark, in a stated order');

ok(
  'a logged day is logged, whatever else lands on it',
  dayMark(
    day('2026-08-10', {
      isPeriodDay: true,
      isPredictedPeriod: true,
      fertile: 'ovulation',
      phase: 'luteal',
    })
  ) === 'logged'
);
ok(
  'a predicted day beats the phase band underneath it',
  dayMark(day('2026-08-10', { isPredictedPeriod: true, phase: 'luteal' })) === 'predicted'
);
ok(
  'the ovulation day beats the fertile span it sits in',
  dayMark(day('2026-08-10', { fertile: 'ovulation', phase: 'ovulatory' })) === 'ovulation'
);
ok(
  'a fertile day beats the phase band',
  dayMark(day('2026-08-10', { fertile: 'fertile', phase: 'follicular' })) === 'fertile'
);
ok('a plain phase day is its phase', dayMark(day('2026-08-10', { phase: 'luteal' })) === 'luteal');
ok('a day with nothing on it is unknown', dayMark(day('2026-08-10')) === 'unknown');
ok(
  'a day past the grace draws nothing, even with an old phase attached',
  // The screen sets phase to null past PHASE_DISPLAY_GRACE_DAYS (DT24); this
  // pins the shape of that day rather than the arithmetic, which test:phase owns.
  dayMark(day('2026-08-10', { phase: null, beyondCycle: true })) === 'unknown'
);
ok(
  'a day outside the visible month is never claimed by this month',
  dayMark(day('2026-07-31', { inMonth: false, isPeriodDay: true, phase: 'menstrual' })) ===
    'unknown'
);

// ─── R2 · the ranges tile the month ──────────────────────────────────

section('R2 · the ranges cover every in-month day exactly once, in order');

/**
 * A month grid with the leading/trailing days of the neighbouring months, the
 * way the screen builds one.
 */
function grid(startISO: string, len: number, lead: number, tail: number): MarkableDay[] {
  const out: MarkableDay[] = [];
  for (let i = lead; i > 0; i--) out.push(day(addDays(startISO, -i), { inMonth: false }));
  for (let i = 0; i < len; i++) out.push(day(addDays(startISO, i)));
  for (let i = 0; i < tail; i++) out.push(day(addDays(startISO, len + i), { inMonth: false }));
  return out;
}

const august = grid('2026-08-01', 31, 5, 6);
// Paint it the way a real month is painted: a logged period, a fertile window
// with an ovulation day in it, a phase band and a predicted next period.
for (const d of august) {
  if (!d.inMonth) continue;
  const n = Number(d.iso.slice(8));
  if (n <= 4) d.isPeriodDay = true;
  else if (n <= 11) d.phase = 'follicular';
  else if (n <= 16) d.fertile = n === 14 ? 'ovulation' : 'fertile';
  else if (n <= 29) d.phase = 'luteal';
  else d.isPredictedPeriod = true;
}

const ranges = groupDayRanges(august);
const inMonth = august.filter((d) => d.inMonth);

ok('the list is not empty', ranges.length > 0);
ok(
  'no run is empty',
  ranges.every((r) => r.days >= 1)
);
ok(
  'every run reports the length it actually covers',
  ranges.every((r) => {
    let n = 1;
    let cur = r.start;
    while (cur !== r.end) {
      cur = addDays(cur, 1);
      n++;
      if (n > 400) return false; // rule 3: bounded, strict forward progress
    }
    return n === r.days;
  })
);
ok(
  'the runs are in date order and never overlap',
  ranges.every((r, i) => i === 0 || (ranges[i - 1] as { end: string }).end < r.start)
);
ok(
  'consecutive runs are adjacent — no day falls between them',
  ranges.every((r, i) => i === 0 || addDays((ranges[i - 1] as { end: string }).end, 1) === r.start)
);
ok(
  'the runs start and end where the month does',
  ranges[0]?.start === inMonth[0]?.iso &&
    ranges[ranges.length - 1]?.end === inMonth[inMonth.length - 1]?.iso
);
ok(
  'the day counts add up to the month',
  ranges.reduce((sum, r) => sum + r.days, 0) === inMonth.length,
  `${ranges.reduce((sum, r) => sum + r.days, 0)} vs ${inMonth.length}`
);
ok(
  'no two neighbouring runs share a mark — they would have been one run',
  ranges.every((r, i) => i === 0 || (ranges[i - 1] as { mark: DayMark }).mark !== r.mark)
);
ok(
  'the leading and trailing weeks are not described as this month',
  !ranges.some((r) => r.start < '2026-08-01' || r.end > '2026-08-31')
);

// ─── R3 · THE ANTI-CONTRADICTION TEST ────────────────────────────────

section('R3 · the words match the colours, cell for cell');

/** Deterministic pseudo-random so a failure is reproducible. */
let seed = 20260825;
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

/** Expand a range back into the days it claims. */
function daysOf(range: { start: string; end: string }): string[] {
  const out = [range.start];
  let cur = range.start;
  let guard = 0;
  while (cur !== range.end) {
    cur = addDays(cur, 1);
    out.push(cur);
    if (++guard > 400) throw new Error('unbounded range');
  }
  return out;
}

let contradictions = 0;
let uncovered = 0;
let doubleCovered = 0;
let gridsChecked = 0;

for (let trial = 0; trial < 200; trial++) {
  const month = 1 + Math.floor(rnd() * 12);
  const start = `2026-${String(month).padStart(2, '0')}-01`;
  const len = 28 + Math.floor(rnd() * 4);
  const g = grid(start, len, Math.floor(rnd() * 7), Math.floor(rnd() * 7));
  for (const d of g) {
    if (!d.inMonth) continue;
    // Every combination is reachable here, including the contradictory ones
    // (logged AND predicted AND fertile) — those are exactly the days where
    // two renderers would disagree if they each decided for themselves.
    d.isPeriodDay = rnd() < 0.18;
    d.isPredictedPeriod = rnd() < 0.15;
    const f = rnd();
    d.fertile = f < 0.06 ? 'ovulation' : f < 0.26 ? 'fertile' : null;
    const p = rnd();
    d.beyondCycle = p > 0.9;
    d.phase = d.beyondCycle
      ? null
      : p < 0.25
        ? 'menstrual'
        : p < 0.5
          ? 'follicular'
          : p < 0.7
            ? 'ovulatory'
            : 'luteal';
  }

  const rs = groupDayRanges(g);
  const painted = new Map<string, DayMark>();
  for (const d of g) if (d.inMonth) painted.set(d.iso, dayMark(d));

  const described = new Map<string, DayMark>();
  for (const r of rs) {
    for (const iso of daysOf(r)) {
      if (described.has(iso)) doubleCovered++;
      described.set(iso, r.mark);
    }
  }

  for (const [iso, mark] of painted) {
    const said = described.get(iso);
    if (said === undefined) uncovered++;
    else if (said !== mark) contradictions++;
  }
  gridsChecked++;
}

ok(`${gridsChecked} random months were checked`, gridsChecked === 200);
ok(
  'THE CONDITION: the list never describes a day differently from the grid',
  contradictions === 0,
  `${contradictions} contradicting days`
);
ok('every painted day is described', uncovered === 0, `${uncovered} days missing from the list`);
ok('and no day is described twice', doubleCovered === 0, `${doubleCovered} duplicated days`);

// ─── R4 · the words ──────────────────────────────────────────────────

section('R4 · one label per mark, and the legend uses the same strings');

ok(
  'every mark has a label',
  ALL_MARKS.every((m) => (MARK_LABEL[m] ?? '').trim().length > 0)
);
ok(
  'no two marks share a label',
  new Set(ALL_MARKS.map((m) => MARK_LABEL[m])).size === ALL_MARKS.length
);
ok(
  'every mark has a detail line',
  ALL_MARKS.every((m) => markDetail(m).trim().length > 10)
);
ok('the fertile caveat is rule 15 verbatim', markDetail('fertile') === NOT_CONTRACEPTION);
ok('and the ovulation day carries it too', markDetail('ovulation') === NOT_CONTRACEPTION);
for (const phase of ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const) {
  ok(
    `the ${phase} detail is the app's own description, not a second one`,
    markDetail(phase).includes(getPhaseDescription(phase))
  );
}
ok(
  'no detail line diagnoses (rule 1)',
  !ALL_MARKS.some((m) => /\byour body (is|will|does)\b/i.test(markDetail(m))),
  ALL_MARKS.find((m) => /\byour body (is|will|does)\b/i.test(markDetail(m)))
);
ok(
  'the unknown row explains itself rather than showing a blank',
  markDetail('unknown').toLowerCase().includes('nothing is estimated')
);
ok(
  'every mark has something a screen reader can say',
  ALL_MARKS.every((m) => (MARK_SPOKEN[m] ?? '').trim().length > 0)
);
ok(
  'no two marks sound the same',
  new Set(ALL_MARKS.map((m) => MARK_SPOKEN[m])).size === ALL_MARKS.length
);
ok(
  'the spoken estimates say "estimated" — a fact and a guess must not sound alike',
  (['ovulation', 'fertile', 'menstrual'] as DayMark[]).every((m) =>
    MARK_SPOKEN[m].includes('estimated')
  ) && !MARK_SPOKEN.logged.includes('estimated')
);
ok('exactly one mark is a recorded fact', ALL_MARKS.filter(isRecorded).length === 1);
ok('and it is the logged one', isRecorded('logged'));

// The legend chips and the list are the two halves of the same toggle, so a
// mark called one thing in colours and another in words is the contradiction
// in its most embarrassing form.
const chipLabels = [...CALENDAR.matchAll(/<LegendChip[^>]*label="([^"]+)"/g)].map((m) => m[1]);
ok('the legend chips were found in the screen', chipLabels.length >= 6, `${chipLabels.length}`);
const labelValues = new Set(ALL_MARKS.map((m) => MARK_LABEL[m]));
for (const chip of chipLabels) {
  ok(`the legend chip "${chip}" is a mark label`, labelValues.has(chip as string));
}

// ─── R5 · the swatches ───────────────────────────────────────────────

section('R5 · the list is painted from the grid’s own colours');

const swatchBlock =
  /const MARK_SWATCH: Record<DayMark, string> = \{([\s\S]*?)\n\};/.exec(CALENDAR)?.[1] ?? '';
ok('MARK_SWATCH was found', swatchBlock.length > 0);
const swatchOf = (mark: DayMark): string =>
  new RegExp(`^\\s*${mark}: (.+),$`, 'm').exec(swatchBlock)?.[1] ?? '';

ok(
  'every mark has a swatch',
  ALL_MARKS.every((m) => swatchOf(m).length > 0),
  ALL_MARKS.find((m) => swatchOf(m).length === 0)
);
const EXPECTED_SWATCH: Record<DayMark, string> = {
  logged: 'LOGGED_PERIOD_CELL',
  predicted: 'PREDICTED_CELL',
  // The grid gives the ovulation day the FERTILE fill and a bright ring
  // (DT24). The swatch does the same — a key painted in a colour the map
  // never uses is a contradiction too, just a quieter one.
  ovulation: 'OVULATION_CELL',
  fertile: 'FERTILE_CELL',
  menstrual: 'PHASE_CELL.menstrual',
  follicular: 'PHASE_CELL.follicular',
  ovulatory: 'PHASE_CELL.ovulatory',
  luteal: 'PHASE_CELL.luteal',
  unknown: "'transparent'",
};
for (const mark of ALL_MARKS) {
  ok(
    `the ${mark} swatch is the grid's ${EXPECTED_SWATCH[mark]}`,
    swatchOf(mark) === EXPECTED_SWATCH[mark],
    swatchOf(mark)
  );
}
ok(
  'no swatch is a hardcoded hex — the tokens are the single source (rule 25)',
  !/#[0-9a-fA-F]{3,8}/.test(swatchBlock)
);
ok(
  'the ovulation row keeps its ring, the way the cell does',
  /MARK_RING[\s\S]{0,200}ovulation: OVULATION_MARK/.test(CALENDAR)
);

// ─── R6 · the screen cannot decide for itself ────────────────────────

section('R6 · the grid and the list share one decision');

ok('the day cell asks dayMark()', /const mark = dayMark\(cell\)/.test(CALENDAR));
ok('the list groups the same cells', /groupDayRanges\(monthGrid\)/.test(CALENDAR));
ok(
  'the cell paints by the mark, rather than re-testing the day',
  /mark === 'logged'/.test(CALENDAR) &&
    /mark === 'predicted'/.test(CALENDAR) &&
    /mark === 'ovulation'/.test(CALENDAR) &&
    /mark === 'fertile'/.test(CALENDAR)
);
// The old precedence chain, back in the styling branch, is how the two would
// drift apart again. It must not come back.
ok(
  'the paint branch no longer re-derives the precedence itself',
  !/else if \(cell\.isPredictedPeriod\)/.test(CALENDAR) &&
    !/else if \(cell\.fertile ===/.test(CALENDAR)
);
// One block, two readings. Rendering both would push the week-ahead strip
// down the column, which is the overlap the owner asked us to avoid.
ok(
  'the toggle SWAPS the legend for the list rather than stacking them',
  /\{datesView \? \(/.test(CALENDAR) && /\) : \(\n\s*<Animated\.View entering=\{rise\(118\)\} style=\{styles\.legend\}>/.test(CALENDAR)
);
ok(
  'the dates view is remembered between visits',
  /Storage\.calendarDatesView\.set\(/.test(CALENDAR)
);
// `getBoolean(...) === true` is how a missing key reads false — the words are
// the option, the grid is what you get without choosing anything.
ok(
  'and the visual calendar stays the default',
  /calendarDatesView: \{\s*\n\s*get: \(\): boolean => db\(\)\.getBoolean\(Keys\.CALENDAR_DATES_VIEW\) === true/.test(
    readFileSync(join(__dirname, '..', 'src', 'database', 'storage.ts'), 'utf8')
  )
);
ok(
  'a screen reader is told the same mark the grid painted',
  /const mark = dayMark\(cell\);\n\s*if \(mark !== 'unknown'\) parts\.push\(MARK_SPOKEN\[mark\]\);/.test(
    CALENDAR
  )
);
ok(
  'and every estimated row says it is an estimate',
  /RECORDED BY YOU[\s\S]{0,240}ESTIMATED/.test(CALENDAR)
);

console.log(
  failures === 0
    ? `\n\x1b[32m✓ ${checks} checks — the grid and the words cannot disagree.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
