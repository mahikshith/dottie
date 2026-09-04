/**
 * Dottie — Liquid Reveal Harness
 *
 * Geometry invariants for the mood wash (`src/theme/liquid-reveal.ts`).
 *
 * ─── WHY THIS IS TESTED AND NOT JUST EYEBALLED ──────────────────────
 *
 *  The reveal grows to cover the screen, and the palette underneath is swapped
 *  on the frame it reaches full extent. So the shape has exactly one way to be
 *  wrong: if it does not cover every corner at t=1, the user sees a flash of the
 *  OLD palette in the gap at the precise moment the new one commits.
 *
 *  That is invisible in code review, easy to miss on a phone (it is one frame,
 *  in a corner, during a colour change), and it depends on the interaction
 *  between the wobble amplitude and the overshoot margin — two constants a
 *  future tweak could easily put out of balance. So coverage is asserted
 *  directly, from the worst-case origin, at every angle.
 *
 * Run: npm run test:liquid
 */

import {
  buildBlobPath,
  radiusAtAngle,
  radiusAt,
  wobbleAt,
  maxRadiusFrom,
  BLOB_POINTS,
} from '../src/theme/liquid-reveal';

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

// A phone-shaped screen, and the origins that stress it. A tap in a corner is
// the worst case: the farthest corner is a full diagonal away.
const W = 412;
const H = 915;
const ORIGINS: [string, number, number][] = [
  ['centre', W / 2, H / 2],
  ['top-left corner', 0, 0],
  ['bottom-right corner', W, H],
  ['mood row (bottom centre)', W / 2, H - 120],
  ['off-screen (defensive)', -30, H + 40],
];

// ─── L1 — the coverage guarantee ─────────────────────────────────────

scenario('L1 · at full extent the wash covers every corner, from any origin', () => {
  for (const [name, ox, oy] of ORIGINS) {
    const maxR = maxRadiusFrom(ox, oy, W, H);
    const corners: [number, number][] = [[0, 0], [W, 0], [0, H], [W, H]];
    let worst = Infinity;
    for (const [cx, cy] of corners) {
      const dist = Math.hypot(cx - ox, cy - oy);
      const angle = Math.atan2(cy - oy, cx - ox);
      const reach = radiusAtAngle(angle, 1, maxR);
      worst = Math.min(worst, reach - dist);
    }
    ok(`${name}: reaches past the farthest corner`, worst >= 0, `short by ${(-worst).toFixed(2)}px`);
  }
});

scenario('L2 · coverage holds at EVERY angle, not just the four corners', () => {
  // A rectangle's boundary between corners is closer than the corners, so this
  // is really a belt-and-braces check that the shape is convex enough.
  const [, ox, oy] = ORIGINS[1]!; // worst case: tapped in a corner
  const maxR = maxRadiusFrom(ox, oy, W, H);
  let minSlack = Infinity;
  for (let i = 0; i < 720; i++) {
    const angle = (i / 720) * Math.PI * 2;
    const r = radiusAtAngle(angle, 1, maxR);
    minSlack = Math.min(minSlack, r - maxR);
  }
  ok('never shorter than the required radius', minSlack >= 0, `${minSlack.toFixed(3)}px`);
});

// ─── L3 — the wobble is what makes it liquid, and it must settle ─────

scenario('L3 · the edge undulates in flight and settles smooth', () => {
  ok('no wobble at rest (t=0)', wobbleAt(0) === 0, String(wobbleAt(0)));
  ok('no wobble at full extent (t=1)', Math.abs(wobbleAt(1)) < 1e-9, String(wobbleAt(1)));
  ok('there IS wobble in flight', wobbleAt(0.35) > 0.05, String(wobbleAt(0.35)));
  ok('the peak is biased early (feels like it is thrown outward)',
    wobbleAt(0.3) > wobbleAt(0.7), `${wobbleAt(0.3).toFixed(3)} vs ${wobbleAt(0.7).toFixed(3)}`);
  ok('wobble never exceeds its ceiling',
    Array.from({ length: 101 }, (_, i) => wobbleAt(i / 100)).every((w) => w <= 0.14));

  // At t=1 the shape must be a TRUE circle — that is what the coverage proof
  // in L1/L2 rests on.
  const rs = Array.from({ length: 60 }, (_, i) => radiusAtAngle((i / 60) * Math.PI * 2, 1, 500));
  const spread = Math.max(...rs) - Math.min(...rs);
  ok('final shape is a circle, not a blob', spread < 1e-6, `spread ${spread}`);

  // Mid-flight it must NOT be a circle, or there is no liquid at all.
  const mid = Array.from({ length: 60 }, (_, i) => radiusAtAngle((i / 60) * Math.PI * 2, 0.4, 500));
  ok('mid-flight it is visibly not a circle',
    Math.max(...mid) - Math.min(...mid) > 20,
    `spread ${(Math.max(...mid) - Math.min(...mid)).toFixed(1)}px`);
});

scenario('L4 · the wash only ever grows', () => {
  let prev = -1;
  let monotonic = true;
  for (let i = 0; i <= 100; i++) {
    const r = radiusAt(i / 100, 500);
    if (r < prev - 1e-9) monotonic = false;
    prev = r;
  }
  ok('base radius never shrinks', monotonic);
  ok('starts from nothing', radiusAt(0, 500) === 0);
  ok('ends past the required radius', radiusAt(1, 500) > 500);
  ok('out-of-range progress is clamped, not extrapolated',
    radiusAt(1.5, 500) === radiusAt(1, 500) && radiusAt(-2, 500) === 0);
});

// ─── L5 — the path string itself ─────────────────────────────────────

scenario('L5 · the path is well-formed SVG', () => {
  const d = buildBlobPath(200, 400, 0.5, 600);
  ok('starts with a moveto', d.startsWith('M'), d.slice(0, 12));
  ok('is a closed shape', d.endsWith('Z'));
  ok('one quadratic per sampled point',
    (d.match(/Q/g) ?? []).length === BLOB_POINTS,
    String((d.match(/Q/g) ?? []).length));
  ok('contains no NaN or Infinity', !/NaN|Infinity/.test(d));
  ok('every number is finite',
    d.replace(/[MQZ]/g, ' ').split(/[\s,]+/).filter(Boolean).every((n) => Number.isFinite(Number(n))));
});

scenario('L6 · degenerate inputs produce nothing, not garbage', () => {
  ok('t=0 draws nothing', buildBlobPath(100, 100, 0, 500) === '');
  ok('negative t draws nothing', buildBlobPath(100, 100, -1, 500) === '');
  ok('zero radius draws nothing', buildBlobPath(100, 100, 0.5, 0) === '');
  const few = buildBlobPath(100, 100, 0.5, 500, 2);
  ok('too few points is floored to a drawable shape',
    (few.match(/Q/g) ?? []).length === 3, String((few.match(/Q/g) ?? []).length));
});

// ─── L7 — it has to be cheap enough to run every frame ───────────────

scenario('L7 · rebuilding the path every frame is affordable', () => {
  const started = Date.now();
  const FRAMES = 2000; // ~33s of animation at 60fps
  for (let i = 0; i < FRAMES; i++) buildBlobPath(206, 800, (i % 60) / 60, 940);
  const perFrame = (Date.now() - started) / FRAMES;
  ok(`${perFrame.toFixed(3)}ms per frame — well inside a 16ms budget`, perFrame < 1,
    `${perFrame.toFixed(3)}ms`);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Liquid reveal harness — geometry holds.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
