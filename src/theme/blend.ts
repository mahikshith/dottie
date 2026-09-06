/**
 * Dottie — colour compositing
 *
 * ─── WHY THIS EXISTS (device-test-23) ───────────────────────────────
 *
 *  Owner: "those colours were not bright enough. If the screen is bright
 *  enough on a sunny day… they couldn't tell the difference between the aurora
 *  colour and the phase colour."
 *
 *  DT22 fixed the phase HUES — they are now measurably far from every mood
 *  colour (`audit:colour`). But the calendar never drew those hues. It drew
 *  them at 14% alpha (`${PHASE_AURORA[phase]}24`) on top of a large, blurred,
 *  MOVING aurora bloom. At 14%, 86% of what you see is the background: the
 *  colour of a follicular day was mostly whatever bloom happened to be behind
 *  it, and it changed as the blooms drifted. Raise the screen brightness and
 *  the blooms get stronger, which is exactly when the owner lost the
 *  distinction.
 *
 *  So the audit was measuring the token and the eye was seeing the composite.
 *  This module closes that gap: every calendar mark is composited against the
 *  aurora GROUND here, at build time, and drawn as an OPAQUE colour. What the
 *  audit measures is then what the screen shows, on any background, at any
 *  brightness, with the blooms doing whatever they like behind it.
 *
 *  Opacity is not decoration on a data mark. A legend that says "this colour
 *  means luteal" is a promise that the colour is that colour.
 */

import { A } from './aurora-static';
import { PHASE_AURORA } from './palettes';

// ─── COMPOSITING ─────────────────────────────────────────────────────

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * `fg` at `alpha` over `bg`, as an OPAQUE hex.
 *
 * The same arithmetic the GPU would do — the difference is that the result is
 * a known colour rather than a colour that depends on what is underneath.
 */
export function over(fg: string, bg: string, alpha: number): string {
  const [fr, fg_, fb] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  const t = Math.max(0, Math.min(1, alpha));
  return `#${toHex(fr * t + br * (1 - t))}${toHex(fg_ * t + bg_ * (1 - t))}${toHex(
    fb * t + bb * (1 - t)
  )}`;
}

/** Relative luminance (WCAG). Used to pick ink that survives on a fill. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Black or white ink, whichever survives on this fill. A fixed ink colour is
 * how you end up with pale text on a bright citron ovulation day.
 */
export function inkOn(fill: string): string {
  return contrastRatio(fill, '#0C0A16') >= contrastRatio(fill, '#FFFFFF')
    ? A.ground
    : '#FFFFFF';
}

// ─── THE CALENDAR'S OPAQUE PALETTE ───────────────────────────────────
//
//  Three strengths, all composited over the aurora ground:
//
//    SOLID  — this day IS this thing. A logged period day.
//    STRONG — this day is in this phase. Bright enough to name across the
//             grid at arm's length, on a sunny day, over any bloom.
//    SOFT   — an ESTIMATE (the fertile window). Deliberately quieter than a
//             phase, because it is the least certain thing on the grid and
//             must never look like the most confident. Still opaque.

/**
 * How much of the phase hue survives in a normal phase day.
 *
 * High on purpose. The ground is nearly black, so anything under ~0.7 comes
 * out muddy — which is what DT23 was reporting: not just "the same as the
 * background" but "not bright enough". At 0.8 a follicular day is a real
 * cyan, not a hint of one.
 */
const STRONG = 0.8;
/** The fertile window — present, but visibly less certain than a phase. */
const SOFT = 0.42;
/**
 * Ovulation day. Nearly the pure hue: it is the single most useful estimated
 * day on the grid and it has to read as a PEAK inside the ovulatory band, not
 * as another day of it.
 */
const OVULATION = 0.95;
/** The predicted-period wash under its dashed ring. */
const PREDICTED = 0.3;

export const PHASE_CELL = {
  menstrual: PHASE_AURORA.menstrual,
  follicular: over(PHASE_AURORA.follicular, A.ground, STRONG),
  ovulatory: over(PHASE_AURORA.ovulatory, A.ground, STRONG),
  luteal: over(PHASE_AURORA.luteal, A.ground, STRONG),
} as const;

/** The fertile-window wash, and the ovulation day's fill under its ring. */
export const FERTILE_CELL = over(PHASE_AURORA.ovulatory, A.ground, SOFT);
export const OVULATION_CELL = over(PHASE_AURORA.ovulatory, A.ground, OVULATION);
/** The predicted-period wash, under the dashed ring. */
export const PREDICTED_CELL = over(PHASE_AURORA.menstrual, A.ground, PREDICTED);

/** Ink for each of the above, chosen for contrast rather than assumed. */
export const PHASE_INK = {
  menstrual: inkOn(PHASE_CELL.menstrual),
  follicular: inkOn(PHASE_CELL.follicular),
  ovulatory: inkOn(PHASE_CELL.ovulatory),
  luteal: inkOn(PHASE_CELL.luteal),
} as const;
