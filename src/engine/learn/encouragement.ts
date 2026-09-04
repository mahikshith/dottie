/**
 * Dottie — Encouragement nudges (pure)
 *
 * The line the companion says after a practice or quiz result. The owner's ask
 * (device-test-8): "add some encouragement nudges, like 'do try it again', and
 * if we have 10 or 12 nudges stored up, we can keep on rotating them."
 *
 * ─── WHY A POOL, AND WHY IT ROTATES ─────────────────────────────────
 *
 *  A single fixed line stops being read after the second time you see it — it
 *  becomes furniture. A pool that rotates keeps the companion feeling like it
 *  is actually talking to you. But rotation has to be DETERMINISTIC, not
 *  `Math.random()`: a re-render must not reshuffle the sentence under the
 *  user's eyes, and a test can't assert on a coin flip. So the caller passes a
 *  turn counter (attempts taken, lessons completed — anything that increments)
 *  and the same turn always yields the same line.
 *
 * ─── WHY THE BANDS DIFFER IN KIND, NOT JUST INTENSITY ───────────────
 *
 *  "Great job!" with the word swapped out is not encouragement. What someone
 *  needs after 1-of-3 is different in KIND from what they need after 3-of-3:
 *  the low band names the effort and points at the next concrete action, the
 *  high band gets out of the way. So the pools are written separately.
 *
 * ─── NON-DIAGNOSTIC / NON-SHAMING ───────────────────────────────────
 *
 *  No line blames the reader, calls a result bad, or implies they should
 *  already have known this. Asserted in scripts/encouragement-harness.ts.
 */

/** Which pool a result falls into. */
export type NudgeBand = 'perfect' | 'strong' | 'middling' | 'low';

export interface Nudge {
  /** The line itself. */
  text: string;
  /** True when it explicitly invites another attempt. */
  invitesRetry: boolean;
}

// ─── THE POOLS ───────────────────────────────────────────────────────

const PERFECT: Nudge[] = [
  { text: 'Every single one. You have properly got this.', invitesRetry: false },
  { text: 'Clean sweep — that is your body knowledge, not luck.', invitesRetry: false },
  { text: 'Full marks. Go be smug about it for a bit.', invitesRetry: false },
  { text: 'Nothing left to correct. Onwards.', invitesRetry: false },
  { text: 'That is the whole thing understood. Lovely.', invitesRetry: false },
];

const STRONG: Nudge[] = [
  { text: 'Nearly all of it — the shape of this has clicked.', invitesRetry: false },
  { text: 'Strong run. The one you missed is worth a second look.', invitesRetry: true },
  { text: 'That is solid understanding, not guesswork.', invitesRetry: false },
  { text: 'Most of the way there, and the rest will follow.', invitesRetry: false },
  { text: 'Good instincts on the hard ones.', invitesRetry: false },
];

const MIDDLING: Nudge[] = [
  { text: 'Half of it landed — that is a real start.', invitesRetry: false },
  { text: 'Some of these clicked. Another pass will catch the rest.', invitesRetry: true },
  { text: 'You are getting the gist. Worth running it again.', invitesRetry: true },
  { text: 'Partly there, which is exactly how learning looks.', invitesRetry: false },
  { text: 'The bits you got, you got properly. Keep going.', invitesRetry: false },
];

const LOW: Nudge[] = [
  { text: 'Tricky one. Give it another go — it lands faster the second time.', invitesRetry: true },
  { text: 'This is new. Nobody gets it first pass. Try again?', invitesRetry: true },
  { text: 'You showed up for it, which is the hard part. Round two?', invitesRetry: true },
  { text: 'Worth re-reading the lesson, then coming straight back.', invitesRetry: true },
  { text: 'Not clicked yet — that is information, not a verdict.', invitesRetry: false },
  { text: 'Have another run at it. This is exactly what practice is for.', invitesRetry: true },
  { text: 'Slow start, and slow starts are fine. Try it once more.', invitesRetry: true },
];

const POOLS: Record<NudgeBand, Nudge[]> = {
  perfect: PERFECT,
  strong: STRONG,
  middling: MIDDLING,
  low: LOW,
};

/** Total lines across every band — the owner asked for "10 or 12" at least. */
export const NUDGE_COUNT = PERFECT.length + STRONG.length + MIDDLING.length + LOW.length;

// ─── SELECTION ───────────────────────────────────────────────────────

/** Which band a 0..1 score falls into. */
export function bandForScore(score: number): NudgeBand {
  if (!Number.isFinite(score)) return 'middling';
  if (score >= 1) return 'perfect';
  if (score >= 0.8) return 'strong';
  if (score >= 0.5) return 'middling';
  return 'low';
}

/**
 * The nudge for a result.
 *
 * `turn` is any counter that increases as the user does more (attempts,
 * completions). The same turn always returns the same line, so a re-render
 * never swaps the sentence mid-read.
 */
export function nudgeForScore(score: number, turn: number): Nudge {
  const band = bandForScore(score);
  const pool = POOLS[band];
  const safeTurn = Number.isFinite(turn) ? Math.abs(Math.trunc(turn)) : 0;
  return pool[safeTurn % pool.length]!;
}

/** Every line, for tests and for a copy review. */
export function allNudges(): Nudge[] {
  return [...PERFECT, ...STRONG, ...MIDDLING, ...LOW];
}
