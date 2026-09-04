/**
 * Dottie — liquid reveal geometry (pure)
 *
 * The shape of the mood wash that spreads from the mood button you tapped.
 *
 * ─── WHY A BLOB AND NOT A CIRCLE ────────────────────────────────────
 *
 *  The reveal used to be a `View` with a `borderRadius`, scaled up. A perfect
 *  circle growing at a constant rate reads as a mechanical wipe — a progress
 *  indicator, not a liquid. Real spreading fluid has an edge that is never
 *  quite round: surface tension pulls it back unevenly while momentum pushes it
 *  out, so the boundary undulates while it travels and settles smooth once it
 *  stops.
 *
 *  So the radius here varies with ANGLE, by a couple of harmonics that drift as
 *  the wash travels. Two frequencies, not one: a single sine reads as an
 *  obvious wobble, two incommensurate ones read as organic.
 *
 * ─── WHY THIS CAN BE A PATH, WHEN THE TAB TRANSITION COULD NOT ──────
 *
 *  device-test-11 rejected the SVG `clip-path` liquid-swipe for tab switches,
 *  because there it would have to clip a LIVE, INTERACTIVE screen — which in
 *  React Native means snapshotting a view tree every frame.
 *
 *  This is the opposite case, and that is the whole reason it works: the mood
 *  reveal is an opaque overlay filled with a colour. There is nothing live
 *  inside it and it is already `pointerEvents="none"`. Drawing a filled shape
 *  is precisely what SVG is for, so the same idea that was wrong for tabs is
 *  right here — no snapshot, no lost interactivity, just a `<Path>` whose `d`
 *  is recomputed on the UI thread.
 *
 * ─── WORKLET SAFETY ─────────────────────────────────────────────────
 *
 *  Every exported function is marked `'worklet'` because `useAnimatedProps`
 *  calls them on the UI runtime. Without the directive they throw on device
 *  while working fine in the debugger.
 *
 *  They are also pure and dependency-free, so the geometry is testable in Node
 *  (`npm run test:liquid`) — which matters more than it looks: the one bug this
 *  shape can have is failing to cover a screen corner at full extent, and that
 *  would show as a flash of the OLD palette at the exact moment the new one
 *  commits. That is invisible in review and obvious on a phone.
 */

/** How many points the blob outline is sampled at. */
export const BLOB_POINTS = 14;

/**
 * Peak wobble, as a fraction of the radius.
 *
 * 0.13 is a deliberate ceiling: enough that the edge visibly breathes, small
 * enough that the shape never stops reading as "a wash spreading out".
 */
const WOBBLE = 0.13;

/**
 * Safety margin on the final radius.
 *
 * At t=1 the wash must cover every pixel, because the palette underneath swaps
 * on that frame. 2% costs nothing and removes any chance of a corner leaking.
 */
const OVERSHOOT = 1.02;

/**
 * How strongly the edge undulates at progress `t` (0..1).
 *
 * Rises quickly, peaks around a third of the way out, then returns to ZERO by
 * the end. The settle to zero is not decoration — it is what guarantees the
 * final shape is a true circle of radius `maxR * OVERSHOOT`, and therefore that
 * the coverage guarantee above holds.
 */
export function wobbleAt(t: number): number {
  'worklet';
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  // sin(pi * k^0.6): 0 at both ends, peak biased early.
  return WOBBLE * Math.sin(Math.PI * Math.pow(k, 0.6));
}

/** Radius of the wash at progress `t`, before any angular variation. */
export function radiusAt(t: number, maxR: number): number {
  'worklet';
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return maxR * OVERSHOOT * k;
}

/**
 * Radius at a given angle — the base radius modulated by two drifting
 * harmonics. `phase` advances with `t` so the surface moves as it travels
 * rather than expanding as a frozen shape.
 */
export function radiusAtAngle(angle: number, t: number, maxR: number): number {
  'worklet';
  const base = radiusAt(t, maxR);
  const w = wobbleAt(t);
  if (w === 0) return base;
  const phase = t * Math.PI * 1.6;
  const undulation =
    0.62 * Math.sin(3 * angle + phase) + 0.38 * Math.sin(5 * angle - phase * 1.7);
  return base * (1 + w * undulation);
}

/**
 * The blob as an SVG path string.
 *
 * Points are joined with quadratic segments through their midpoints — the
 * standard way to draw a smooth closed curve through sampled points. It needs
 * no tangent bookkeeping, so it is cheap enough to rebuild every frame on the
 * UI thread, and it is C1-continuous, so the outline has no visible corners.
 */
export function buildBlobPath(
  cx: number,
  cy: number,
  t: number,
  maxR: number,
  points: number = BLOB_POINTS
): string {
  'worklet';
  if (t <= 0 || maxR <= 0) return '';

  const n = points < 3 ? 3 : points;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radiusAtAngle(a, t, maxR);
    xs.push(cx + Math.cos(a) * r);
    ys.push(cy + Math.sin(a) * r);
  }

  const mx = (i: number, j: number): number => (xs[i]! + xs[j]!) / 2;
  const my = (i: number, j: number): number => (ys[i]! + ys[j]!) / 2;

  // Start at the midpoint of the last→first edge so the curve closes cleanly.
  let d = `M${mx(n - 1, 0).toFixed(1)},${my(n - 1, 0).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    d += `Q${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)} ${mx(i, next).toFixed(1)},${my(i, next).toFixed(1)}`;
  }
  return `${d}Z`;
}

/**
 * Distance from `origin` to the farthest corner of a `width`×`height` screen —
 * the radius the wash has to reach to cover everything.
 */
export function maxRadiusFrom(x: number, y: number, width: number, height: number): number {
  'worklet';
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}
