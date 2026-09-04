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
  armL: [34, 57],
  armR: [66, 57],
  legL: [45.5, 72],
  legR: [54.5, 72],
  tail: [66, 70],
  earL: [42, 22],
  earR: [58, 22],
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
    fur: '#F2914A', furDark: '#C9611F', belly: '#FFF3E6', accent: '#FFD8B8',
    ink: '#2E2438', ear: 'pointy', tail: 'bushy', face: 'muzzle', spots: false, wings: false, petals: false, tuft: true,
  },
  bunny: {
    fur: '#E9E2F5', furDark: '#BCAFD6', belly: '#FFFFFF', accent: '#FFB7CE',
    ink: '#3A3050', ear: 'long', tail: 'puff', face: 'muzzle', spots: false, wings: false, petals: false, tuft: false,
  },
  // `butterfly` keeps its ID so nobody's saved companion breaks, but it is
  // drawn as a DEER. It has soft leaf ears and a forehead tuft — and
  // deliberately NO antler nubs, which is what DT16 got wrong.
  butterfly: {
    fur: '#BCA4FF', furDark: '#8468E0', belly: '#F5F0FF', accent: '#FFD98A',
    ink: '#2E2438', ear: 'leaf', tail: 'none', face: 'muzzle', spots: true, wings: false, petals: false, tuft: true,
  },
  cat: {
    fur: '#6B6486', furDark: '#433D5E', belly: '#EFEBF9', accent: '#FFC98A',
    ink: '#241E36', ear: 'pointy', tail: 'thin', face: 'muzzle', spots: false, wings: false, petals: false, tuft: false,
  },
  owl: {
    fur: '#CFA274', furDark: '#9A7346', belly: '#FBEEDC', accent: '#FFD08A',
    ink: '#3A2A1E', ear: 'tufted', tail: 'none', face: 'beak', spots: false, wings: true, petals: false, tuft: false,
  },
  blossom: {
    fur: '#FF97B6', furDark: '#E76A92', belly: '#FFF2F6', accent: '#FFE08A',
    ink: '#43263A', ear: 'none', tail: 'none', face: 'muzzle', spots: false, wings: false, petals: true, tuft: false,
  },
};

// ─── PROPORTIONS ─────────────────────────────────────────────────────
//
// A chibi build: a big head on a SMALLER body, joined by a visible neck. The
// head is wider than the body at every height, so the silhouette reads
// head → neck → shoulders → belly → feet. The old rig had a body as wide as
// the head directly beneath it, which is a thorax/abdomen and why it read
// as an insect no matter what the face did.

/** Head centre and radius. */
export const HEAD = { cx: 50, cy: 37, r: 22 } as const;
/** Eye centres. 17 apart on a 44-wide head — 0.39, a mammal ratio. */
export const EYE = { lx: 41.5, rx: 58.5, cy: 39.5, rx0: 5.0, ry0: 6.2 } as const;
/** The body's widest half-width, and where it starts and stops. */
export const BODY = { top: 48, bottom: 76, halfWidth: 18 } as const;

/**
 * The body outline. Narrow at the shoulders, widest low, tucked at the base —
 * a pear, not an oval. It is never wider than the head.
 */
const BODY_PATH =
  'M50 48 C40 48 33 55 32 63 C31 71 39 76 50 76 C61 76 69 71 68 63 C67 55 60 48 50 48 Z';

// ─── BUILDING ONE COMPANION ──────────────────────────────────────────

/**
 * Every shape for one companion, in paint order (back to front).
 *
 * Pure: same arguments, same array, always. That is what lets the preview page
 * and the app be the same picture, and what lets the audit reason about it.
 */
export function creatureShapes(type: CompanionType, expr: Expression): Shape[] {
  const sp = SPECIES[type];
  return [
    ...groundShapes(sp),
    ...sparkleShapes(expr.sparkles, sp.accent),
    ...behindShapes(sp),
    ...bodyShapes(sp),
    ...armShapes(sp),
    ...headShapes(sp),
    ...faceShapes(sp, expr),
  ];
}

/**
 * Contact shadow, then the legs.
 *
 * Two legs with two feet, each swinging from its own hip. This is the clearest
 * "not six legs" cue in the whole rig, and until DT18 there were no legs at
 * all — just two detached foot-ellipses under a body that reached the floor.
 */
function groundShapes(sp: Species): Shape[] {
  const leg = (limb: 'legL' | 'legR', hx: number, fx: number): Shape[] => [
    { k: 'path', limb, role: 'leg', d: `M${hx} 72 Q${hx} 80 ${fx} 87`, stroke: sp.fur, sw: 7 },
    { k: 'ellipse', limb, role: 'foot', cx: fx, cy: 89.5, rx: 7, ry: 4, fill: sp.furDark, opacity: 0.95 },
    { k: 'ellipse', limb, role: 'foot', cx: fx, cy: 90, rx: 3.8, ry: 2, fill: sp.belly, opacity: 0.55 },
  ];
  return [
    { k: 'ellipse', role: 'shadow', cx: 50, cy: 93.5, rx: 19, ry: 3, fill: '#000000', opacity: 0.16 },
    ...leg('legL', 45.5, 42),
    ...leg('legR', 54.5, 58),
  ];
}

/**
 * Arms, drawn hanging straight down from the shoulder.
 *
 * The POSE is a rotation about the joint, applied by the rig — so this geometry
 * only ever has to describe one arm, and "hands on hips", "both up", "hand to
 * chin" are all the same two shapes at different angles. That is also what lets
 * the arms keep swinging while they hold a pose.
 */
function armShapes(sp: Species): Shape[] {
  const arm = (limb: 'armL' | 'armR', sx: number, hx: number): Shape[] => [
    { k: 'path', limb, role: 'arm', d: `M${sx} 57 Q${hx} 68 ${hx} 79`, stroke: sp.fur, sw: 6.5 },
    { k: 'circle', limb, role: 'hand', cx: hx, cy: 81.5, r: 4.6, fill: sp.furDark, opacity: 0.95 },
  ];
  return [...arm('armL', 35, 32), ...arm('armR', 65, 68)];
}

/** Tail, petals, ears — everything drawn BEHIND the body and head. */
function behindShapes(sp: Species): Shape[] {
  const out: Shape[] = [];

  // Tail. Always on ONE side: the asymmetry is the point. A perfectly
  // mirror-symmetric creature is read as a bug; one that leans is a character.
  if (sp.tail === 'bushy') {
    out.push({
      k: 'path', role: 'tail',
      d: 'M66 76 C79 80 89 71 87 60 C86 53 79 50 75 55 C71 60 76 65 80 62',
      stroke: sp.fur, sw: 11, fill: 'none', opacity: 1,
    });
    out.push({
      k: 'path', role: 'tail',
      d: 'M86 60 C86 54 80 51 76 55',
      stroke: sp.belly, sw: 8, fill: 'none', opacity: 0.95,
    });
  }
  if (sp.tail === 'thin') {
    out.push({
      k: 'path', role: 'tail',
      d: 'M66 78 C80 79 88 70 85 60 C83 54 78 53 77 58',
      stroke: sp.fur, sw: 5.5, fill: 'none',
    });
  }
  if (sp.tail === 'puff') {
    out.push({ k: 'circle', role: 'tail', cx: 72, cy: 79, r: 7.5, fill: sp.belly, opacity: 0.95 });
  }

  // Petals — a CROWN over the head, not a ring around the whole body. The old
  // version rotated six petals about the body centre, so two of them sat down
  // by the feet and read as legs.
  if (sp.petals) {
    for (const a of [-72, -36, 0, 36, 72]) {
      out.push({
        k: 'ellipse', role: 'petal',
        cx: 50 + Math.sin((a * Math.PI) / 180) * 20,
        cy: 37 - Math.cos((a * Math.PI) / 180) * 20,
        rx: 10, ry: 13, fill: sp.fur, opacity: 0.97, rotate: a,
      });
    }
  }

  out.push(...earShapes(sp));
  return out;
}

function earShapes(sp: Species): Shape[] {
  switch (sp.ear) {
    case 'pointy':
      // Rooted low on the head and rounded at the tip, so they read as ears
      // rather than horns. Inner ear in accent, offset slightly inward.
      return [
        { k: 'path', role: 'ear', d: 'M33 24 Q28 8 45 17 Z', fill: sp.fur },
        { k: 'path', role: 'ear', d: 'M67 24 Q72 8 55 17 Z', fill: sp.fur },
        { k: 'path', role: 'ear', d: 'M35 23 Q32 13 43 18 Z', fill: sp.accent, opacity: 0.7 },
        { k: 'path', role: 'ear', d: 'M65 23 Q68 13 57 18 Z', fill: sp.accent, opacity: 0.7 },
      ];
    case 'long':
      return [
        { k: 'ellipse', role: 'ear', cx: 41, cy: 13, rx: 6.2, ry: 13.5, fill: sp.fur, rotate: -11 },
        { k: 'ellipse', role: 'ear', cx: 59, cy: 12, rx: 6.2, ry: 13.5, fill: sp.fur, rotate: 14 },
        { k: 'ellipse', role: 'ear', cx: 41, cy: 14, rx: 3, ry: 9, fill: sp.accent, opacity: 0.8, rotate: -11 },
        { k: 'ellipse', role: 'ear', cx: 59, cy: 13, rx: 3, ry: 9, fill: sp.accent, opacity: 0.8, rotate: 14 },
      ];
    case 'leaf':
      // A doe's ears: big, tall ovals swept OUT to the sides, well clear of the
      // skull. The first attempt kept them small and close, which just read as
      // cat ears in a different colour. Deliberately no nubs above the crown —
      // that was the DT16 antenna.
      return [
        { k: 'ellipse', role: 'ear', cx: 25, cy: 27, rx: 8, ry: 14, fill: sp.fur, rotate: -52 },
        { k: 'ellipse', role: 'ear', cx: 75, cy: 26, rx: 8, ry: 14, fill: sp.fur, rotate: 48 },
        { k: 'ellipse', role: 'ear', cx: 26, cy: 27, rx: 4, ry: 8.5, fill: sp.accent, opacity: 0.7, rotate: -52 },
        { k: 'ellipse', role: 'ear', cx: 74, cy: 26, rx: 4, ry: 8.5, fill: sp.accent, opacity: 0.7, rotate: 48 },
      ];
    case 'tufted':
      // Horned-owl tufts: broad, soft, and overlapping the skull so they merge
      // into the head outline. Narrow spikes on a round head are antennae.
      return [
        { k: 'ellipse', role: 'ear', cx: 35, cy: 20, rx: 9, ry: 7, fill: sp.fur, rotate: -26 },
        { k: 'ellipse', role: 'ear', cx: 65, cy: 20, rx: 9, ry: 7, fill: sp.fur, rotate: 26 },
      ];
    default:
      return [];
  }
}

function bodyShapes(sp: Species): Shape[] {
  const out: Shape[] = [
    { k: 'path', role: 'body', d: BODY_PATH, fill: sp.fur },
    { k: 'ellipse', role: 'belly', cx: 50, cy: 71, rx: 12.5, ry: 12, fill: sp.belly, opacity: 0.92 },
  ];

  // Fawn spots — scattered, uneven, and only on one flank. Two jobs: it says
  // "deer" faster than any silhouette change can, and the lopsided placement
  // breaks the mirror symmetry that made every one of these read as a bug.
  if (sp.spots) {
    for (const [cx, cy, r] of [[37, 60, 2.7], [35, 70, 2.2], [41, 78, 1.9], [64, 63, 2.4], [66, 73, 1.8]] as const) {
      out.push({ k: 'circle', role: 'belly', cx, cy, r, fill: sp.belly, opacity: 0.8 });
    }
  }

  // Owl wings. Crescents that FOLLOW the body outline at low contrast, so the
  // silhouette stays one shape. The old pair were hard 85%-opacity ellipses
  // standing off the midline — two mirrored dark limbs, which is the read we
  // are trying to kill.
  if (sp.wings) {
    out.push(
      { k: 'path', role: 'wing', d: 'M35 55 C30 62 30 74 36 83', stroke: sp.furDark, sw: 6, fill: 'none', opacity: 0.32 },
      { k: 'path', role: 'wing', d: 'M65 55 C70 62 70 74 64 83', stroke: sp.furDark, sw: 6, fill: 'none', opacity: 0.32 },
    );
  }
  return out;
}

function headShapes(sp: Species): Shape[] {
  const out: Shape[] = [
    { k: 'circle', role: 'head', cx: HEAD.cx, cy: HEAD.cy, r: HEAD.r, fill: sp.fur },
  ];
  // An off-centre curl. One asymmetric mark does more to make this read as a
  // character than any amount of face-tuning.
  if (sp.tuft) {
    out.push({
      k: 'path', role: 'tuft',
      d: 'M45 16 C43 9 50 6 53 11',
      stroke: sp.furDark, sw: 3.4, fill: 'none', opacity: 0.85,
    });
  }
  return out;
}

function faceShapes(sp: Species, expr: Expression): Shape[] {
  const out: Shape[] = [];
  const ry = EYE.ry0 * expr.eyeOpen;
  // Gaze. The eye is a solid dark dome, so a look is drawn by shifting the
  // whole eye plus its highlights a little — enough to read as "looking over
  // there" at 28px, not so far it detaches from the socket.
  // These multipliers were half this to begin with and the look was invisible
  // at any size: the eye is a solid dome that fills its socket, so shifting it
  // a unit changes nothing you can see. The catchlight carries most of it —
  // it travels further than the eye does, which is what a real highlight does
  // when a head turns.
  const gx = expr.gazeX * 2.9;
  const gy = expr.gazeY * 2.2;
  const hx = expr.gazeX * 1.6;
  const hy = expr.gazeY * 1.2;

  // ─── The owl gets a facial disc, not a snout ───────────────────────
  //
  // The first pass gave every species the mammal muzzle, so the owl came out
  // as a small bear with the right ears. An owl is read from two things: the
  // flat disc around the eyes and the beak between them.
  const beak = sp.face === 'beak';
  if (beak) {
    out.push(
      { k: 'circle', role: 'belly', cx: EYE.lx - 0.5, cy: EYE.cy - 0.5, r: 11.5, fill: sp.belly, opacity: 0.55 },
      { k: 'circle', role: 'belly', cx: EYE.rx + 0.5, cy: EYE.cy - 0.5, r: 11.5, fill: sp.belly, opacity: 0.55 },
    );
  } else {
    out.push({ k: 'ellipse', role: 'belly', cx: 50, cy: 48.5, rx: 10, ry: 7.5, fill: sp.belly, opacity: 0.5 });
  }

  if (expr.blush > 0.02) {
    out.push(
      { k: 'ellipse', role: 'cheek', cx: 34.5, cy: 47.5, rx: 5.2, ry: 3.2, fill: sp.accent, opacity: expr.blush },
      { k: 'ellipse', role: 'cheek', cx: 65.5, cy: 47.5, rx: 5.2, ry: 3.2, fill: sp.accent, opacity: expr.blush },
    );
  }

  // ─── Brows ─────────────────────────────────────────────────────────
  //
  // Short, close above the eye, low contrast. The old ones were long floating
  // strokes high on the skull, which read as antenna roots. `browSkew` tilts
  // the two independently — one up, one down is the whole of "confused", and
  // it is the cheapest expression in the rig.
  if (!expr.eyeArc) {
    const l = expr.browTilt + expr.browSkew;
    const r = expr.browTilt - expr.browSkew;
    out.push(
      {
        k: 'path', role: 'brow',
        d: `M37 ${31.5 - l * 3.6} Q41.5 ${29.5 - l * 5.2} 46 ${31 - l * 2.2}`,
        stroke: sp.ink, sw: 1.9, fill: 'none', opacity: 0.6,
      },
      {
        k: 'path', role: 'brow',
        d: `M54 ${31 - r * 2.2} Q58.5 ${29.5 - r * 5.2} 63 ${31.5 - r * 3.6}`,
        stroke: sp.ink, sw: 1.9, fill: 'none', opacity: 0.6,
      },
    );
  }

  // ─── Eyes ──────────────────────────────────────────────────────────
  const arcL = `M36 41 Q41.5 34.5 47 41`;
  const arcR = `M53 41 Q58.5 34.5 64 41`;
  const closedL = `M36.5 40 Q41.5 43.5 46.5 40`;
  const closedR = `M53.5 40 Q58.5 43.5 63.5 40`;

  const drawArc = (d: string): Shape => ({
    k: 'path', role: 'eye', d, stroke: sp.ink, sw: 3, fill: 'none',
  });
  const drawEye = (cx: number): Shape[] => {
    const shapes: Shape[] = [
      { k: 'ellipse', role: 'eye', cx: cx + gx, cy: EYE.cy + gy, rx: EYE.rx0, ry, fill: sp.ink },
    ];
    if (expr.eyeOpen > 0.4) {
      // A big soft catchlight plus a small low one. This pair is most of what
      // separates a mammal eye from a compound one — a flat black dome with a
      // pinprick highlight is how a fly gets drawn.
      const g = 2.0 * expr.pupilScale;
      shapes.push(
        { k: 'circle', role: 'eye-light', cx: cx + gx + hx + 1.7, cy: EYE.cy + gy + hy - 2.1, r: g, fill: '#FFFFFF', opacity: 0.96 },
        { k: 'circle', role: 'eye-light', cx: cx + gx + hx - 1.9, cy: EYE.cy + gy + hy + 2.3, r: g * 0.5, fill: '#FFFFFF', opacity: 0.5 },
      );
    }
    return shapes;
  };

  if (expr.eyeArc) {
    out.push(drawArc(arcL), drawArc(arcR));
  } else if (expr.winkLeft) {
    // One eye shut, the other wide. Asymmetry in the face, which is exactly
    // what a symmetric round creature needs to stop reading as a specimen.
    out.push(drawArc(closedL), ...drawEye(EYE.rx));
  } else {
    out.push(...drawEye(EYE.lx), ...drawEye(EYE.rx));
  }

  // ─── Nose or beak ──────────────────────────────────────────────────
  if (beak) {
    // A short hooked beak in the accent colour, sitting between the discs.
    out.push({ k: 'path', role: 'nose', d: 'M50 43.5 L45.6 46.2 L50 53.5 L54.4 46.2 Z', fill: sp.accent });
    out.push({ k: 'path', role: 'nose', d: 'M50 43.5 L45.6 46.2 L50 47.4 Z', fill: sp.furDark, opacity: 0.35 });
    // An open beak IS the owl's open mouth — no separate mouth shape.
    if (expr.mouthOpen > 0.45) {
      out.push({ k: 'path', role: 'mouth', d: 'M46.4 48.6 L53.6 48.6 L50 56 Z', fill: sp.ink, opacity: 0.85 });
    }
    if (expr.angerMark) {
      out.push(
        { k: 'path', role: 'anger', d: 'M68 24 L76 32', stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
        { k: 'path', role: 'anger', d: 'M76 24 L68 32', stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
      );
    }
    return out;
  }

  // Nose — a soft rounded triangle, the mammal snout cue.
  out.push({ k: 'path', role: 'nose', d: 'M46.6 46 Q50 44.6 53.4 46 Q50 50.4 46.6 46 Z', fill: sp.ink, opacity: 0.9 });

  // Mouth, hung off the nose so the whole face reads as one unit.
  const my = 51.5;
  const curve = expr.mouthCurve * 6;
  if (expr.mouthOpen > 0.05) {
    out.push({
      k: 'ellipse', role: 'mouth', cx: 50, cy: my + 1.5,
      rx: 3.4 + 2.6 * expr.mouthOpen, ry: 2.2 + 4.2 * expr.mouthOpen,
      fill: sp.ink, opacity: 0.88,
    });
    if (expr.mouthOpen > 0.7) {
      out.push({ k: 'ellipse', role: 'mouth', cx: 50, cy: my + 4, rx: 2.6, ry: 1.9, fill: sp.accent, opacity: 0.95 });
    }
  } else if (expr.mouthShape === 'grit') {
    // A clenched grimace. Not a frown — a frown is sad, and being fed up with
    // a hard question is not the same as being sad about it.
    out.push(
      { k: 'path', role: 'mouth', d: `M43.5 ${my - 2} L56.5 ${my - 2} L56.5 ${my + 2.6} L43.5 ${my + 2.6} Z`, fill: sp.ink, opacity: 0.9 },
      { k: 'path', role: 'mouth', d: `M47.3 ${my - 2} L47.3 ${my + 2.6}`, stroke: '#FFFFFF', sw: 1.1, opacity: 0.55 },
      { k: 'path', role: 'mouth', d: `M52.7 ${my - 2} L52.7 ${my + 2.6}`, stroke: '#FFFFFF', sw: 1.1, opacity: 0.55 },
    );
  } else if (expr.mouthShape === 'smirk') {
    // Lopsided on purpose: one corner up, the other flat. Half of "annoyed"
    // and all of "smug" is in this one asymmetric stroke.
    out.push({
      k: 'path', role: 'mouth',
      d: `M44.5 ${my + 0.6} Q49.5 ${my + 1.2} 56 ${my - 2.4}`,
      stroke: sp.ink, sw: 2.2, fill: 'none', opacity: 0.9,
    });
  } else if (expr.mouthShape === 'wavy') {
    out.push({
      k: 'path', role: 'mouth',
      d: `M44 ${my} q2.9 -2.2 5.8 0 t5.8 0`,
      stroke: sp.ink, sw: 2.1, fill: 'none', opacity: 0.9,
    });
  } else {
    out.push({
      k: 'path', role: 'mouth',
      d: `M44.5 ${my} Q50 ${my + curve} 55.5 ${my}`,
      stroke: sp.ink, sw: 2.2, fill: 'none', opacity: 0.9,
    });
  }

  // The cross-vein. Comic shorthand for "argh", and it reads at any size.
  if (expr.angerMark) {
    out.push(
      { k: 'path', role: 'anger', d: 'M68 24 L76 32', stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
      { k: 'path', role: 'anger', d: 'M76 24 L68 32', stroke: '#FF6B8A', sw: 2.4, opacity: 0.9 },
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
      cx: 50 + Math.sin(a) * 30,
      cy: 37 - Math.cos(a) * 30,
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
  rest: [2, -2],
  up: [137, -137],
  wave: [139, -5],
  chin: [-103, -5],
  hips: [-34, 34],
  cover: [142, -142],
  clap: [-52, 52],
};
