/**
 * Dottie — v3 companion preview
 *
 * Renders the Gemini-cast geometry to a standalone HTML page, on the aurora
 * ground, so the art is reviewed in a browser rather than in a 25-minute APK.
 *
 *     npx tsx scripts/v3-preview.ts    # → docs/companion-v3-preview.html
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { v3Shapes, V3_TYPES, V3_LABEL, type V3Type } from '../src/components/ui/creature/geometry-v3';
import { expressionFor, type CreatureState } from '../src/components/ui/creature/expressions';
import type { Shape } from '../src/components/ui/creature/geometry';

const STATES: CreatureState[] = [
  'idle', 'happy', 'celebrate', 'excited', 'wink', 'smug',
  'curious', 'thinking', 'surprised', 'determined', 'sad', 'sleepy',
];

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
  if (!s.rotate) return '';
  const px = s.k === 'path' ? (s.px ?? 50) : s.cx;
  const py = s.k === 'path' ? (s.py ?? 50) : s.cy;
  return ` transform="rotate(${s.rotate} ${px} ${py})"`;
}

function toSvg(s: Shape): string {
  switch (s.k) {
    case 'circle': return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${attrs(s)}${rotation(s)}/>`;
    case 'ellipse': return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${attrs(s)}${rotation(s)}/>`;
    case 'path': return `<path d="${s.d}" ${attrs(s)}${rotation(s)}/>`;
  }
}

function render(type: V3Type, state: CreatureState, size: number): string {
  const e = expressionFor(state, 1);
  const body = v3Shapes(type, e).map(toSvg).join('');
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><g transform="rotate(${e.tilt} 50 55)">${body}</g></svg>`;
}

const cards = V3_TYPES.map((type) => `
  <section>
    <h2>${V3_LABEL[type]}</h2>
    <div class="hero">${render(type, 'idle', 220)}${render(type, 'happy', 220)}${render(type, 'celebrate', 220)}</div>
    <div class="grid">
      ${STATES.map((s) => `<figure>${render(type, s, 108)}<figcaption>${s}</figcaption></figure>`).join('')}
    </div>
    <div class="tiny">${STATES.slice(0, 6).map((s) => render(type, s, 28)).join('')}
      <span>← 28px, the tab-bar test</span></div>
  </section>`).join('');

const html = `<!doctype html><meta charset="utf-8"><title>Dottie — companions v3</title>
<style>
  body { margin:0; padding:28px; background:#0C0A16; color:#EFE9FF;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  h1 { font-size:20px; margin:0 0 6px; } p.sub { color:#9E93B8; margin:0 0 24px; font-size:13px; }
  section { margin-bottom:34px; padding:18px; border:1px solid rgba(255,255,255,.08); border-radius:18px;
    background:rgba(255,255,255,.03); }
  h2 { font-size:15px; margin:0 0 12px; color:#54E6C8; letter-spacing:.02em; }
  .hero { display:flex; gap:10px; align-items:flex-end; margin-bottom:14px; }
  .grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
  figure { margin:0; text-align:center; background:rgba(255,255,255,.03); border-radius:12px; padding:6px 0 4px; }
  figcaption { font-size:10px; color:#9E93B8; margin-top:2px; }
  .tiny { display:flex; align-items:center; gap:8px; margin-top:14px; color:#9E93B8; font-size:11px; }
</style>
<h1>Companions v3 — the Gemini cast</h1>
<p class="sub">Same data the app draws. Rendered on the aurora ground (#0C0A16).</p>
${cards}`;

const out = resolve(__dirname, '../docs/companion-v3-preview.html');
writeFileSync(out, html, 'utf8');
console.log(`✓ ${out}`);
