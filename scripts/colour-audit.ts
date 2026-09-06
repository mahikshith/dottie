/**
 * Dottie — colour audit (device-test-22)
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, DT21: "the follicular green collides with the mood green."
 *  Owner, DT22: "some of the colours STILL coincide with the phase or cycle
 *  colour… find out all the colour combinations you have for all the moods
 *  and make a judgement about contrasting colours."
 *
 *  DT21 fixed the one collision that was pointed at, by eye. That was the
 *  mistake: there were four. Measured in CIELAB, THREE of the four phase
 *  colours were byte-identical to a colour in a mood palette —
 *
 *      menstrual  #FF6FA5 = ember.accent2 (also three palettes' bloom)
 *      ovulatory  #FFC24D = radiance.accent
 *      luteal     #9B7BFF = nocturne.accent2
 *
 *  — so whichever mood the app was wearing, one phase was painted in the
 *  background's own colour. Eyeballing one pair at a time could never have
 *  found that; comparing every pair takes a script.
 *
 * ─── THE TWO RULES ──────────────────────────────────────────────────
 *
 *  1. Every phase colour is ≥ MIN_MOOD_DISTANCE from EVERY colour in EVERY
 *     mood palette (accent, accent2, all four bloom hues) and from every step
 *     of the mood-map scale.
 *  2. Any two phase colours are ≥ MIN_PHASE_DISTANCE apart. They sit next to
 *     each other in the calendar legend, so this one matters most.
 *
 *  ΔE is CIE76 in CIELAB. It is not the last word in perceptual accuracy, but
 *  it is honest about the thing that was actually wrong here — two swatches
 *  being the same paint — and it needs no dependency.
 *
 *  The thresholds are set just under what the current set achieves (19.8 and
 *  93.3). The mood system occupies most of the wheel, so ~20 is the realistic
 *  ceiling for the mood rule without resorting to neon; identity is never
 *  colour-alone anyway (the legend carries a shape per mark).
 *
 * ─── AND WHAT THE SCREEN ACTUALLY DREW (device-test-23) ─────────────
 *
 *  The audit above passed while the calendar still looked wrong, because the
 *  calendar never drew these colours: it drew them at 14% alpha over a moving
 *  aurora bloom. A token can be measurably distinct and still arrive on the
 *  screen as 86% background. Owner: "those colours were not bright enough…
 *  they couldn't tell the difference between the aurora colour and the phase
 *  colour."
 *
 *  So the second half of this audit measures the OPAQUE composites the grid
 *  actually paints (`theme/blend.ts`) — against each other, and for whether
 *  the number written on the day can be read at all.
 *
 *      npm run audit:colour
 */

import { PHASE_AURORA, AURORA_PALETTES } from '../src/theme/palettes';
import {
  PHASE_CELL,
  FERTILE_CELL,
  OVULATION_CELL,
  OVULATION_MARK,
  LOGGED_PERIOD_CELL,
  PREDICTED_CELL,
  contrastRatio,
  inkOn,
} from '../src/theme/blend';
import { MOOD_SCALE } from '../src/engine/mood/mood-map';

const MIN_MOOD_DISTANCE = 18;
const MIN_PHASE_DISTANCE = 40;
/**
 * How far apart two marks must be AS DRAWN. Lower than the token floor
 * because compositing over the ground pulls everything toward the ground —
 * that is the point of measuring it separately.
 */
const MIN_RENDERED_DISTANCE = 22;
/**
 * A day cell has a number on it. 4.5:1 is WCAG AA for body text; these are
 * bold 15pt, so 4.5 is comfortably conservative.
 */
const MIN_INK_CONTRAST = 4.5;

// ─── CIELAB ──────────────────────────────────────────────────────────

type Lab = [number, number, number];

function toLab(hex: string): Lab {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

// ─── THE TWO SETS ────────────────────────────────────────────────────

const moodColours: { name: string; hex: string }[] = [];
for (const [id, p] of Object.entries(AURORA_PALETTES)) {
  moodColours.push({ name: `${id}.accent`, hex: p.accent });
  moodColours.push({ name: `${id}.accent2`, hex: p.accent2 });
  p.aurora.forEach((hex, i) => moodColours.push({ name: `${id}.bloom${i + 1}`, hex }));
}
for (const step of MOOD_SCALE) {
  moodColours.push({ name: `moodScale.${step.label.toLowerCase()}`, hex: step.color });
}

const phases = Object.entries(PHASE_AURORA) as [string, string][];

// ─── CHECK ───────────────────────────────────────────────────────────

const problems: string[] = [];
let worstMood = Infinity;
let worstPhase = Infinity;

console.log('\x1b[1m\nDottie — colour audit\x1b[0m');
console.log(`  mood colours compared against: ${moodColours.length}`);

for (const [phase, hex] of phases) {
  let nearest = { name: '', d: Infinity, hex: '' };
  for (const m of moodColours) {
    const d = deltaE(hex, m.hex);
    if (d < nearest.d) nearest = { name: m.name, d, hex: m.hex };
  }
  worstMood = Math.min(worstMood, nearest.d);
  const ok = nearest.d >= MIN_MOOD_DISTANCE;
  console.log(
    `  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${phase.padEnd(11)} ${hex}` +
      `  nearest mood ΔE ${nearest.d.toFixed(1).padStart(5)}  (${nearest.name} ${nearest.hex})`
  );
  if (!ok) {
    problems.push(
      `${phase} ${hex} is only ΔE ${nearest.d.toFixed(1)} from ${nearest.name} ${nearest.hex}` +
        ` — the mood background and the phase mark read as the same colour.`
    );
  }
}

for (let i = 0; i < phases.length; i++) {
  for (let j = i + 1; j < phases.length; j++) {
    const [a, ah] = phases[i]!;
    const [b, bh] = phases[j]!;
    const d = deltaE(ah, bh);
    worstPhase = Math.min(worstPhase, d);
    if (d < MIN_PHASE_DISTANCE) {
      problems.push(
        `${a} and ${b} are only ΔE ${d.toFixed(1)} apart — they sit side by side in the legend.`
      );
    }
  }
}

console.log(
  `\n  minimum ΔE to the mood set: ${worstMood.toFixed(1)} (floor ${MIN_MOOD_DISTANCE})` +
    `\n  minimum ΔE between phases:  ${worstPhase.toFixed(1)} (floor ${MIN_PHASE_DISTANCE})`
);

// ─── WHAT THE GRID ACTUALLY PAINTS ───────────────────────────────────

const rendered: { name: string; hex: string }[] = [
  { name: 'period (logged)', hex: LOGGED_PERIOD_CELL },
  { name: 'menstrual (est.)', hex: PHASE_CELL.menstrual },
  { name: 'follicular', hex: PHASE_CELL.follicular },
  { name: 'ovulatory', hex: PHASE_CELL.ovulatory },
  { name: 'luteal', hex: PHASE_CELL.luteal },
  { name: 'fertile (est.)', hex: FERTILE_CELL },
  { name: 'ovulation (est.)', hex: OVULATION_CELL },
  { name: 'predicted', hex: PREDICTED_CELL },
];

console.log('\n  as the grid paints them (opaque, over the aurora ground):');
let worstRendered = Infinity;
for (const r of rendered) {
  const ink = inkOn(r.hex);
  const ratio = contrastRatio(r.hex, ink);
  const readable = ratio >= MIN_INK_CONTRAST;
  console.log(
    `  ${readable ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${r.name.padEnd(17)} ${r.hex}` +
      `  ink ${ink}  contrast ${ratio.toFixed(1)}:1`
  );
  if (!readable) {
    problems.push(
      `the number on a ${r.name} day is only ${ratio.toFixed(1)}:1 against its fill — unreadable.`
    );
  }
}

/**
 * Pairs that SHARE a hue on purpose, because one is a peak inside the other:
 * an ovulation day sits inside the ovulatory band, the fertile window sits
 * around it, a predicted period is a period that hasn't happened. Each of
 * these is additionally distinguished by a SHAPE in both the grid and the
 * legend (a solid ring, a dashed ring), so hue distance is the wrong test.
 *
 * They are not exempt, they are tested differently: they must differ clearly
 * in LIGHTNESS, so the pair still reads as "same family, different thing"
 * rather than as one colour drawn twice.
 */
const FAMILY_PAIRS = new Set([
  'ovulatory|ovulation (est.)',
  'ovulatory|fertile (est.)',
  'period (logged)|predicted',
  'menstrual (est.)|predicted',
  // device-test-24: an ovulation day IS a fertile day, so it now KEEPS the
  // fertile fill and is identified by its ring and glyph instead of by a
  // brighter fill of the same hue that hid the window underneath. This pair
  // is checked as a shape below rather than as two fills.
  'fertile (est.)|ovulation (est.)',
]);
const MIN_FAMILY_LIGHTNESS = 10;
/** Pairs where the shape is the identity, so a fill match is intended. */
const SHAPE_IS_THE_IDENTITY = new Set(['fertile (est.)|ovulation (est.)']);

for (let i = 0; i < rendered.length; i++) {
  for (let j = i + 1; j < rendered.length; j++) {
    const a = rendered[i]!;
    const b = rendered[j]!;
    const d = deltaE(a.hex, b.hex);
    const family = FAMILY_PAIRS.has(`${a.name}|${b.name}`) || FAMILY_PAIRS.has(`${b.name}|${a.name}`);

    if (
      SHAPE_IS_THE_IDENTITY.has(`${a.name}|${b.name}`) ||
      SHAPE_IS_THE_IDENTITY.has(`${b.name}|${a.name}`)
    ) {
      continue;
    }

    if (family) {
      const dl = Math.abs(toLab(a.hex)[0] - toLab(b.hex)[0]);
      if (dl < MIN_FAMILY_LIGHTNESS) {
        problems.push(
          `${a.name} and ${b.name} share a hue on purpose, but are only ${dl.toFixed(1)}` +
            ` L* apart (${a.hex} vs ${b.hex}) — the shape is doing all the work.`
        );
      }
      continue;
    }

    worstRendered = Math.min(worstRendered, d);
    if (d < MIN_RENDERED_DISTANCE) {
      problems.push(
        `as drawn, ${a.name} and ${b.name} are only ΔE ${d.toFixed(1)} apart` +
          ` (${a.hex} vs ${b.hex}) — the legend claims they are different.`
      );
    }
  }
}

// ─── THE TWO RULES DT24 ADDED ────────────────────────────────────────

// 1. A LOGGED day and an ESTIMATED one must never look the same. They did:
//    both drew the full-strength rose, so marking one day painted five
//    identical solid discs and the owner reported that one tap "locks the
//    entire week". A calendar that draws an estimate in the same ink as a
//    fact is claiming something it cannot back up.
{
  const d = deltaE(LOGGED_PERIOD_CELL, PHASE_CELL.menstrual);
  if (d < 20) {
    problems.push(
      `a logged period day (${LOGGED_PERIOD_CELL}) and an ESTIMATED menstrual day` +
        ` (${PHASE_CELL.menstrual}) are only ΔE ${d.toFixed(1)} apart — the grid would be` +
        ` drawing a guess in the same ink as a fact.`
    );
  }
  console.log(
    `\n  logged vs estimated period day: ΔE ${d.toFixed(1)} (floor 20)` +
      `  ${LOGGED_PERIOD_CELL} vs ${PHASE_CELL.menstrual}`
  );
}

// 2. When a mark's identity IS its shape, the shape has to be visible against
//    the fill it is drawn on — otherwise "distinguished by a ring" is a claim
//    with nothing behind it.
{
  const d = deltaE(OVULATION_MARK, OVULATION_CELL);
  const ratio = contrastRatio(OVULATION_MARK, OVULATION_CELL);
  console.log(
    `  ovulation ring on its fill:     ΔE ${d.toFixed(1)} (floor 25)` +
      `, contrast ${ratio.toFixed(1)}:1`
  );
  if (d < 25) {
    problems.push(
      `the ovulation ring (${OVULATION_MARK}) is only ΔE ${d.toFixed(1)} from the fertile fill` +
        ` it is drawn on (${OVULATION_CELL}) — the shape cannot carry the identity.`
    );
  }
}

// A mark that is nearly the ground is a mark you cannot see AT ALL — the DT23
// failure in its purest form.
for (const r of rendered) {
  const d = deltaE(r.hex, '#0C0A16');
  if (d < 12) {
    problems.push(
      `${r.name} (${r.hex}) is only ΔE ${d.toFixed(1)} from the aurora ground — it will vanish.`
    );
  }
}

console.log(
  `\n  minimum ΔE between drawn marks: ${worstRendered.toFixed(1)} (floor ${MIN_RENDERED_DISTANCE})`
);

if (problems.length === 0) {
  console.log(
    '\n\x1b[32m✓ no phase colour collides with a mood colour, with another phase,' +
      '\n  or with the ground — and every day number is readable on its fill.\x1b[0m\n'
  );
  process.exit(0);
}
console.log(`\n\x1b[31m✗ ${problems.length} colour collision(s):\x1b[0m`);
for (const p of problems) console.log(`    · ${p}`);
console.log('');
process.exit(1);
