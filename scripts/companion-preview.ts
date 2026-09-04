/**
 * Dottie — companion preview page
 *
 * Renders every companion in every expression to a standalone HTML file you can
 * open in a browser.
 *
 * ─── WHY ────────────────────────────────────────────────────────────
 *
 *  The companions were reported as looking like insects in three separate
 *  device rounds. Every fix was reasoned about rather than looked at, because
 *  the art lived inside a React Native component and the only renderer was a
 *  phone at the end of a 25-minute APK build. That is a terrible loop for
 *  drawing, and it is why the same complaint kept coming back — the DT16 pass
 *  even added antenna-shaped nubs to the deer without anyone seeing it.
 *
 *  The art is data now (`src/components/ui/creature/geometry.ts`). This script
 *  maps that same data to SVG in a page. What you review here is exactly what
 *  the app draws, because there is only one copy of the numbers.
 *
 *      npx tsx scripts/companion-preview.ts
 *      # → docs/companion-preview.html
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { creatureShapes, SPECIES, JOINTS, ARM_POSE, type Limb, type Shape } from '../src/components/ui/creature/geometry';
import { expressionFor, type CreatureState } from '../src/components/ui/creature/expressions';
import type { CompanionType } from '../src/types/content.types';

const TYPES: CompanionType[] = ['fox', 'bunny', 'butterfly', 'cat', 'owl', 'blossom'];
/** Every state, grouped roughly bright → thoughtful → rough. */
const STATES: CreatureState[] = [
  'idle', 'happy', 'proud', 'celebrate', 'mindblown', 'excited', 'laugh', 'cheer',
  'wink', 'smug', 'love', 'shy', 'relieved',
  'curious', 'thinking', 'confused', 'surprised', 'determined',
  'caring', 'worried', 'annoyed', 'frustrated', 'sulky', 'queasy', 'sad', 'sleepy',
];

/** Display names — `butterfly` is drawn as a deer, so say so on the page. */
const LABEL: Record<CompanionType, string> = {
  fox: 'Fox', bunny: 'Bunny', butterfly: 'Deer (id: butterfly)',
  cat: 'Cat', owl: 'Owl', blossom: 'Blossom',
};

// ─── SHAPE → SVG ─────────────────────────────────────────────────────

function attrs(s: Shape): string {
  const a: string[] = [];
  if (s.fill !== undefined) a.push(`fill="${s.fill}"`);
  else if (s.stroke) a.push('fill="none"');
  if (s.stroke) a.push(`stroke="${s.stroke}" stroke-linecap="round" stroke-linejoin="round"`);
  if (s.sw !== undefined) a.push(`stroke-width="${s.sw}"`);
  if (s.opacity !== undefined) a.push(`opacity="${s.opacity}"`);
  return a.join(' ');
}

function rotation(s: Shape): string {
  if (s.rotate === undefined || s.rotate === 0) return '';
  const px = s.k === 'path' ? (s.px ?? 50) : s.cx;
  const py = s.k === 'path' ? (s.py ?? 50) : s.cy;
  return ` transform="rotate(${s.rotate} ${px} ${py})"`;
}

function toSvg(s: Shape): string {
  switch (s.k) {
    case 'circle':
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${attrs(s)}${rotation(s)}/>`;
    case 'ellipse':
      return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs(s)}${rotation(s)}/>`;
    case 'path':
      return `<path d="${s.d}" ${attrs(s)}${rotation(s)}/>`;
  }
}

function render(type: CompanionType, state: CreatureState, size: number): string {
  const expr = expressionFor(state, 1);
  const shapes = creatureShapes(type, expr);
  // The app tilts the whole body by `expr.tilt` in the Reanimated rig, so the
  // page has to as well — a head-cock is most of what "curious" and "confused"
  // are, and a preview that renders everything bolt upright is lying about the
  // pose it is meant to be reviewing.
  // Limbs rotate about their joints, exactly as the rig does on device — the
  // page must show the POSE (hands on hips, both arms up) or it is reviewing a
  // creature the app never draws. Only the idle swing on top is missing here.
  const [armL, armR] = ARM_POSE[expr.armPose];
  const angle = (limb: Limb): number =>
    limb === 'armL' ? armL : limb === 'armR' ? armR : 0;

  const body: string[] = [];
  let i = 0;
  while (i < shapes.length) {
    const limb = shapes[i]!.limb ?? null;
    const run: Shape[] = [];
    while (i < shapes.length && (shapes[i]!.limb ?? null) === limb) run.push(shapes[i++]!);
    const inner = run.map(toSvg).join('');
    if (limb) {
      const [ox, oy] = JOINTS[limb];
      body.push(`<g transform="rotate(${angle(limb)} ${ox} ${oy})">${inner}</g>`);
    } else {
      body.push(inner);
    }
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${type} ${state}"><g transform="rotate(${expr.tilt} 50 62)">${body.join('')}</g></svg>`;
}

// ─── THE PAGE ────────────────────────────────────────────────────────

const cells = TYPES.map((t) => {
  const row = STATES.map(
    (st) => `<figure class="cell">${render(t, st, 104)}<figcaption>${st}</figcaption></figure>`,
  ).join('');
  return `<section class="species">
      <h2><span class="sw" style="background:${SPECIES[t].fur}"></span>${LABEL[t]}</h2>
      <div class="row">${row}</div>
    </section>`;
}).join('');

const hero = TYPES.map(
  (t) => `<figure class="cell big">${render(t, 'happy', 150)}<figcaption>${LABEL[t]}</figcaption></figure>`,
).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dottie companions</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:24px; background:#0C0A16; color:#EDE9F7;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  p.sub { color:#9C93B8; margin:0 0 24px; max-width:60ch; }
  .species { margin-bottom:28px; }
  h2 { font-size:14px; letter-spacing:.4px; text-transform:uppercase; color:#9C93B8;
       display:flex; align-items:center; gap:8px; margin:0 0 8px; }
  .sw { width:12px; height:12px; border-radius:4px; display:inline-block; }
  .row { display:flex; gap:10px; overflow-x:auto; padding-bottom:6px; }
  .cell { margin:0; flex:0 0 auto; text-align:center;
          background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
          border-radius:16px; padding:8px 6px 6px; }
  .cell.big { padding:12px; }
  figcaption { font-size:11px; color:#9C93B8; margin-top:2px; }
  .heroRow { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:32px; }
  .note { border-left:2px solid #54E6C8; padding-left:12px; color:#9C93B8; margin:24px 0; }
  .note b { color:#EDE9F7; }
</style></head><body>
<h1>Dottie companions</h1>
<p class="sub">Rendered straight from <code>src/components/ui/creature/geometry.ts</code> — the same
numbers the app draws. On the phone these also bob, sway, squash and blink; this page is the pose.</p>

<div class="heroRow">${hero}</div>

<div class="note"><b>What changed.</b> Sparkles were a full ring of up to twelve dots around the
whole body — they are now a fan of five over the crown. Eyes were wide-set black domes; they are
closer in with a real catchlight. Head and body were the same width and concentric — there is a neck
and a narrower pear body now, plus two planted feet. The owl's two hard dark flanking ellipses are
low-contrast crescents that hug the outline. The deer's antler nubs are gone entirely — those were
antennae. Fox, cat and bunny gained tails so the shape is no longer mirror-symmetric.</div>

${cells}
</body></html>`;

const out = resolve(__dirname, '../docs/companion-preview.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, 'utf8');
console.log(`companion preview → ${out}`);
console.log(`${TYPES.length} companions × ${STATES.length} states`);
