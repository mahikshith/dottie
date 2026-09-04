/**
 * Dottie — Mood Map Harness
 *
 * Invariants for the mood heatmap and its distribution bar
 * (src/engine/mood/mood-map.ts).
 *
 * Two things here are worth asserting rather than eyeballing. The GRID has to
 * distinguish "you felt neutral" from "you didn't log" — collapsing those is
 * the classic heatmap bug and it silently turns absence into data. And the
 * DISTRIBUTION divides by logged days, not calendar days; getting that wrong
 * makes the bar shrink whenever someone takes a week off, which reads as being
 * told off for a gap.
 *
 * Run: npm run test:moodmap
 */

import {
  buildMoodMap,
  buildMoodDynamics,
  colorForScore,
  stepForScore,
  MOOD_SCALE,
  MOOD_EMPTY_COLOR,
} from '../src/engine/mood/mood-map';
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

const TODAY = '2026-09-04';
const entry = (offset: number, moodScore: number | null) => ({
  date: addDays(TODAY, offset),
  moodScore,
});

// ─── M1 — empty ──────────────────────────────────────────────────────

scenario('M1 · a brand-new user gets an honest empty state, not a fake grid', () => {
  const map = buildMoodMap([], TODAY, 91);
  ok('flagged empty', map.empty);
  ok('no logged days', map.logged === 0);
  ok('the grid still has shape to render', map.weeks.length > 0);
  ok('every cell is the empty tone',
    map.days.every((d) => colorForScore(d.score) === MOOD_EMPTY_COLOR));
  const dyn = buildMoodDynamics(map);
  ok('no shares invented', dyn.shares.length === 0);
  ok('no dominant mood claimed', dyn.dominant === null);
  ok('the copy invites rather than reports', /check in/i.test(dyn.summary), dyn.summary);
});

// ─── M2 — gaps are not zeros ─────────────────────────────────────────

scenario('M2 · "did not log" is never confused with "felt neutral"', () => {
  const map = buildMoodMap([entry(-1, 3)], TODAY, 28);
  const logged = map.days.filter((d) => d.score !== null);
  ok('exactly one logged day', logged.length === 1, String(logged.length));
  ok('the rest are null, not 0 or 3', map.days.every((d) => d.score === null || d.score === 3));
  ok('an unlogged day is NOT painted as neutral',
    colorForScore(null) !== colorForScore(3),
    `${colorForScore(null)} vs ${colorForScore(3)}`);
  ok('the empty tone is dimmer than every logged step',
    MOOD_SCALE.every((s) => s.color !== MOOD_EMPTY_COLOR));
});

// ─── M3 — grid shape ─────────────────────────────────────────────────

scenario('M3 · the grid is rectangular and time flows left to right', () => {
  const map = buildMoodMap([], TODAY, 91);
  ok('every column is a full week', map.weeks.every((w) => w.length === 7));
  ok('days divide evenly into weeks', map.days.length % 7 === 0);
  const flat = map.weeks.flat();
  ok('columns preserve chronological order',
    flat.every((d, i) => i === 0 || d.date > flat[i - 1]!.date));
  ok('the window covers at least the requested span',
    map.days.filter((d) => !d.future).length >= 91, String(map.days.length));
  ok('today is present and not marked future',
    map.days.some((d) => d.date === TODAY && !d.future));
  ok('padding past today is marked future',
    map.days.filter((d) => d.date > TODAY).every((d) => d.future));
});

// ─── M4 — distribution maths ─────────────────────────────────────────

scenario('M4 · shares are of LOGGED days, not calendar days', () => {
  // 4 logged days in a 91-day window: 3 great, 1 rough.
  const map = buildMoodMap(
    [entry(-1, 5), entry(-2, 5), entry(-3, 5), entry(-4, 1)],
    TODAY,
    91
  );
  const dyn = buildMoodDynamics(map);
  ok('denominator is the 4 logged days', dyn.logged === 4, String(dyn.logged));
  const great = dyn.shares.find((s) => s.step.score === 5)!;
  ok('3 of 4 great = 0.75', Math.abs(great.share - 0.75) < 1e-9, String(great.share));
  ok('shares sum to 1', Math.abs(dyn.shares.reduce((n, s) => n + s.share, 0) - 1) < 1e-9);
  ok('only moods that occurred appear', dyn.shares.length === 2, String(dyn.shares.length));
  ok('taking a week off does not shrink the bar',
    dyn.shares.reduce((n, s) => n + s.share, 0) === 1);
});

scenario('M5 · a tie names no winner', () => {
  const map = buildMoodMap([entry(-1, 5), entry(-2, 1)], TODAY, 30);
  const dyn = buildMoodDynamics(map);
  ok('no dominant mood on a 1-1 tie', dyn.dominant === null);
  const map2 = buildMoodMap([entry(-1, 5), entry(-2, 5), entry(-3, 1)], TODAY, 30);
  ok('a clear majority IS named', buildMoodDynamics(map2).dominant?.score === 5);
});

// ─── M6 — honest copy ────────────────────────────────────────────────

scenario('M6 · thin data says so instead of claiming a pattern', () => {
  const thin = buildMoodDynamics(buildMoodMap([entry(-1, 5), entry(-2, 4)], TODAY, 91));
  ok('names the sample size', /2 days/.test(thin.summary), thin.summary);
  ok('explicitly declines to call it a pattern',
    /too few|a start/i.test(thin.summary), thin.summary);

  const rich = buildMoodDynamics(
    buildMoodMap(
      Array.from({ length: 20 }, (_, i) => entry(-(i + 1), i < 14 ? 4 : 2)),
      TODAY,
      91
    )
  );
  ok('richer data reports a percentage', /%/.test(rich.summary), rich.summary);
  ok('and still states the sample size', /20 days/.test(rich.summary), rich.summary);

  const banned = /abnormal|unhealthy|you should|disorder|concerning/i;
  ok('no diagnostic or judging language', !banned.test(rich.summary) && !banned.test(thin.summary));
});

// ─── M7 — streak ─────────────────────────────────────────────────────

scenario('M7 · the streak is forgiving about today', () => {
  const today3 = buildMoodMap([entry(0, 4), entry(-1, 4), entry(-2, 4)], TODAY, 30);
  ok('3 consecutive days including today', today3.streak === 3, String(today3.streak));

  // Hasn't checked in yet this morning — yesterday's streak should survive.
  const upTo = buildMoodMap([entry(-1, 4), entry(-2, 4)], TODAY, 30);
  ok('a streak ending yesterday still counts', upTo.streak === 2, String(upTo.streak));

  const broken = buildMoodMap([entry(-1, 4), entry(-3, 4)], TODAY, 30);
  ok('a gap breaks it', broken.streak === 1, String(broken.streak));
  ok('no logs, no streak', buildMoodMap([], TODAY, 30).streak === 0);
});

// ─── M8 — defensive ──────────────────────────────────────────────────

scenario('M8 · junk in the check-in table cannot break the grid', () => {
  const map = buildMoodMap(
    [
      { date: 'not-a-date', moodScore: 5 },
      { date: '', moodScore: 3 },
      { date: addDays(TODAY, -2), moodScore: null },
      { date: addDays(TODAY, -3), moodScore: Number.NaN },
      entry(-4, 4),
    ],
    TODAY,
    30
  );
  ok('only the one usable entry counts', map.logged === 1, String(map.logged));
  ok('no crash building dynamics', buildMoodDynamics(map).logged === 1);
  ok('an unknown score has no step', stepForScore(9) === null);
  ok('a null score has no step', stepForScore(null) === null);
  ok('absurd spans are clamped', buildMoodMap([], TODAY, 99999).span <= 371);
  ok('tiny spans are floored', buildMoodMap([], TODAY, 1).span >= 7);
});

// ─── M9 — the scale itself ───────────────────────────────────────────

scenario('M9 · the scale is diverging, and every score is covered', () => {
  ok('all five check-in scores map to a step',
    [1, 2, 3, 4, 5].every((s) => stepForScore(s) !== null));
  ok('every step has a distinct colour',
    new Set(MOOD_SCALE.map((s) => s.color)).size === MOOD_SCALE.length);
  ok('every step has an emoji for the legend',
    MOOD_SCALE.every((s) => s.emoji.length > 0));
  // The care rule: a rough day must not be the dimmest thing on screen.
  ok('rough is not the empty tone', stepForScore(1)!.color !== MOOD_EMPTY_COLOR);
  ok('the poles differ from the midpoint',
    stepForScore(1)!.color !== stepForScore(3)!.color &&
      stepForScore(5)!.color !== stepForScore(3)!.color);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Mood map harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
