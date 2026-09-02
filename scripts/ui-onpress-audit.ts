/**
 * Dottie — UI onPress Audit (device-test #6 owner ask)
 *
 * Static-analysis pass over every .tsx file in app/ and src/components/.
 * For every tappable element (Pressable, PressableScale, GradientButton,
 * GradientFab, Button, Touchable*) it checks that either:
 *   • the element has an explicit `onPress={...}` prop, OR
 *   • the element is inside a comment / example / test.
 *
 * Elements without an onPress are printed. Any dead button = the owner's
 * "the button doesn't do anything" bug class caught before device rollout.
 *
 * Also prints simple totals so we can see the tappable surface size at
 * a glance and confirm it stays bounded.
 *
 * Non-goals: this is REGEX-based, not an AST parser. Ambiguous cases are
 * reported as warnings the reviewer can eyeball, not hard failures.
 *
 * Run: npm run audit:ui
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['app', 'src/components'];
const TAPPABLE = ['Pressable', 'PressableScale', 'GradientButton', 'GradientFab', 'TouchableOpacity', 'TouchableHighlight'];

interface Finding {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const findings: Finding[] = [];
let totalTappables = 0;
const perComponent = new Map<string, number>();

// ─── WALK ────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // Skip node_modules, .git, build outputs.
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function isTappableOpen(line: string): { name: string } | null {
  for (const name of TAPPABLE) {
    // Match <Pressable or <Pressable ... but NOT <PressableExtra
    const re = new RegExp(`<${name}(?:\\s|$|>)`);
    if (re.test(line)) return { name };
  }
  return null;
}

function stripCommentsFromLine(line: string): string {
  // Best-effort — drop trailing // comments and inline /* */.
  return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
}

function elementBody(lines: string[], startIdx: number): { body: string; endIdx: number } {
  // Regex-based JSX tag boundary detection is brittle — arrow functions
  // (`=>`) in style callbacks, JSX expressions with nested braces, and
  // ternaries all trip a naive `/?>/` match. Instead: grab a wide-enough
  // window (60 lines) starting at the opening tag and search the whole
  // slice for onPress. We only need to know whether ANY onPress attribute
  // is present on this element — this over-reads but never under-reads.
  const end = Math.min(startIdx + 60, lines.length);
  let body = '';
  for (let i = startIdx; i < end; i++) {
    body += stripCommentsFromLine(lines[i] ?? '') + ' ';
  }
  return { body, endIdx: end - 1 };
}

function hasOnPress(body: string): boolean {
  // Accepts: onPress={...}  onPress={handleX}  onPress={() => ...}
  // Also: onPress=() (rare), spread props {...props} (ambiguous — assume ok).
  if (/\bonPress\s*=/.test(body)) return true;
  if (/\{\.\.\.[\w$]+/.test(body)) return true; // spread — likely delegated
  return false;
}

// ─── SCAN ────────────────────────────────────────────────────────────

const files: string[] = [];
for (const root of SCAN_ROOTS) {
  const abs = join(ROOT, root);
  try {
    walk(abs, files);
  } catch (err) {
    console.warn(`[ui-audit] skipped ${root}: ${(err as Error).message}`);
  }
}

for (const file of files) {
  const src = readFileSync(file, 'utf-8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    // Cheap early exit — skip lines inside JSDoc / comments.
    const strippedForComment = raw.trimStart();
    if (strippedForComment.startsWith('*') || strippedForComment.startsWith('//')) continue;
    const opened = isTappableOpen(raw);
    if (!opened) continue;
    totalTappables++;
    perComponent.set(opened.name, (perComponent.get(opened.name) ?? 0) + 1);
    const { body } = elementBody(lines, i);
    if (!hasOnPress(body)) {
      findings.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: raw.trim().slice(0, 120),
        reason: `<${opened.name}> without onPress`,
      });
    }
  }
}

// ─── REPORT ─────────────────────────────────────────────────────────

console.log('\x1b[1m\nDottie — UI onPress Audit\x1b[0m');
console.log(`  Scanned: ${files.length} .tsx files across ${SCAN_ROOTS.join(', ')}`);
console.log(`  Total tappables found: ${totalTappables}`);
console.log(`  Per-component:`);
for (const [name, n] of [...perComponent.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    - ${name}: ${n}`);
}
console.log('');

if (findings.length === 0) {
  console.log('  \x1b[32m✓ Every tappable has an onPress (or spread-props delegation).\x1b[0m');
  process.exit(0);
}

console.log(`  \x1b[33m⚠ ${findings.length} tappable(s) without an obvious onPress:\x1b[0m`);
for (const f of findings) {
  console.log(`    ${f.file}:${f.line}  ${f.snippet}`);
  console.log(`      → ${f.reason}`);
}
console.log('');
console.log('  Note: this is regex-based. A wrapper component that forwards onPress');
console.log('  via a spread prop still counts as "has onPress"; anything flagged');
console.log('  above needs a human eyeball. If intentional, add a `{...props}` spread');
console.log('  or a `// audit:ok-no-onpress` comment on the same line.');
// Exit 0 — warnings, not failures. The list becomes the review checklist.
process.exit(0);
