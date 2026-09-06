/**
 * Dottie — companion geometry (pure)
 *
 * Every shape that makes up a companion, as data. No React, no react-native-svg,
 * no DOM — just numbers in a 100×100 box.
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────
 *
 *  The companions have been reported as looking like INSECTS in three separate
 *  device rounds. Each time they were adjusted by reasoning about the geometry
 *  and shipped in a ~25-minute APK build, and each time the owner opened it and
 *  said the same thing. The DT16 pass genuinely made one of them worse: it gave
 *  the deer two round nubs on top of its head, which is what an antenna is.
 *
 *  The reason that kept happening is that nobody could LOOK at them. The art
 *  lived inside a React Native component, so the only renderer was a phone.
 *
 *  So the art is data now. `CompanionCreature` maps it to react-native-svg;
 *  `scripts/companion-preview.ts` maps the SAME data to an HTML page anyone can
 *  open in a browser in a second. What the owner reviews is what ships, because
 *  there is only one copy of the numbers.
 *
 * ─── WHAT MADE THEM READ AS BUGS ────────────────────────────────────
 *
 *  Worth writing down, because every one of these is easy to reintroduce:
 *
 *  1. SPARKLES IN A FULL RING. `Sparkles` placed up to 12 dots around the whole
 *     character at radius 42 — including down both sides and underneath. Small
 *     round things radiating from a round body are LEGS. This was the loudest
 *     signal and it fired on every celebrate/mindblown state.
 *  2. BIG, WIDE-SET, ROUND BLACK EYES. Centres were 24 apart on a 50-wide head
 *     (0.48 of the width) at rx 6.4. Wide-set round black domes are how a fly
 *     or a jumping spider is drawn. Mammal eyes sit closer in and carry a large
 *     soft catchlight.
 *  3. NO NECK. Head (r 25 at y 44) and body (ry 24 at y 62) were nearly the
 *     same size and heavily concentric, so the outline was one lumpy oval —
 *     a thorax joined to an abdomen.
 *  4. SYMMETRIC DARK SHAPES FLANKING THE MIDLINE. The owl's "folded wings" were
 *     two hard-edged dark ellipses at 85% opacity. DT16 moved them inward but
 *     kept them, and two mirrored dark limbs either side of a round body is the
 *     same read at any x.
 *  5. STALKED NUBS ABOVE THE HEAD — the DT16 deer antlers. Antennae.
 *  6. PERFECT BILATERAL SYMMETRY everywhere. Insects are read from symmetric
 *     radial forms; characters get their life from a tail, a tilted ear, a
 *     tuft that sits off-centre.
 *
 *  The rules below are enforced by `npm run test:creature`, so a future edit
 *  cannot quietly bring one back.
 */

import type { CompanionType } from '../../../types/content.types';
import type { ArmPose, Expression } from './expressions';

// ─── SHAPES ──────────────────────────────────────────────────────────

/**
 * A drawing primitive. `role` is metadata for the audit, never for rendering —
 * it is how `test:creature` can say "no sparkle may sit beside or below the
 * body" without parsing paths.
 */
export type ShapeRole =
  | 'shadow'
  | 'foot'
  | 'tail'
  | 'ear'
  | 'wing'
  | 'petal'
  | 'body'
  | 'belly'
  | 'head'
  | 'cheek'
  | 'brow'
  | 'eye'
  | 'eye-light'
  | 'nose'
  | 'mouth'
  | 'sparkle'
  | 'arm'
  | 'leg'
  | 'hand'
  | 'anger'
  | 'tuft';

/**
 * Which animated group a shape belongs to.
 *
 * The rig rotates each group about its own joint on the UI thread, so a shape
 * tagged `armL` swings from the shoulder rather than sliding around the box.
 * Untagged shapes are the still parts — body, head, face.
 */
export type Limb = 'armL' | 'armR' | 'legL' | 'legR' | 'tail' | 'earL' | 'earR';

/** Where each limb pivots. Shoulders, hips, and the base of the tail. */
export const JOINTS: Record<Limb, readonly [number, number]> = {
  armL: [36, 60],
  armR: [64, 60],
  legL: [45, 75],
  legR: [55, 75],
  tail: [64, 76],
  earL: [43, 18],
  earR: [57, 18],
};

export interface BaseShape {
  role: ShapeRole;
  /** Animated group this shape rides in. Omitted = part of the still body. */
  limb?: Limb;
  fill?: string;
  stroke?: string;
  /** Stroke width. */
  sw?: number;
  opacity?: number;
  /** Degrees, applied about the shape's own centre. */
  rotate?: number;
}

export interface EllipseShape extends BaseShape {
  k: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}
export interface CircleShape extends BaseShape {
  k: 'circle';
  cx: number;
  cy: number;
  r: number;
}
export interface PathShape extends BaseShape {
  k: 'path';
  d: string;
  /** Rotation pivot, since a path has no intrinsic centre. */
  px?: number;
  py?: number;
}

export type Shape = EllipseShape | CircleShape | PathShape;

// ─── THE SPECIES ─────────────────────────────────────────────────────

export type EarKind = 'pointy' | 'long' | 'leaf' | 'tufted' | 'none';
export type TailKind = 'bushy' | 'thin' | 'puff' | 'none';
/**
 * A snout or a beak. Without this the owl was drawn with the mammal muzzle and
 * read as a small bear — it had the right ears and the wrong face.
 */
export type FaceKind = 'muzzle' | 'beak';

export interface Species {
  fur: string;
  furDark: string;
  belly: string;
  accent: string;
  /** Dark colour for the nose and paw pads. Kept off pure black. */
  ink: string;
  ear: EarKind;
  tail: TailKind;
  face: FaceKind;
  /** Fawn spots. The one mark that makes the deer read as a deer at 28px. */
  spots: boolean;
  /** Owl only — soft wing crescents that hug the body outline. */
  wings: boolean;
  /** Blossom only — a crown of petals around the head. */
  petals: boolean;
  /** A small off-centre tuft. The asymmetry that stops the shape reading radial. */
  tuft: boolean;
}

export const SPECIES: Record<CompanionType, Species> = {
  fox: {
    fur: '#FF9A3C', furDark: '#D65E14', belly: '#FFEBD6', accent: '#FFC49A',
    ink: '#2E2438', ear: 'pointy', tail: 'bushy', face: 'muzzle', spots: false, wings: false, petals: false, tuft: true,
  },
  bunny: {
    fur: '#EDE5FF', furDark: '#B9A6E4', belly: '#FFFFFF', accent: '#FFA9C6',
    ink: '#3A3050', ear: 'long', tail: 'puff', face: 'muzzle', spots: false, wings: false, petals: false, tuft: false,
  },
  // `butterfly` keeps its ID so nobody's saved companion breaks, but it is
  // drawn as a DEER. It has soft leaf ears and a forehead tuft — and
  // deliberately NO antler nubs, which is what DT16 got wrong.
  butterfly: {
    fur: '#B99BFF', furDark: '#7A5AE0', belly: '#F3ECFF', accent: '#FFD27A',
    ink: '#2E2438', ear: 'leaf', tail: 'none', face: 'muzzle', spots: true, wings: false, petals: false, tuft: false,
  },
  cat: {
    fur: '#6E63AE', furDark: '#3D3474', belly: '#EDE9FC', accent: '#FFC489',
    ink: '#241E36', ear: 'pointy', tail: 'thin', face: 'muzzle', spots: false, wings: false, petals: false, tuft: false,
  },
  owl: {
    fur: '#D99A52', furDark: '#8A5A28', belly: '#FFF6E6', accent: '#FFB43C',
    ink: '#3A2A1E', ear: 'none', tail: 'none', face: 'beak', spots: false, wings: true, petals: false, tuft: false,
  },
  blossom: {
    fur: '#FF8FBE', furDark: '#E05A94', belly: '#FFE9F2', accent: '#FFDC8A',
    ink: '#43263A', ear: 'none', tail: 'none', face: 'muzzle', spots: false, wings: false, petals: true, tuft: false,
  },
};

// ─── PROPORTIONS ─────────────────────────────────────────────────────
//
// ─── WHAT WAS WRONG (device-test-26) ────────────────────────────────
//
//  "Okayish, not fun." Correct, and the reason is measurable: every species
//  shared ONE head circle, ONE body path and ONE face layout, and differed
//  only by ear shape, tail and hue. That is six colourways of a single plush
//  toy, and no amount of expression work fixes it, because the thing you
//  recognise first — the silhouette — was identical for all six.
//
//  Two changes:
//
//  1. APPEAL PROPORTIONS. Head r 22 → 25 on a NARROWER body, eyes half again
//     as big. Big head, big eyes, small body is the whole of chibi appeal and
//     ours was timid on all three counts.
//  2. A PER-SPECIES BUILD. Each companion carries its own head size and
//     position, body width, leg length, stance and props, so a leggy fawn, a
//     squat owl and a slim cat are different SHAPES before a single colour is
//     applied. That is what survives at 28 pixels in a tab bar.
//
//  Everything below is expressed in terms of the build, so changing one
//  number moves the ears, the face and the limbs together instead of leaving
//  a face floating off a skull.

/** The reference head. Every species scales from here. */
export const HEAD = { cx: 50, cy: 34, r: 25 } as const;
/** Eye centres on the reference head. 18 apart on 50 wide — 0.36, a mammal ratio. */
export const EYE = { lx: 41, rx: 59, cy: 37.5, rx0: 6.6, ry0: 8 } as const;
/** The reference body. Never as wide as the head. */
export const BODY = { top: 54, bottom: 82, halfWidth: 15 } as const;

/**
 * One companion's build. This is the silhouette; the colours are decoration.
 */
export interface Build {
  headR: number;
  headCy: number;
  bodyTop: number;
  bodyBottom: number;
  halfWidth: number;
  /** Hip and foot height. A leggy fawn and a squat owl are mostly these two. */
  hipY: number;
  footY: number;
  /** How far apart the feet plant, either side of the midline. */
  stance: number;
  /** Shoulder height for the arms. */
  shoulderY: number;
  /** Limb thickness. A chunky owl and a delicate deer differ here too. */
  limbW: number;
}

export const BUILD: Record<CompanionType, Build> = {
  // Slim and alert, with the tail doing the talking.
  fox: { headR: 25, headCy: 35, bodyTop: 56, bodyBottom: 82, halfWidth: 13.5,
    hipY: 75, footY: 90, stance: 8.5, shoulderY: 61, limbW: 8 },
  // Sits lower so the ears have room — one of them flops, which is the whole
  // character in one number.
  bunny: { headR: 23, headCy: 38, bodyTop: 58, bodyBottom: 84, halfWidth: 14,
    hipY: 77, footY: 91, stance: 8, shoulderY: 63, limbW: 8 },
  // The fawn: smaller head, long legs, high hips. Reads as a different animal
  // from across the room, which the old build never did.
  butterfly: { headR: 22.5, headCy: 31, bodyTop: 50, bodyBottom: 74, halfWidth: 11.5,
    hipY: 68, footY: 92, stance: 10, shoulderY: 55, limbW: 6.5 },
  // Long and lean, tail curled high.
  cat: { headR: 24.5, headCy: 34, bodyTop: 55, bodyBottom: 81, halfWidth: 12.5,
    hipY: 74, footY: 90, stance: 7.5, shoulderY: 60, limbW: 7.5 },
  // Squat and wide, almost no legs — an owl is a barrel with a face.
  owl: { headR: 25.5, headCy: 33, bodyTop: 52, bodyBottom: 85, halfWidth: 19,
    hipY: 80, footY: 91, stance: 11, shoulderY: 60, limbW: 9 },
  // Round and soft, the petal crown widening the top of the silhouette.
  blossom: { headR: 24.5, headCy: 36, bodyTop: 57, bodyBottom: 83, halfWidth: 15,
    hipY: 76, footY: 90, stance: 9, shoulderY: 62, limbW: 8.5 },
};

/**
 * The body outline: narrow at the shoulders, widest low, tucked at the base.
 * A pear, never an oval, and never wider than the head.
 */
function bodyPath(b: Build): string {
  const w = b.halfWidth;
  const t = b.bodyTop;
  const h = b.bodyBottom - b.bodyTop;
  const r = (n: number): number => Math.round(n * 10) / 10;
  return (
    `M50 ${r(t)} ` +
    `C${r(50 - w * 0.72)} ${r(t + h * 0.04)} ${r(50 - w)} ${r(t + h * 0.38)} ${r(50 - w)} ${r(t + h * 0.63)} ` +
    `C${r(50 - w)} ${r(t + h * 0.93)} ${r(50 - w * 0.6)} ${r(b.bodyBottom)} 50 ${r(b.bodyBottom)} ` +
    `C${r(50 + w * 0.6)} ${r(b.bodyBottom)} ${r(50 + w)} ${r(t + h * 0.93)} ${r(50 + w)} ${r(t + h * 0.63)} ` +
    `C${r(50 + w)} ${r(t + h * 0.38)} ${r(50 + w * 0.72)} ${r(t + h * 0.04)} 50 ${r(t)} Z`
  );
}

/**
 * Where one species' eyes sit and how big they are.
 *
 * The face is built from the species' own head now, so anything drawing OVER
 * the face — the blink lids in the rig — has to ask rather than assume the
 * reference head. A lid at the reference position blinked beside the deer's
 * eyes instead of over them (device-test-26).
 */
export function eyeMetrics(type: CompanionType): {
  lx: number; rx0: number; cy: number; rx: number; ry: number;
} {
  const b = BUILD[type];
  return {
    lx: 50 - b.headR * 0.72,
    rx0: 50 + b.headR * 0.72,
    cy: b.headCy + b.headR * 0.14,
    rx: b.headR * 0.265,
    ry: b.headR * 0.32,
  };
}

// ─── BUILDING ONE COMPANION ──────────────────────────────────────────

/**
 * Every shape for one companion, in paint order (back to front).
 *
 * Pure: same arguments, same array, always. That is what lets the preview page
 * and the app be the same picture, and what lets the audit reason about it.
 */
export function creatureShapes(type: CompanionType, expr: Expression): Shape[] {
  const sp = SPECIES[type];
  const b = BUILD[type];
  return [
    ...groundShapes(sp, b),
    ...sparkleShapes(expr.sparkles, sp.accent),
    ...behindShapes(sp, b),
    ...bodyShapes(sp, b),
    ...armShapes(sp, b),
    ...headShapes(sp, b),
    ...faceShapes(sp, b, expr),
  ];
}

/**
 * Contact shadow, then the legs.
 *
 * Two legs with two feet, each swinging from its own hip. This is the clearest
 * "not six legs" cue in the whole rig, and until DT18 there were no legs at
 * all — just two detached foot-ellipses under a body that reached the floor.
 */
function groundShapes(sp: Species, b: Build): Shape[] {
  // The leg starts INSIDE the body outline, so the joint is buried and the
  // limb reads as growing out of the hip rather than parked underneath it.
  const leg = (limb: 'legL' | 'legR', hx: number, fx: number): Shape[] => [
    { k: 'path', limb, role: 'leg', d: `M${hx} ${b.hipY} Q${hx} ${b.footY - 4} ${fx} ${b.footY - 1}`, stroke: sp.fur, sw: b.limbW * 1.15 },
    { k: 'ellipse', limb, role: 'foot', cx: fx, cy: b.footY + 1.5, rx: b.limbW * 0.92, ry: b.limbW * 0.5, fill: sp.furDark, opacity: 0.95 },
    { k: 'ellipse', limb, role: 'foot', cx: fx, cy: b.footY + 2, rx: b.limbW * 0.5, ry: b.limbW * 0.26, fill: sp.belly, opacity: 0.55 },
  ];
  return [
    { k: 'ellipse', role: 'shadow', cx: 50, cy: b.footY + 5, rx: b.halfWidth + 4, ry: 2.8, fill: '#000000', opacity: 0.16 },
    ...leg('legL', 50 - b.stance * 0.55, 50 - b.stance),
    ...leg('legR', 50 + b.stance * 0.55, 50 + b.stance),
  ];
}

/**
 * Arms, drawn hanging from the shoulder with a slight outward curve.
 *
 * The POSE is a rotation about the joint, applied by the rig — so this geometry
 * only ever has to describe one arm, and "hands on hips", "both up", "hand to
 * chin" are all the same two shapes at different angles.
 */
function armShapes(sp: Species, b: Build): Shape[] {
  const handY = b.bodyBottom - 4;
  const arm = (limb: 'armL' | 'armR', dir: -1 | 1): Shape[] => {
    const sx = 50 + dir * (b.halfWidth - 1);
    const hx = 50 + dir * (b.halfWidth + 2.5);
    return [
      { k: 'path', limb, role: 'arm', d: `M${sx} ${b.shoulderY} Q${hx} ${b.shoulderY + 7} ${hx} ${handY}`, stroke: sp.fur, sw: b.limbW },
      { k: 'circle', limb, role: 'hand', cx: hx, cy: handY + 1.5, r: b.limbW * 0.62, fill: sp.furDark, opacity: 0.95 },
    ];
  };
  return [...arm('armL', -1), ...arm('armR', 1)];
}

/** Tail, petals, ears — everything drawn BEHIND the body and head. */
function behindShapes(sp: Species, b: Build): Shape[] {
  const out: Shape[] = [];

  // Tail. Always on ONE side: the asymmetry is the point, and it now rides the
  // `tail` limb so the rig can swing it a beat behind the body — follow-through
  // is most of what separates "moves" from "alive".
  if (sp.tail === 'bushy') {
    // The fox's tail is deliberately HUGE: nearly as big as its body, which is
    // the single most recognisable thing about the character at any size.
    out.push({
      k: 'path', limb: 'tail', role: 'tail',
      d: 'M64 78 C82 82 94 70 90 56 C88 47 78 44 74 51 C70 58 78 64 83 60',
      stroke: sp.fur, sw: 13, fill: 'none',
    });
    out.push({
      k: 'path', limb: 'tail', role: 'tail',
      d: 'M89 56 C88 48 80 45 76 51',
      stroke: sp.belly, sw: 9, fill: 'none', opacity: 0.95,
    });
  }
  if (sp.tail === 'thin') {
    // A cat's tail curls UP, not down — it is a question mark, and it gives the
    // silhouette a second high point nothing else in the cast has.
    out.push({
      k: 'path', limb: 'tail', role: 'tail',
      d: 'M63 78 C80 80 90 68 86 54 C84 47 76 46 76 53',
      stroke: sp.fur, sw: 6, fill: 'none',
    });
    out.push({
      k: 'path', limb: 'tail', role: 'tail',
      d: 'M86 54 C85 48 79 46 77 51',
      stroke: sp.belly, sw: 4.5, fill: 'none', opacity: 0.9,
    });
  }
  if (sp.tail === 'puff') {
    out.push({ k: 'circle', limb: 'tail', role: 'tail', cx: 50 + b.halfWidth + 3, cy: b.bodyBottom - 5, r: 8, fill: sp.belly, opacity: 0.97 });
  }

  // Petals — a CROWN over the head, not a ring around the whole body. The old
  // version rotated six petals about the body centre, so two of them sat down
  // by the feet and read as legs.
  if (sp.petals) {
    const R = b.headR - 3;
    for (const a of [-76, -38, 0, 38, 76]) {
      out.push({
        k: 'ellipse', role: 'petal',
        cx: 50 + Math.sin((a * Math.PI) / 180) * R,
        cy: b.headCy - Math.cos((a * Math.PI) / 180) * R,
        rx: 10.5, ry: 13.5, fill: sp.fur, opacity: 0.97, rotate: a,
      });
    }
    // A darker inner ring so the crown reads as petals rather than a hedge.
    for (const a of [-76, -38, 0, 38, 76]) {
      out.push({
        k: 'ellipse', role: 'petal',
        cx: 50 + Math.sin((a * Math.PI) / 180) * (R - 2),
        cy: b.headCy - Math.cos((a * Math.PI) / 180) * (R - 2),
        rx: 5, ry: 6.5, fill: sp.furDark, opacity: 0.28, rotate: a,
      });
    }
  }

  out.push(...earShapes(sp, b));
  return out;
}

/**
 * Ears, anchored to the head rather than to absolute coordinates.
 *
 * They ride the `earL` / `earR` limbs, so the rig can flick them — an ear that
 * lags the head turn by a frame is worth more than any amount of detail.
 */
function earShapes(sp: Species, b: Build): Shape[] {
  const cy = b.headCy;
  const R = b.headR;
  const crown = cy - R;
  switch (sp.ear) {
    case 'pointy': {
      // Big triangular ears rooted wide on the skull. Bigger than before by
      // half: timid ears on a big head is what made these read as bear cubs.
      const ear = (limb: 'earL' | 'earR', dir: -1 | 1): Shape[] => {
        const baseX = 50 + dir * R * 0.74;
        const innerX = 50 + dir * R * 0.22;
        const tipX = 50 + dir * R * 1.02;
        return [
          { k: 'path', limb, role: 'ear',
            d: `M${baseX} ${cy - R * 0.5} Q${tipX} ${crown - R * 0.34} ${innerX} ${cy - R * 0.86} Z`,
            fill: sp.fur },
          { k: 'path', limb, role: 'ear',
            d: `M${baseX + dir * 1.5} ${cy - R * 0.54} Q${tipX - dir * 2.5} ${crown - R * 0.14} ${innerX + dir * 1} ${cy - R * 0.8} Z`,
            fill: sp.accent, opacity: 0.75 },
        ];
      };
      return [...ear('earL', -1), ...ear('earR', 1)];
    }
    case 'long':
      // ONE EAR FLOPS. The cheapest character beat in the whole rig: a perfectly
      // matched pair is a diagram, one ear over is a personality.
      return [
        { k: 'ellipse', limb: 'earL', role: 'ear', cx: 50 - R * 0.42, cy: crown - 3, rx: 6.4, ry: 13.5, fill: sp.fur, rotate: -14 },
        { k: 'ellipse', limb: 'earL', role: 'ear', cx: 50 - R * 0.42, cy: crown - 2, rx: 3.1, ry: 9, fill: sp.accent, opacity: 0.85, rotate: -14 },
        { k: 'ellipse', limb: 'earR', role: 'ear', cx: 50 + R * 0.78, cy: crown + 4.5, rx: 6.2, ry: 12.5, fill: sp.fur, rotate: 52 },
        { k: 'ellipse', limb: 'earR', role: 'ear', cx: 50 + R * 0.76, cy: crown + 4.5, rx: 3, ry: 8, fill: sp.accent, opacity: 0.85, rotate: 52 },
      ];
    case 'leaf':
      // A doe's ears: big tall ovals swept OUT to the sides, well clear of the
      // skull, and deliberately no nubs above the crown — that was the DT16
      // antenna. Bigger and lower than before so they frame the face.
      return [
        { k: 'ellipse', limb: 'earL', role: 'ear', cx: 50 - R * 1.04, cy: cy - R * 0.34, rx: 8.5, ry: 14.5, fill: sp.fur, rotate: -56 },
        { k: 'ellipse', limb: 'earL', role: 'ear', cx: 50 - R * 1.0, cy: cy - R * 0.32, rx: 4.2, ry: 9, fill: sp.accent, opacity: 0.75, rotate: -56 },
        { k: 'ellipse', limb: 'earR', role: 'ear', cx: 50 + R * 1.04, cy: cy - R * 0.4, rx: 8.5, ry: 14.5, fill: sp.fur, rotate: 52 },
        { k: 'ellipse', limb: 'earR', role: 'ear', cx: 50 + R * 1.0, cy: cy - R * 0.38, rx: 4.2, ry: 9, fill: sp.accent, opacity: 0.75, rotate: 52 },
      ];
    case 'tufted': {
      // Horned-owl tufts. The first version used ROUND ellipses, which on a
      // round head is a teddy bear — the owl was read as one immediately
      // (device-test-26). These are broad angled wedges instead: rooted wide on
      // the skull, swept outward, blunt at the tip so they still are not spikes.
      const tuft = (limb: 'earL' | 'earR', dir: -1 | 1): Shape[] => {
        const base = 50 + dir * R * 0.5;
        const out = 50 + dir * R * 1.06;
        return [
          { k: 'path', limb, role: 'ear',
            d: `M${base} ${crown + 8} Q${out} ${crown - 5} ${50 + dir * R * 0.88} ${crown + 10} Z`,
            fill: sp.fur },
          { k: 'path', limb, role: 'ear',
            d: `M${base + dir * 2} ${crown + 8} Q${out - dir * 2.5} ${crown - 1} ${50 + dir * R * 0.82} ${crown + 9.5} Z`,
            fill: sp.furDark, opacity: 0.35 },
        ];
      };
      return [...tuft('earL', -1), ...tuft('earR', 1)];
    }
    default:
      return [];
  }
}

function bodyShapes(sp: Species, b: Build): Shape[] {
  const out: Shape[] = [
    { k: 'path', role: 'body', d: bodyPath(b), fill: sp.fur },
  ];
  // The belly patch sits low and wide — it is the second-biggest shape on the
  // character and it reads as a chest, which is a mammal cue nothing else gives.
  out.push({
    k: 'ellipse', role: 'belly',
    cx: 50, cy: b.bodyBottom - (b.bodyBottom - b.bodyTop) * 0.34,
    rx: b.halfWidth * 0.82, ry: (b.bodyBottom - b.bodyTop) * 0.42,
    fill: sp.belly, opacity: 0.92,
  });

  // Fawn spots — scattered, uneven, and only on one flank. Two jobs: it says
  // "deer" faster than any silhouette change can, and the lopsided placement
  // breaks the mirror symmetry that made every one of these read as a bug.
  if (sp.spots) {
    for (const [dx, dy, r] of [[-0.62, 0.24, 2.5], [-0.78, 0.56, 2], [-0.3, 0.86, 1.7], [0.66, 0.36, 2.2], [0.8, 0.68, 1.6]] as const) {
      out.push({
        k: 'circle', role: 'belly',
        cx: 50 + dx * b.halfWidth,
        cy: b.bodyTop + dy * (b.bodyBottom - b.bodyTop),
        r, fill: '#FFFFFF', opacity: 0.62,
      });
    }
  }

  // Owl wings. Crescents that FOLLOW the body outline at low contrast, so the
  // silhouette stays one shape — plus the chest speckles that say "owl" before
  // the beak does.
  if (sp.wings) {
    const t = b.bodyTop + 4;
    const bt = b.bodyBottom - 3;
    out.push(
      { k: 'path', role: 'wing', d: `M${50 - b.halfWidth * 0.82} ${t} C${50 - b.halfWidth * 1.02} ${t + 12} ${50 - b.halfWidth * 0.96} ${bt - 6} ${50 - b.halfWidth * 0.6} ${bt}`, stroke: sp.furDark, sw: 7, fill: 'none', opacity: 0.38 },
      { k: 'path', role: 'wing', d: `M${50 + b.halfWidth * 0.82} ${t} C${50 + b.halfWidth * 1.02} ${t + 12} ${50 + b.halfWidth * 0.96} ${bt - 6} ${50 + b.halfWidth * 0.6} ${bt}`, stroke: sp.furDark, sw: 7, fill: 'none', opacity: 0.38 },
    );
    for (const [dx, dy] of [[-0.3, 0.5], [0.3, 0.5], [0, 0.66], [-0.3, 0.8], [0.3, 0.8]] as const) {
      out.push({
        k: 'ellipse', role: 'belly',
        cx: 50 + dx * b.halfWidth, cy: b.bodyTop + dy * (b.bodyBottom - b.bodyTop),
        rx: 2.2, ry: 1.5, fill: sp.furDark, opacity: 0.3,
      });
    }
  }
  return out;
}

function headShapes(sp: Species, b: Build): Shape[] {
  const out: Shape[] = [
    { k: 'circle', role: 'head', cx: 50, cy: b.headCy, r: b.headR, fill: sp.fur },
  ];

  // The fox's cheek ruffs — two soft tufts at the jawline. They widen the
  // bottom of the head, which is the difference between a fox and a bear cub.
  if (sp.ear === 'pointy' && sp.tail === 'bushy') {
    // Soft fur tufts at the JAW, in the fur colour with a lighter tip. The
    // first pass put cream triangles at eye level, which read as paper darts
    // stuck to the face (device-test-26).
    const ruff = (dir: -1 | 1): Shape[] => {
      const x = 50 + dir * b.headR * 0.78;
      const y = b.headCy + b.headR * 0.42;
      return [
        { k: 'path', role: 'tuft',
          d: `M${x} ${y - 4} Q${x + dir * 9} ${y + 2} ${x + dir * 1.5} ${y + 7} Z`,
          fill: sp.fur },
        { k: 'path', role: 'tuft',
          d: `M${x + dir * 1.5} ${y - 2} Q${x + dir * 7.5} ${y + 2} ${x + dir * 2} ${y + 5} Z`,
          fill: sp.belly, opacity: 0.7 },
      ];
    };
    out.push(...ruff(-1), ...ruff(1));
  }

  // An off-centre curl. One asymmetric mark does more to make this read as a
  // character than any amount of face-tuning.
  if (sp.tuft) {
    // A cowlick, off-centre. The first version closed on itself and read as a
    // metal handle bolted to the skull (device-test-26); this one is a filled
    // tapered flick that starts INSIDE the head outline and thins to a point.
    const cx = 50 - b.headR * 0.24;
    const top = b.headCy - b.headR;
    out.push({
      k: 'path', role: 'tuft',
      d: `M${cx - 4} ${top + 7} Q${cx - 3} ${top - 1} ${cx + 8} ${top - 3.5} Q${cx + 1} ${top + 1.5} ${cx + 4} ${top + 6.5} Z`,
      fill: sp.furDark, opacity: 0.85,
    });
  }

  // Blossom's sprig: one leaf tucked at the side of the crown. Asymmetric, and
  // it is the thing you spot first in a picker row.
  if (sp.petals) {
    out.push({
      k: 'path', role: 'tuft',
      d: `M${50 + b.headR * 0.86} ${b.headCy + 2} Q${50 + b.headR * 1.44} ${b.headCy - 1} ${50 + b.headR * 1.3} ${b.headCy + 9} Q${50 + b.headR * 0.98} ${b.headCy + 6} ${50 + b.headR * 0.86} ${b.headCy + 2} Z`,
      fill: '#6FE6A8', opacity: 0.9,
    });
  }
  return out;
}

function faceShapes(sp: Species, b: Build, expr: Expression): Shape[] {
  const out: Shape[] = [];
  // The face rides the head, so a species with a smaller skull gets a smaller
  // face in the right place rather than a stock face floating on it.
  const R = b.headR;
  const cy = b.headCy;
  const eyeY = cy + R * 0.14;
  const eyeDx = R * 0.72;
  const lx = 50 - eyeDx;
  const rx = 50 + eyeDx;
  const eyeRx = R * 0.265;
  const eyeRyMax = R * 0.32;
  const noseY = cy + R * 0.48;
  const my = cy + R * 0.7;

  const ry = eyeRyMax * expr.eyeOpen;
  // Gaze. The eye is a solid dark dome, so a look is drawn by shifting the
  // whole eye plus its highlights — the catchlight travels further than the
  // eye does, which is what a real highlight does when a head turns.
  const gx = expr.gazeX * 2.9;
  const gy = expr.gazeY * 2.2;
  const hx = expr.gazeX * 1.6;
  const hy = expr.gazeY * 1.2;

  // ─── The owl gets a facial disc, not a snout ───────────────────────
  const beak = sp.face === 'beak';
  if (beak) {
    // A barn owl's face is ONE pale heart-shaped mask covering most of the
    // skull, not two grey discs — the first version read as swimming goggles,
    // and with round ear tufts above it the whole character read as a bear cub
    // for three device rounds (device-test-26). The mask plus the beak now
    // carry the entire identity, and the ear tufts are gone.
    out.push(
      { k: 'path', role: 'belly',
        d: `M50 ${cy - R * 0.86} `
          + `C${50 - R * 0.5} ${cy - R * 1.02} ${50 - R * 0.96} ${cy - R * 0.6} ${50 - R * 0.92} ${cy - R * 0.05} `
          + `C${50 - R * 0.88} ${cy + R * 0.6} ${50 - R * 0.4} ${cy + R * 0.96} 50 ${cy + R * 0.98} `
          + `C${50 + R * 0.4} ${cy + R * 0.96} ${50 + R * 0.88} ${cy + R * 0.6} ${50 + R * 0.92} ${cy - R * 0.05} `
          + `C${50 + R * 0.96} ${cy - R * 0.6} ${50 + R * 0.5} ${cy - R * 1.02} 50 ${cy - R * 0.86} Z`,
        fill: sp.belly, opacity: 0.93 },
      // The dividing crease down the middle of the mask — the one line that
      // says "barn owl" rather than "pale-faced animal".
      { k: 'path', role: 'belly',
        d: `M50 ${cy - R * 0.8} L50 ${cy + R * 0.1}`,
        stroke: sp.furDark, sw: 1.4, opacity: 0.22 },
    );
  } else {
    out.push({ k: 'ellipse', role: 'belly', cx: 50, cy: cy + R * 0.55, rx: R * 0.44, ry: R * 0.33, fill: sp.belly, opacity: 0.5 });
  }

  // Blush is on by DEFAULT now, quietly. Cheeks are free warmth, and a face
  // with none reads as a diagram of a face (device-test-26).
  const blush = Math.max(expr.blush, 0.22);
  out.push(
    { k: 'ellipse', role: 'cheek', cx: 50 - R * 0.68, cy: cy + R * 0.42, rx: R * 0.24, ry: R * 0.15, fill: sp.accent, opacity: blush },
    { k: 'ellipse', role: 'cheek', cx: 50 + R * 0.68, cy: cy + R * 0.42, rx: R * 0.24, ry: R * 0.15, fill: sp.accent, opacity: blush },
  );

  // ─── Brows ─────────────────────────────────────────────────────────
  if (!expr.eyeArc) {
    const l = expr.browTilt + expr.browSkew;
    const r = expr.browTilt - expr.browSkew;
    // On a shut eye the brow sits right on the lid line, and brow + lid +
    // mouth stacked up read as three scratches across the face rather than a
    // sleeping animal (device-test-26). Shut eyes get their brows lifted and
    // quietened.
    const shut = expr.eyeOpen < 0.25;
    const browY = eyeY - eyeRyMax - (shut ? 4.4 : 2.2);
    out.push(
      { k: 'path', role: 'brow',
        d: `M${lx - eyeRx} ${browY - l * 3.6} Q${lx} ${browY - 2 - l * 5.2} ${lx + eyeRx} ${browY - l * 2.2}`,
        stroke: sp.ink, sw: 2.2, fill: 'none', opacity: shut ? 0.42 : 0.62 },
      { k: 'path', role: 'brow',
        d: `M${rx - eyeRx} ${browY - r * 2.2} Q${rx} ${browY - 2 - r * 5.2} ${rx + eyeRx} ${browY - r * 3.6}`,
        stroke: sp.ink, sw: 2.2, fill: 'none', opacity: shut ? 0.42 : 0.62 },
    );
  }

  // ─── Eyes ──────────────────────────────────────────────────────────
  const arc = (cx: number): string => `M${cx - eyeRx} ${eyeY + 1.5} Q${cx} ${eyeY - eyeRyMax} ${cx + eyeRx} ${eyeY + 1.5}`;
  const closed = (cx: number): string => `M${cx - eyeRx} ${eyeY} Q${cx} ${eyeY + 3.5} ${cx + eyeRx} ${eyeY}`;

  const drawArc = (d: string): Shape => ({ k: 'path', role: 'eye', d, stroke: sp.ink, sw: 3.2, fill: 'none' });
  const drawEye = (cx: number): Shape[] => {
    const shapes: Shape[] = [
      { k: 'ellipse', role: 'eye', cx: cx + gx, cy: eyeY + gy, rx: eyeRx, ry, fill: sp.ink },
    ];
    if (expr.eyeOpen > 0.4) {
      // A big soft catchlight plus a small low one. This pair is most of what
      // separates a mammal eye from a compound one — and the big one is now
      // genuinely big, because a pinprick on a wide eye reads as dead.
      const g = 2.25 * expr.pupilScale;
      shapes.push(
        { k: 'circle', role: 'eye-light', cx: cx + gx + hx + 2.1, cy: eyeY + gy + hy - 2.6, r: g, fill: '#FFFFFF', opacity: 0.97 },
        { k: 'circle', role: 'eye-light', cx: cx + gx + hx - 2.3, cy: eyeY + gy + hy + 2.8, r: g * 0.48, fill: '#FFFFFF', opacity: 0.55 },
      );
    }
    return shapes;
  };

  if (expr.eyeArc) {
    out.push(drawArc(arc(lx)), drawArc(arc(rx)));
  } else if (expr.eyeOpen < 0.25) {
    // Shut, not squashed (device-test-26).
    out.push(drawArc(closed(lx)), drawArc(closed(rx)));
  } else if (expr.winkLeft) {
    out.push(drawArc(closed(lx)), ...drawEye(rx));
  } else {
    out.push(...drawEye(lx), ...drawEye(rx));
  }

  // ─── Nose or beak ──────────────────────────────────────────────────
  if (beak) {
    out.push({ k: 'path', role: 'nose', d: `M50 ${noseY - 5} L${50 - R * 0.26} ${noseY - 1} L50 ${noseY + 9} L${50 + R * 0.26} ${noseY - 1} Z`, fill: sp.accent });
    out.push({ k: 'path', role: 'nose', d: `M50 ${noseY - 5} L${50 - R * 0.26} ${noseY - 1} L50 ${noseY + 1.5} Z`, fill: sp.furDark, opacity: 0.32 });
    if (expr.mouthOpen > 0.45) {
      out.push({ k: 'path', role: 'mouth', d: `M${50 - R * 0.15} ${noseY + 2} L${50 + R * 0.15} ${noseY + 2} L50 ${noseY + 9} Z`, fill: sp.ink, opacity: 0.85 });
    }
    if (expr.angerMark) {
      out.push(
        { k: 'path', role: 'anger', d: `M${50 + R * 0.7} ${cy - R * 0.62} L${50 + R * 1.02} ${cy - R * 0.3}`, stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
        { k: 'path', role: 'anger', d: `M${50 + R * 1.02} ${cy - R * 0.62} L${50 + R * 0.7} ${cy - R * 0.3}`, stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
      );
    }
    return out;
  }

  // Nose — a soft rounded triangle, the mammal snout cue.
  out.push({ k: 'path', role: 'nose', d: `M${50 - 3.8} ${noseY} Q50 ${noseY - 1.6} ${50 + 3.8} ${noseY} Q50 ${noseY + 5} ${50 - 3.8} ${noseY} Z`, fill: sp.ink, opacity: 0.92 });

  // The cat gets whiskers. Three a side, thin, low contrast — the one detail
  // that says "cat" when the ears are small.
  if (sp.tail === 'thin' && sp.ear === 'pointy') {
    for (const [i, dy] of [-3, 0, 3].entries()) {
      out.push(
        { k: 'path', role: 'tuft', d: `M${50 - R * 0.34} ${noseY + 1} L${50 - R * 1.06} ${noseY + dy - 1 + i * 0.4}`, stroke: sp.belly, sw: 1.3, opacity: 0.6 },
        { k: 'path', role: 'tuft', d: `M${50 + R * 0.34} ${noseY + 1} L${50 + R * 1.06} ${noseY + dy - 1 + i * 0.4}`, stroke: sp.belly, sw: 1.3, opacity: 0.6 },
      );
    }
  }

  // Mouth, hung off the nose so the whole face reads as one unit.
  const curve = expr.mouthCurve * 6.5;
  const halfW = R * 0.24;
  if (expr.mouthOpen > 0.05) {
    out.push({
      k: 'ellipse', role: 'mouth', cx: 50, cy: my + 1.5,
      rx: 3.6 + 3 * expr.mouthOpen, ry: 2.3 + 4.6 * expr.mouthOpen,
      fill: sp.ink, opacity: 0.9,
    });
    if (expr.mouthOpen > 0.7) {
      // The tongue. Free comedy, and it is what makes a big laugh read as a
      // laugh rather than a shout.
      out.push({ k: 'ellipse', role: 'mouth', cx: 50, cy: my + 4.4, rx: 2.9, ry: 2.1, fill: sp.accent, opacity: 0.95 });
    }
  } else if (expr.mouthShape === 'grit') {
    out.push(
      { k: 'path', role: 'mouth', d: `M${50 - halfW} ${my - 2} L${50 + halfW} ${my - 2} L${50 + halfW} ${my + 2.6} L${50 - halfW} ${my + 2.6} Z`, fill: sp.ink, opacity: 0.9 },
      { k: 'path', role: 'mouth', d: `M${50 - halfW * 0.36} ${my - 2} L${50 - halfW * 0.36} ${my + 2.6}`, stroke: '#FFFFFF', sw: 1.1, opacity: 0.55 },
      { k: 'path', role: 'mouth', d: `M${50 + halfW * 0.36} ${my - 2} L${50 + halfW * 0.36} ${my + 2.6}`, stroke: '#FFFFFF', sw: 1.1, opacity: 0.55 },
    );
  } else if (expr.mouthShape === 'smirk') {
    out.push({
      k: 'path', role: 'mouth',
      d: `M${50 - halfW} ${my + 0.6} Q${50 - halfW * 0.1} ${my + 1.2} ${50 + halfW * 1.1} ${my - 2.4}`,
      stroke: sp.ink, sw: 2.3, fill: 'none', opacity: 0.9,
    });
  } else if (expr.mouthShape === 'wavy') {
    out.push({
      k: 'path', role: 'mouth',
      d: `M${50 - halfW * 1.1} ${my} q${halfW * 0.55} -2.2 ${halfW * 1.1} 0 t${halfW * 1.1} 0`,
      stroke: sp.ink, sw: 2.2, fill: 'none', opacity: 0.9,
    });
  } else {
    // A wide smile with a dimple at each end — the corners are what make a
    // curve read as a mouth instead of a line.
    out.push({
      k: 'path', role: 'mouth',
      d: `M${50 - halfW * 1.15} ${my} Q50 ${my + curve} ${50 + halfW * 1.15} ${my}`,
      stroke: sp.ink, sw: 2.4, fill: 'none', opacity: 0.9,
    });
  }

  if (expr.angerMark) {
    out.push(
      { k: 'path', role: 'anger', d: `M${50 + R * 0.7} ${cy - R * 0.62} L${50 + R * 1.02} ${cy - R * 0.3}`, stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
      { k: 'path', role: 'anger', d: `M${50 + R * 1.02} ${cy - R * 0.62} L${50 + R * 0.7} ${cy - R * 0.3}`, stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
    );
  }
  return out;
}

/**
 * Celebration sparkles — an ARC ABOVE THE HEAD ONLY.
 *
 * Never a ring. The previous version spread up to twelve dots around the full
 * circumference at radius 42, so half of them sat beside and below a round
 * body. Small round things radiating from a round body are legs, and this fired
 * on every celebrate and mindblown state — the single loudest insect signal in
 * the rig.
 */
export function sparkleShapes(count: number, color: string): Shape[] {
  if (count <= 0) return [];
  const n = Math.min(count, 5);
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) {
    // -70°…+70° measured from straight up: a fan over the crown, and nothing
    // lower. At the extremes this still sits above the head's centre line.
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = (-70 + t * 140) * (Math.PI / 180);
    out.push({
      k: 'circle', role: 'sparkle',
      cx: 50 + Math.sin(a) * 32,
      cy: 34 - Math.cos(a) * 32,
      r: 1.7 + (i % 3) * 0.8,
      fill: color, opacity: 0.9,
    });
  }
  return out;
}

/** The lowest y any sparkle may occupy. Asserted by `test:creature`. */
export const SPARKLE_FLOOR_Y = HEAD.cy;

/**
 * Base rotation for each arm, in degrees about the shoulder, per pose.
 *
 * The arms are drawn hanging straight down, so 0 is "at rest by the side" and
 * a negative angle on the left arm swings it outward. The rig adds the idle
 * swing on top of whichever pair it finds here, which is why a companion can
 * hold its hands on its hips and still be visibly breathing.
 */
export const ARM_POSE: Record<ArmPose, readonly [number, number]> = {
  rest: [0, 0],
  up: [133, -133],
  wave: [136, -4],
  chin: [-105, -4],
  hips: [-38, 38],
  cover: [140, -140],
  clap: [-57, 57],
};
