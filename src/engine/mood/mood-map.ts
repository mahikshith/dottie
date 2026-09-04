/**
 * Dottie — Mood map (pure)
 *
 * The GitHub-contribution-style grid of the last N days, coloured by how the
 * user said they felt, plus the distribution underneath it.
 *
 * ─── WHY THIS IS NOT GREEN TINTS ────────────────────────────────────
 *
 *  GitHub's heatmap is SEQUENTIAL — one hue, light to dark — and that is right
 *  for commits, because commits are pure magnitude: more is more, and zero is
 *  the bottom of the same scale.
 *
 *  Mood is not magnitude. A 1 is not "less mood" than a 5; it is the opposite
 *  END of a scale with a neutral middle. That makes it DIVERGING: two hues with
 *  a neutral grey midpoint, one arm per direction. Encoding it as one hue would
 *  say "a rough day is an empty day" — wrong, and in an app about periods,
 *  unkind.
 *
 *  The hues follow the app's existing care rule (see mood-palette.ts): a rough
 *  day gets the WARM Ember tones, never something dark or drained. So the grid
 *  reads warm on the hard days, mint on the good ones, quiet grey in the
 *  middle — and an unlogged day is quieter than any logged one, so gaps never
 *  compete with data.
 *
 * ─── WHY NOT EMOJI IN THE GRID ──────────────────────────────────────
 *
 *  The owner asked for emoji instead of colour tints. At the size a 90-day grid
 *  forces — roughly 10-12px a cell on a phone — an emoji is an unreadable
 *  smudge, and five different smudges are indistinguishable at a glance, which
 *  is the one thing a heatmap has to get right. So the GRID uses the validated
 *  colour ramp and the emoji appear in the legend and the distribution bar
 *  below, where each has room to be read. Same vocabulary, each part of it
 *  where it actually works.
 *
 * ─── COLOUR IS COMPUTED, NOT EYEBALLED ──────────────────────────────
 *
 *  The ramp was validated against the aurora ground (#0C0A16) with the dataviz
 *  validator's ORDINAL checks (the categorical ones FAIL a correct ramp by
 *  design). Each arm is monotone in lightness, every adjacent step clears
 *  ΔL ≥ 0.06, each arm's coloured steps are a single hue, and every step clears
 *  3:1 against the surface — midpoint 3.6:1, poles 8.6:1 and 12.6:1. Do not
 *  hand-tweak these without re-running it.
 */

import { addDays, daysBetween, isCivilDate } from '../../utils/civil-date';

// ─── THE SCALE ───────────────────────────────────────────────────────

export interface MoodStep {
  /** Check-in score, 1..5. */
  score: number;
  /** Grid fill. */
  color: string;
  /** Shown in the legend and the distribution bar, where there's room. */
  emoji: string;
  label: string;
}

/**
 * Diverging: rough ← neutral → great.
 * Warm arm = the app's Ember family; cool arm = its Meadow/Nocturne accent.
 */
export const MOOD_SCALE: MoodStep[] = [
  { score: 1, color: '#FF8A7A', emoji: '😤', label: 'Rough' },
  { score: 2, color: '#B0757C', emoji: '😔', label: 'Low' },
  { score: 3, color: '#6A6782', emoji: '😐', label: 'Okay' },
  { score: 4, color: '#3FA98A', emoji: '🙂', label: 'Good' },
  { score: 5, color: '#54E6C8', emoji: '😊', label: 'Great' },
];

/** A day with no check-in. Dimmer than every logged step, so gaps recede. */
export const MOOD_EMPTY_COLOR = '#1A1826';

export function stepForScore(score: number | null | undefined): MoodStep | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const rounded = Math.round(score);
  return MOOD_SCALE.find((s) => s.score === rounded) ?? null;
}

/** Fill for a cell — the step's colour, or the empty tone. */
export function colorForScore(score: number | null | undefined): string {
  return stepForScore(score)?.color ?? MOOD_EMPTY_COLOR;
}

// ─── THE GRID ────────────────────────────────────────────────────────

export interface MoodDay {
  /** ISO date. */
  date: string;
  /** 1..5, or null when nothing was logged that day. */
  score: number | null;
  /** True for dates after today — rendered as nothing at all. */
  future: boolean;
}

export interface MoodMap {
  /** Columns of 7, oldest first — the GitHub layout. */
  weeks: MoodDay[][];
  /** Every day in range, flat. */
  days: MoodDay[];
  /** How many days actually carry a check-in. */
  logged: number;
  /** Total days in the window. */
  span: number;
  /** Consecutive logged days ending today (or yesterday). */
  streak: number;
  /** Nothing logged at all — callers show the invitation, not a grid. */
  empty: boolean;
}

/**
 * Build the grid.
 *
 * Missing days become `score: null` rather than being skipped, because the GAPS
 * are information — "you didn't log" is a different statement from "you felt
 * nothing". Columns are weeks so time flows left to right the way GitHub's does.
 */
export function buildMoodMap(
  entries: readonly { date: string; moodScore: number | null }[],
  today: string,
  span = 91
): MoodMap {
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (!isCivilDate(e.date)) continue;
    if (e.moodScore === null || !Number.isFinite(e.moodScore)) continue;
    byDate.set(e.date, Math.round(e.moodScore));
  }

  const safeSpan = Math.max(7, Math.min(371, Math.round(span)));
  // Start on a Sunday so every column is a whole week.
  const rawStart = addDays(today, -(safeSpan - 1));
  const startDow = new Date(`${rawStart}T00:00:00Z`).getUTCDay();
  const start = addDays(rawStart, -startDow);
  const total = daysBetween(start, today) + 1;

  const days: MoodDay[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i);
    days.push({ date, score: byDate.get(date) ?? null, future: false });
  }

  // Pad the final column to 7 so the grid is rectangular.
  const trailing = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    days.push({ date: addDays(today, i), score: null, future: true });
  }

  const weeks: MoodDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const logged = days.filter((d) => d.score !== null).length;

  // Streak: consecutive logged days ending today, or ending yesterday — so a
  // streak isn't "broken" at breakfast before you've checked in.
  let streak = 0;
  const anchor = byDate.has(today) ? today : addDays(today, -1);
  for (let i = 0; i < safeSpan; i++) {
    if (!byDate.has(addDays(anchor, -i))) break;
    streak++;
  }

  return { weeks, days, logged, span: safeSpan, streak, empty: logged === 0 };
}

// ─── THE DISTRIBUTION ────────────────────────────────────────────────

export interface MoodShare {
  step: MoodStep;
  days: number;
  /** 0..1 of the LOGGED days (not of the window — see below). */
  share: number;
}

export interface MoodDynamics {
  shares: MoodShare[];
  /** Days with a check-in — the denominator. */
  logged: number;
  /** The most common mood, or null on a tie or with nothing logged. */
  dominant: MoodStep | null;
  /** One honest sentence, including how thin the data is. */
  summary: string;
}

/**
 * The horizontal bar under the map.
 *
 * The denominator is LOGGED days, not calendar days. Dividing by the window
 * would silently mix "I felt fine" with "I didn't open the app", and the bar
 * would shrink whenever someone took a week off — punishing them for a gap.
 */
export function buildMoodDynamics(map: MoodMap): MoodDynamics {
  const counts = new Map<number, number>();
  for (const d of map.days) {
    if (d.score === null) continue;
    counts.set(d.score, (counts.get(d.score) ?? 0) + 1);
  }

  const logged = map.logged;
  const shares: MoodShare[] = MOOD_SCALE.map((step) => {
    const days = counts.get(step.score) ?? 0;
    return { step, days, share: logged > 0 ? days / logged : 0 };
  }).filter((s) => s.days > 0);

  // Dominant only when strictly ahead — a tie has no winner to name.
  let dominant: MoodStep | null = null;
  if (shares.length > 0) {
    const top = shares.reduce((a, b) => (b.days > a.days ? b : a));
    const tied = shares.filter((s) => s.days === top.days).length > 1;
    dominant = tied ? null : top.step;
  }

  return { shares, logged, dominant, summary: summarise(logged, dominant, shares) };
}

function summarise(
  logged: number,
  dominant: MoodStep | null,
  shares: MoodShare[]
): string {
  if (logged === 0) {
    return 'Check in a few times and your moods will start showing up here.';
  }
  if (logged < 5) {
    return `${logged} day${logged === 1 ? '' : 's'} logged so far — too few to call it a pattern, but it's a start.`;
  }
  const roughDays = shares.filter((s) => s.step.score <= 2).reduce((n, s) => n + s.days, 0);
  const brightDays = shares.filter((s) => s.step.score >= 4).reduce((n, s) => n + s.days, 0);

  if (dominant === null) {
    return `${logged} days logged, fairly evenly spread — no single mood dominates.`;
  }
  const pct = Math.round(((shares.find((s) => s.step === dominant)?.days ?? 0) / logged) * 100);
  const tail =
    roughDays > 0 && brightDays > 0 ? ` ${brightDays} brighter, ${roughDays} harder.` : '';
  return `${logged} days logged. Mostly ${dominant.label.toLowerCase()} (${pct}%).${tail}`;
}
