/**
 * Dottie — Fertile Window Harness
 *
 * Invariants for src/engine/calendar/fertile-window.ts.
 *
 * Three classes of mistake are worth a machine check rather than a review pass.
 *
 *  1. SHAPE. The window is asymmetric — 5 days before ovulation, ovulation, and
 *     one day after — because sperm survive days and an egg survives about one.
 *     A symmetric band is the common implementation error and it is wrong on
 *     precisely the side that matters.
 *  2. HONESTY. Confidence must stay low when there is barely any history, and
 *     the safety wording must be the single shared constant so it can never be
 *     paraphrased away on one screen. The calendar screen is grepped for it.
 *  3. DETERMINISM. The owner asked for information that is "consistent,
 *     deterministic, rather than making any assumptions" — so the same inputs
 *     must produce a byte-identical window every time, with no dependence on
 *     the current date or the machine's timezone.
 *
 * Run: npm run test:fertile
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFertileWindow,
  fertileKindFor,
  NOT_CONTRACEPTION,
  LUTEAL_DAYS,
} from '../src/engine/calendar/fertile-window';
import { addDays, daysBetween } from '../src/utils/civil-date';

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

const STEADY = [28, 28, 29, 28, 27, 28];
const WOBBLY = [24, 33, 27, 35, 22, 31];

// ─── F1 — the window's shape ─────────────────────────────────────────

scenario('F1 · the window is asymmetric around ovulation, not a symmetric band', () => {
  const w = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY });
  ok('ovulation is the period minus the luteal phase', w.ovulation === addDays('2026-10-01', -LUTEAL_DAYS), String(w.ovulation));
  ok('opens 5 days before ovulation', w.start === addDays(w.ovulation!, -5), String(w.start));
  ok('closes 1 day after ovulation', w.end === addDays(w.ovulation!, 1), String(w.end));
  ok('spans 7 days inclusive', w.days.size === 7, String(w.days.size));
  ok('the lead side is longer than the trail side', daysBetween(w.start!, w.ovulation!) > daysBetween(w.ovulation!, w.end!));
});

scenario('F2 · every day in the span is classified, and exactly one is ovulation', () => {
  const w = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY });
  const kinds = [...w.days.values()];
  ok('exactly one ovulation day', kinds.filter((k) => k === 'ovulation').length === 1);
  ok('the rest are fertile', kinds.filter((k) => k === 'fertile').length === 6);
  for (let i = 0; i <= daysBetween(w.start!, w.end!); i++) {
    const iso = addDays(w.start!, i);
    if (!w.days.has(iso)) ok(`no gap at ${iso}`, false);
  }
  ok('no gaps across the span', true);
  ok('a day outside the span is unmarked', fertileKindFor(w, addDays(w.end!, 1)) === null);
  ok('the day before the window is unmarked', fertileKindFor(w, addDays(w.start!, -1)) === null);
});

// ─── F3 — nothing to go on ───────────────────────────────────────────

scenario('F3 · with no prediction it renders nothing rather than guessing', () => {
  const none = buildFertileWindow({ predictedNextPeriod: null, cycleLengths: [] });
  ok('no ovulation day', none.ovulation === null);
  ok('no days', none.days.size === 0);
  ok('no summary to display', none.summary === '');
  const junk = buildFertileWindow({ predictedNextPeriod: '01-10-2026', cycleLengths: STEADY });
  ok('a malformed date is refused, not parsed', junk.ovulation === null);
  const empty = buildFertileWindow({ predictedNextPeriod: '', cycleLengths: STEADY });
  ok('an empty string is refused', empty.ovulation === null);
});

// ─── F4 — confidence stays honest ────────────────────────────────────

scenario('F4 · confidence tracks history depth and variability', () => {
  const zero = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: [] });
  const one = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: [28] });
  const steady = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY });
  const wobbly = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: WOBBLY });

  ok('no history is barely-a-guess', zero.confidence <= 0.2, String(zero.confidence));
  ok('one cycle is still low', one.confidence <= 0.35, String(one.confidence));
  ok('six steady cycles earn real confidence', steady.confidence >= 0.7, String(steady.confidence));
  ok('the same count of wobbly cycles earns less', wobbly.confidence < steady.confidence, `${wobbly.confidence} vs ${steady.confidence}`);
  ok('never reaches certainty', steady.confidence <= 0.85);
  ok('never reaches zero either', zero.confidence > 0);

  ok('garbage cycle lengths are discarded, not averaged', (() => {
    const dirty = buildFertileWindow({
      predictedNextPeriod: '2026-10-01',
      cycleLengths: [28, NaN, 0, 900, -5, 28, 28, 28, 28, 28],
    });
    return dirty.confidence >= 0.7;
  })());
});

scenario('F5 · the summary always names what it is based on', () => {
  const steady = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY });
  ok('names the cycle count', steady.summary.includes('6 logged cycles'), steady.summary);
  const one = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: [28] });
  ok('singular reads correctly', one.summary.includes('1 logged cycle') && !one.summary.includes('1 logged cycles'), one.summary);
  const zero = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: [] });
  ok('with no cycles it says it used a typical luteal phase', zero.summary.includes('typical luteal phase'), zero.summary);
  ok('a low-confidence summary invites more logging', zero.summary.includes('loose estimate'), zero.summary);
  ok('basis can never be mistaken for a measurement', steady.basis === 'cycle-length-estimate');
});

// ─── F6 — determinism ────────────────────────────────────────────────

scenario('F6 · deterministic: same inputs, same window, no "today" in it', () => {
  const a = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY });
  const b = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: [...STEADY] });
  ok('ovulation identical', a.ovulation === b.ovulation);
  ok('confidence identical', a.confidence === b.confidence);
  ok('summary identical', a.summary === b.summary);
  ok('day maps identical', JSON.stringify([...a.days]) === JSON.stringify([...b.days]));

  // Across a year of anchors the offsets never drift — no DST, no month-length
  // special cases. This is what `civil-date` buys us and it must stay bought.
  let drift = 0;
  for (let i = 0; i < 365; i++) {
    const anchor = addDays('2026-01-01', i);
    const w = buildFertileWindow({ predictedNextPeriod: anchor, cycleLengths: STEADY });
    if (daysBetween(w.start!, w.end!) !== 6) drift++;
    if (daysBetween(w.ovulation!, anchor) !== LUTEAL_DAYS) drift++;
  }
  ok('365 consecutive anchors all produce the same offsets', drift === 0, `${drift} drifted`);
});

scenario('F7 · the luteal override is clamped to a plausible range', () => {
  const tiny = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY, lutealDays: 1 });
  ok('an absurdly short luteal is clamped up', daysBetween(tiny.ovulation!, '2026-10-01') >= 10);
  const huge = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY, lutealDays: 400 });
  ok('an absurdly long one is clamped down', daysBetween(huge.ovulation!, '2026-10-01') <= 16);
  const nan = buildFertileWindow({ predictedNextPeriod: '2026-10-01', cycleLengths: STEADY, lutealDays: NaN });
  ok('NaN does not produce an invalid date', nan.ovulation !== null && !nan.ovulation.includes('NaN'), String(nan.ovulation));
});

// ─── F8 — the safety wording reaches the screen ──────────────────────

scenario('F8 · the not-contraception wording exists once and is actually rendered', () => {
  ok('the constant says it is not contraception', NOT_CONTRACEPTION.toLowerCase().includes('not a contraceptive method'));
  ok('and not a fertility test', NOT_CONTRACEPTION.toLowerCase().includes('not a fertility test'));
  ok('and it is non-diagnostic — it makes no claim about the user\'s body', !/your body|you will|you are ovulating/i.test(NOT_CONTRACEPTION));

  const calendar = readFileSync(join(process.cwd(), 'app/(tabs)/calendar.tsx'), 'utf8');
  ok('the calendar imports the shared constant', calendar.includes('NOT_CONTRACEPTION'), 'not found in calendar.tsx');
  ok('the calendar draws the window', calendar.includes('buildFertileWindow'), 'not found in calendar.tsx');
  ok('nobody re-typed the sentence instead of importing it', (calendar.match(/not a contraceptive method/g) ?? []).length === 0);
});

console.log(
  failures === 0
    ? '\n\x1b[32m✓ fertile window: all invariants hold\x1b[0m\n'
    : `\n\x1b[31m✗ ${failures} failure(s)\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
