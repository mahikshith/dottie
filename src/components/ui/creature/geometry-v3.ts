/**
 * Dottie — companion geometry v3 (the Gemini cast)
 *
 * Three characters drawn to match the reference illustrations the owner chose:
 * a green-and-silver tinkering robot, an orange creature with a huge mane and a
 * teal scarf, and a cosmic creature with a curled tendril and a starfield body.
 *
 * SAME SCHEMA AS `geometry.ts` — plain `Shape[]` in a 100x100 box, limb-tagged
 * so the existing rig swings them. Nothing here knows about React.
 *
 * The art is reviewed in a browser (`npx tsx scripts/v3-preview.ts`), never
 * blind into an APK.
 */

import type { Expression } from './expressions';
import type { Shape } from './geometry';

export type V3Type = 'sprocket' | 'marigold' | 'nova';

export const V3_TYPES: readonly V3Type[] = ['sprocket', 'marigold', 'nova'];

export const V3_LABEL: Record<V3Type, string> = {
  sprocket: 'Sprocket — the tinkerer',
  marigold: 'Marigold — the talker',
  nova: 'Nova — the stargazer',
};

// ─── SHARED FACE ─────────────────────────────────────────────────────

interface FaceCfg {
  /** Eye centres and size. */
  lx: number; rx: number; cy: number; scleraRx: number; scleraRy: number;
  irisR: number; irisFill: string; pupilFill: string;
  browFill: string; browW: number; browLift: number;
  mouthY: number; mouthW: number; mouthFill: string;
  cheekFill: string; cheekDx: number; cheekDy: number;
  /** Draw a white sclera behind the iris (a human-ish eye) or not. */
  sclera: boolean;
}

/** Eyes, brows, mouth and cheeks, driven entirely by the rig's parameters. */
function face(c: FaceCfg, e: Expression): Shape[] {
  const out: Shape[] = [];
  const gx = e.gazeX * 1.9;
  const gy = e.gazeY * 1.5;
  const open = Math.max(0, Math.min(1, e.eyeOpen));

  // Cheeks first — always faintly there, warmer when the expression asks.
  const blush = Math.max(e.blush, 0.25);
  out.push(
    { k: 'ellipse', role: 'cheek', cx: c.lx - c.cheekDx, cy: c.cy + c.cheekDy, rx: 4.2, ry: 2.6, fill: c.cheekFill, opacity: blush },
    { k: 'ellipse', role: 'cheek', cx: c.rx + c.cheekDx, cy: c.cy + c.cheekDy, rx: 4.2, ry: 2.6, fill: c.cheekFill, opacity: blush },
  );

  // Brows. browTilt raises/lowers both; browSkew splits them.
  if (!e.eyeArc) {
    const l = e.browTilt + e.browSkew;
    const r = e.browTilt - e.browSkew;
    const by = c.cy - c.scleraRy - c.browLift;
    out.push(
      { k: 'path', role: 'brow', fill: 'none', stroke: c.browFill, sw: 2.1,
        d: `M${c.lx - c.browW} ${by - l * 3.2} Q${c.lx} ${by - 2.4 - l * 4.6} ${c.lx + c.browW} ${by - l * 1.8}` },
      { k: 'path', role: 'brow', fill: 'none', stroke: c.browFill, sw: 2.1,
        d: `M${c.rx - c.browW} ${by - r * 1.8} Q${c.rx} ${by - 2.4 - r * 4.6} ${c.rx + c.browW} ${by - r * 3.2}` },
    );
  }

  // Eyes.
  const arc = (x: number): Shape => ({
    k: 'path', role: 'eye', fill: 'none', stroke: c.pupilFill, sw: 3,
    d: `M${x - c.scleraRx} ${c.cy + 1.6} Q${x} ${c.cy - c.scleraRy} ${x + c.scleraRx} ${c.cy + 1.6}`,
  });
  const shut = (x: number): Shape => ({
    k: 'path', role: 'eye', fill: 'none', stroke: c.pupilFill, sw: 2.8,
    d: `M${x - c.scleraRx} ${c.cy} Q${x} ${c.cy + 3.2} ${x + c.scleraRx} ${c.cy}`,
  });
  const eye = (x: number): Shape[] => {
    const s: Shape[] = [];
    // The eyeball keeps its size; the LID is what closes (the rig lowers one
    // too, so a shrinking eyeball would read as the head moving away).
    const lidRy = c.scleraRy * (0.35 + 0.65 * open);
    if (c.sclera) {
      s.push({ k: 'ellipse', role: 'eye', cx: x, cy: c.cy, rx: c.scleraRx, ry: lidRy, fill: '#FFFFFF' });
    }
    const ir = c.irisR * (0.9 + 0.2 * e.pupilScale);
    s.push({ k: 'circle', role: 'eye', cx: x + gx, cy: c.cy + gy * 0.8, r: ir, fill: c.irisFill });
    s.push({ k: 'circle', role: 'eye', cx: x + gx, cy: c.cy + gy * 0.8, r: ir * 0.55, fill: c.pupilFill });
    s.push({ k: 'circle', role: 'eye-light', cx: x + gx + ir * 0.45, cy: c.cy + gy * 0.8 - ir * 0.5, r: ir * 0.38, fill: '#FFFFFF', opacity: 0.96 });
    s.push({ k: 'circle', role: 'eye-light', cx: x + gx - ir * 0.5, cy: c.cy + gy * 0.8 + ir * 0.55, r: ir * 0.2, fill: '#FFFFFF', opacity: 0.6 });
    return s;
  };

  if (e.eyeArc) out.push(arc(c.lx), arc(c.rx));
  else if (open < 0.25) out.push(shut(c.lx), shut(c.rx));
  else if (e.winkLeft) out.push(shut(c.lx), ...eye(c.rx));
  else out.push(...eye(c.lx), ...eye(c.rx));

  // Mouth — one curve, four shapes.
  const w = c.mouthW;
  const y = c.mouthY;
  const curve = e.mouthCurve * 5.2;
  if (e.mouthOpen > 0.35) {
    const h = 2.2 + e.mouthOpen * 5;
    out.push(
      { k: 'path', role: 'mouth', fill: c.mouthFill,
        d: `M${50 - w} ${y} Q50 ${y + curve * 0.4} ${50 + w} ${y} Q50 ${y + h} ${50 - w} ${y} Z` },
      { k: 'path', role: 'mouth', fill: '#FF9BB0', opacity: 0.85,
        d: `M${50 - w * 0.5} ${y + h * 0.45} Q50 ${y + h * 1.05} ${50 + w * 0.5} ${y + h * 0.45} Q50 ${y + h * 0.75} ${50 - w * 0.5} ${y + h * 0.45} Z` },
    );
  } else if (e.mouthShape === 'grit') {
    out.push({ k: 'path', role: 'mouth', fill: c.mouthFill, d: `M${50 - w} ${y - 1.4} L${50 + w} ${y - 1.4} L${50 + w} ${y + 1.4} L${50 - w} ${y + 1.4} Z` });
    for (let i = -2; i <= 2; i++) {
      out.push({ k: 'path', role: 'mouth', stroke: '#FFFFFF', sw: 1, d: `M${50 + i * w * 0.4} ${y - 1.4} L${50 + i * w * 0.4} ${y + 1.4}` });
    }
  } else if (e.mouthShape === 'smirk') {
    out.push({ k: 'path', role: 'mouth', fill: 'none', stroke: c.mouthFill, sw: 2.2,
      d: `M${50 - w * 0.6} ${y} Q${50 + w * 0.2} ${y + curve * 0.6} ${50 + w} ${y - 2}` });
  } else if (e.mouthShape === 'wavy') {
    out.push({ k: 'path', role: 'mouth', fill: 'none', stroke: c.mouthFill, sw: 2.2,
      d: `M${50 - w} ${y} Q${50 - w * 0.5} ${y - 2.4} 50 ${y} Q${50 + w * 0.5} ${y + 2.4} ${50 + w} ${y}` });
  } else {
    out.push({ k: 'path', role: 'mouth', fill: 'none', stroke: c.mouthFill, sw: 2.3,
      d: `M${50 - w} ${y - curve * 0.25} Q50 ${y + curve} ${50 + w} ${y - curve * 0.25}` });
  }

  if (e.angerMark) {
    out.push(
      { k: 'path', role: 'anger', stroke: '#FF6B8A', sw: 2.3, d: `M${c.rx + 8} ${c.cy - 11} L${c.rx + 13} ${c.cy - 6}` },
      { k: 'path', role: 'anger', stroke: '#FF6B8A', sw: 2.3, d: `M${c.rx + 13} ${c.cy - 11} L${c.rx + 8} ${c.cy - 6}` },
    );
  }
  return out;
}

/** A contact shadow + two legs, each with a sole and a pad (four foot shapes). */
function legs(opts: {
  hipY: number; footY: number; stance: number; limbW: number;
  legFill: string; soleFill: string; padFill: string; shadow: string;
}): Shape[] {
  const { hipY, footY, stance, limbW } = opts;
  const one = (limb: 'legL' | 'legR', dir: -1 | 1): Shape[] => {
    const hx = 50 + dir * stance * 0.55;
    const fx = 50 + dir * stance;
    return [
      { k: 'path', limb, role: 'leg', stroke: opts.legFill, sw: limbW,
        d: `M${hx} ${hipY} Q${hx} ${footY - 4} ${fx} ${footY - 1}` },
      { k: 'ellipse', limb, role: 'foot', cx: fx, cy: footY + 1.6, rx: limbW * 0.95, ry: limbW * 0.52, fill: opts.soleFill },
      { k: 'ellipse', limb, role: 'foot', cx: fx, cy: footY + 2.2, rx: limbW * 0.5, ry: limbW * 0.26, fill: opts.padFill, opacity: 0.6 },
    ];
  };
  return [
    { k: 'ellipse', role: 'shadow', cx: 50, cy: footY + 5.5, rx: 19, ry: 2.9, fill: opts.shadow, opacity: 0.18 },
    ...one('legL', -1),
    ...one('legR', 1),
  ];
}

/**
 * Two arms from the shoulder joints, each ending in a hand.
 *
 * `spread` is not decoration: the first pass tucked the arms inside the torso
 * outline and, being the same colour as it, they vanished — the character read
 * as a body with two mittens stuck to its sides. An arm has to clear the
 * silhouette to exist.
 */
function arms(opts: {
  shoulderY: number; halfWidth: number; spread: number; handY: number; limbW: number;
  armFill: string; handFill: string;
}): Shape[] {
  const one = (limb: 'armL' | 'armR', dir: -1 | 1): Shape[] => {
    const sx = 50 + dir * (opts.halfWidth - 1.5);
    const hx = 50 + dir * (opts.halfWidth + opts.spread);
    return [
      { k: 'path', limb, role: 'arm', stroke: opts.armFill, sw: opts.limbW,
        d: `M${sx} ${opts.shoulderY} Q${hx} ${opts.shoulderY + 7} ${hx} ${opts.handY}` },
      { k: 'circle', limb, role: 'hand', cx: hx, cy: opts.handY + 1.6, r: opts.limbW * 0.62, fill: opts.handFill },
    ];
  };
  return [...one('armL', -1), ...one('armR', 1)];
}

// ─── 1. SPROCKET — the green-and-silver tinkerer ─────────────────────

const SPROCKET = {
  shell: '#7FC24A', shellDark: '#5B9A2E', metal: '#C2CBD4', metalDark: '#94A0AC',
  visor: '#DCE4EA', ink: '#27331F', strap: '#B79A6E', bag: '#CDB183', gem: '#3FD0C0',
  blush: '#F58CA0',
};

/**
 * A cog: a toothed ring plus its centre hole.
 *
 * The first pass drew six soft points and read as a FLOWER. Teeth are square
 * and there has to be a hole, or it is a daisy behind a robot's head.
 */
function cog(cx: number, cy: number, r: number, teeth: number, fill: string, hole: string): Shape[] {
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.42) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.58) / teeth) * Math.PI * 2;
    const a3 = ((i + 1) / teeth) * Math.PI * 2;
    const p = (a: number, rad: number): string => `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
    d += `${i === 0 ? 'M' : 'L'}${p(a0, r)} L${p(a1, r * 1.32)} L${p(a2, r * 1.32)} L${p(a3, r)} `;
  }
  return [
    { k: 'path', role: 'tuft', d: `${d}Z`, fill },
    { k: 'circle', role: 'tuft', cx, cy, r: r * 0.42, fill: hole },
  ];
}

function sprocketShapes(e: Expression): Shape[] {
  const c = SPROCKET;
  return [
    // Cogs behind the shoulders and head — the prop you read first.
    ...cog(75, 17, 8, 7, c.metalDark, '#0C0A16'),
    ...cog(63, 9, 5, 6, c.shell, '#0C0A16'),
    ...legs({ hipY: 73, footY: 90, stance: 9, limbW: 9, legFill: c.shell, soleFill: c.metalDark, padFill: c.visor, shadow: '#000000' }),
    // Torso: a rounded barrel, narrower than the head.
    { k: 'path', role: 'body', fill: c.shell,
      d: 'M37 52 Q50 48 63 52 Q68 62 66 72 Q58 78 50 78 Q42 78 34 72 Q32 62 37 52 Z' },
    // Metal side panels and a chest plate with vents.
    { k: 'ellipse', role: 'belly', cx: 35.5, cy: 62, rx: 4.4, ry: 9, fill: c.metal },
    { k: 'ellipse', role: 'belly', cx: 64.5, cy: 62, rx: 4.4, ry: 9, fill: c.metal },
    { k: 'ellipse', role: 'belly', cx: 50, cy: 63, rx: 10.5, ry: 10, fill: c.shellDark, opacity: 0.45 },
    { k: 'circle', role: 'belly', cx: 47, cy: 62, r: 1, fill: c.ink, opacity: 0.5 },
    { k: 'circle', role: 'belly', cx: 50, cy: 62, r: 1, fill: c.ink, opacity: 0.5 },
    { k: 'circle', role: 'belly', cx: 53, cy: 62, r: 1, fill: c.ink, opacity: 0.5 },
    // Satchel strap and the bag on the hip — asymmetry, and the prop again.
    { k: 'path', role: 'tuft', stroke: c.strap, sw: 3.2, fill: 'none', d: 'M40 51 Q50 61 62 70' },
    { k: 'path', role: 'tuft', fill: c.bag, d: 'M59 68 Q69 67 71 72 L70 79 Q64 81 58 79 Z' },
    { k: 'path', role: 'tuft', fill: c.gem, d: 'M62 71 L67 71 L64.5 76 Z' },
    ...arms({ shoulderY: 58, halfWidth: 15, spread: 7, handY: 74, limbW: 8.5, armFill: c.shellDark, handFill: c.metal }),
    // Head: a helmet with a silver face plate.
    { k: 'ellipse', role: 'head', cx: 50, cy: 30, rx: 23, ry: 21.5, fill: c.shell },
    { k: 'ellipse', role: 'ear', limb: 'earL', cx: 27.5, cy: 31, rx: 4, ry: 7.5, fill: c.metalDark },
    { k: 'ellipse', role: 'ear', limb: 'earR', cx: 72.5, cy: 31, rx: 4, ry: 7.5, fill: c.metalDark },
    { k: 'ellipse', role: 'belly', cx: 50, cy: 32.5, rx: 17, ry: 15, fill: c.visor },
    { k: 'path', role: 'tuft', fill: c.shellDark, opacity: 0.35, d: 'M33 24 Q50 15 67 24 Q50 20 33 24 Z' },
    ...face({
      lx: 42.5, rx: 57.5, cy: 32.5, scleraRx: 5.6, scleraRy: 6.2, irisR: 3.4,
      irisFill: '#3A4A5A', pupilFill: c.ink, browFill: c.metalDark, browW: 4.6, browLift: 2.4,
      mouthY: 43, mouthW: 5.4, mouthFill: c.ink, cheekFill: c.blush, cheekDx: 6, cheekDy: 5, sclera: true,
    }, e),
  ];
}

// ─── 2. MARIGOLD — the orange one with the mane and the scarf ────────

const MARIGOLD = {
  skin: '#F2A05A', skinDark: '#D97A30', hair: '#F2762A', hairDark: '#D9551A',
  teal: '#2AA9A6', tealDark: '#17807E', cream: '#FFE2C4', ink: '#3B2415', blush: '#FF8FA3',
};

function marigoldShapes(e: Expression): Shape[] {
  const c = MARIGOLD;
  return [
    ...legs({ hipY: 73, footY: 90, stance: 8.5, limbW: 8.5, legFill: c.teal, soleFill: c.tealDark, padFill: c.cream, shadow: '#000000' }),
    // Mane, behind everything — big, lobed, and wider than the head.
    { k: 'path', role: 'tuft', fill: c.hair,
      d: 'M50 11 Q65 8 72 18 Q82 24 78 35 Q81 46 70 49 Q60 55 50 51 Q40 55 30 49 Q19 46 22 35 Q18 24 28 18 Q35 8 50 11 Z' },
    // Torso.
    { k: 'path', role: 'body', fill: c.skin,
      d: 'M39 52 Q50 48 61 52 Q65 62 63 73 Q57 79 50 79 Q43 79 37 73 Q35 62 39 52 Z' },
    { k: 'ellipse', role: 'belly', cx: 50, cy: 65, rx: 9.5, ry: 9, fill: c.cream, opacity: 0.55 },
    // Teal patches — the spots from the reference.
    { k: 'circle', role: 'belly', cx: 41, cy: 59, r: 2.2, fill: c.teal, opacity: 0.85 },
    { k: 'circle', role: 'belly', cx: 60, cy: 63, r: 1.6, fill: c.teal, opacity: 0.85 },
    ...arms({ shoulderY: 58, halfWidth: 14, spread: 7, handY: 74, limbW: 8, armFill: c.skinDark, handFill: c.skin }),
    { k: 'circle', role: 'hand', limb: 'armL', cx: 29, cy: 66, r: 2, fill: c.teal, opacity: 0.85 },
    // The chunky knitted scarf, with one end hanging — the asymmetry.
    { k: 'path', role: 'tuft', fill: c.teal, d: 'M37 50 Q50 57 63 50 Q65 58 50 61 Q35 58 37 50 Z' },
    { k: 'path', role: 'tuft', fill: c.tealDark, d: 'M41 58 L38 72 L46 71 L45 58 Z' },
    // Head.
    { k: 'ellipse', role: 'head', cx: 50, cy: 35, rx: 19, ry: 18.5, fill: c.skin },
    // Fringe over the forehead, with a teal lock — front hair.
    { k: 'path', role: 'tuft', fill: c.hair,
      d: 'M31 33 Q30 18 43 15 Q50 12 58 15 Q71 18 69 33 Q64 24 56 22 Q50 27 43 23 Q36 25 31 33 Z' },
    { k: 'path', role: 'tuft', fill: c.teal, d: 'M60 16 Q68 20 68 30 Q65 22 58 19 Z' },
    ...face({
      lx: 43.5, rx: 56.5, cy: 36.5, scleraRx: 5, scleraRy: 5.8, irisR: 3.1,
      irisFill: '#6B3A1E', pupilFill: c.ink, browFill: c.hairDark, browW: 4.2, browLift: 2.2,
      mouthY: 46, mouthW: 5, mouthFill: c.ink, cheekFill: c.blush, cheekDx: 5.5, cheekDy: 4.5, sclera: true,
    }, e),
  ];
}

// ─── 3. NOVA — the cosmic one ────────────────────────────────────────

const NOVA = {
  top: '#5A7BF0', bottom: '#7A4BD6', deep: '#3A2A8C', crest: '#3B2F9E',
  belly: '#EDE4FF', glow: '#BFD0FF', ink: '#1A1140', bag: '#5E43B8', gem: '#6EE7E7',
  blush: '#FF8FC2',
};

function novaShapes(e: Expression): Shape[] {
  const c = NOVA;
  return [
    // The curled tendril. It rides `earR`, so the rig gives it the delayed
    // swing that ears and tails get — it trails the body by a beat.
    { k: 'path', limb: 'earR', role: 'ear', fill: 'none', stroke: c.bottom, sw: 5.2, px: 62, py: 20,
      d: 'M62 22 Q66 6 76 6 Q86 6 86 15 Q86 22 79 22 Q74 22 74 17 Q74 13 78 13' },
    ...legs({ hipY: 73, footY: 90, stance: 8, limbW: 8, legFill: c.bottom, soleFill: c.deep, padFill: c.glow, shadow: '#000000' }),
    // Teardrop body: narrow at the shoulders, heavy at the base.
    { k: 'path', role: 'body', fill: c.bottom,
      d: 'M38 51 Q50 46 62 51 Q70 62 67 73 Q59 79 50 79 Q41 79 33 73 Q30 62 38 51 Z' },
    { k: 'path', role: 'body', fill: c.top, opacity: 0.75,
      d: 'M38 51 Q50 46 62 51 Q65 58 63 62 Q50 66 37 62 Q35 58 38 51 Z' },
    // Starfield belly.
    { k: 'ellipse', role: 'belly', cx: 50, cy: 66, rx: 11, ry: 9.5, fill: c.belly, opacity: 0.92 },
    { k: 'circle', role: 'belly', cx: 46, cy: 64, r: 0.9, fill: c.deep, opacity: 0.5 },
    { k: 'circle', role: 'belly', cx: 53, cy: 67, r: 0.7, fill: c.deep, opacity: 0.45 },
    { k: 'circle', role: 'belly', cx: 49.5, cy: 70, r: 0.6, fill: c.deep, opacity: 0.4 },
    ...arms({ shoulderY: 58, halfWidth: 14.5, spread: 7, handY: 72, limbW: 8, armFill: c.deep, handFill: c.bottom }),
    // Satchel of crystals on the hip.
    { k: 'path', role: 'tuft', stroke: c.deep, sw: 2.6, fill: 'none', d: 'M41 52 Q50 61 61 68' },
    { k: 'path', role: 'tuft', fill: c.bag, d: 'M58 66 Q68 65 70 70 L69 77 Q63 79 57 77 Z' },
    { k: 'path', role: 'tuft', fill: c.gem, d: 'M61 69 L66 69 L63.5 74 Z' },
    // Head.
    { k: 'ellipse', role: 'head', cx: 50, cy: 31, rx: 22, ry: 20, fill: c.top },
    // Crest fins, rooted INTO the skull (never a nub on a stalk).
    { k: 'path', role: 'tuft', fill: c.crest,
      d: 'M36 18 Q38 8 43 5 Q43 12 45 15 Q48 6 52 3 Q52 11 54 15 Q58 8 62 7 Q60 13 61 18 Z' },
    { k: 'ellipse', role: 'belly', cx: 50, cy: 34, rx: 16, ry: 12, fill: c.glow, opacity: 0.18 },
    ...face({
      lx: 42, rx: 58, cy: 32.5, scleraRx: 6.2, scleraRy: 7, irisR: 4.2,
      irisFill: '#2B2C7A', pupilFill: c.ink, browFill: c.crest, browW: 5, browLift: 2.6,
      mouthY: 44, mouthW: 4.6, mouthFill: c.ink, cheekFill: c.blush, cheekDx: 6.5, cheekDy: 5.5, sclera: true,
    }, e),
  ];
}

// ─── THE ONE ENTRY POINT ─────────────────────────────────────────────

/** Every shape for one v3 companion, in paint order. Pure. */
export function v3Shapes(type: V3Type, e: Expression): Shape[] {
  switch (type) {
    case 'sprocket': return sprocketShapes(e);
    case 'marigold': return marigoldShapes(e);
    case 'nova': return novaShapes(e);
  }
}
