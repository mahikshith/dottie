/**
 * Dottie — Safe-area audit
 *
 * Fails the build if a scrolling screen can have its content eaten by the OS
 * status bar or the gesture bar.
 *
 * ─── WHY THIS IS A SCRIPT AND NOT A REVIEW NOTE ─────────────────────
 *
 *  "The top and the bottom are cutting my UI" has now been reported in
 *  device tests 3, 6, 7 and 16. Each round it was fixed on the screens in the
 *  screenshots, and each round the screens nobody screenshotted stayed broken —
 *  at the last count, TWENTY of them. A per-screen fix for a per-screen rule
 *  will always drift; the rule has to be enforced over the whole directory.
 *
 * ─── THE RULE ───────────────────────────────────────────────────────
 *
 *  A screen that scrolls must pad BOTH ends:
 *
 *    top    — `insets.top`, unless a navigation header supplies it
 *             (headerShown, or the screen lives in a route group whose
 *             _layout renders headers).
 *    bottom — `insets.bottom`, always. A tab screen adds
 *             `Spacing.tabBarClearance` on top of it so the floating pill
 *             never covers the last card.
 *
 *  Content passing UNDER the status bar while scrolling is fine and expected —
 *  the owner said so explicitly. What is not fine is content that starts
 *  clipped, or that gets dimmed or cut in the middle of the screen.
 *
 * Run: npm run audit:safearea
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Does the route group this file sits in render navigation headers? */
function groupProvidesHeader(file: string): boolean {
  let dir = dirname(file);
  while (dir.startsWith(APP)) {
    const layout = join(dir, '_layout.tsx');
    if (existsSync(layout) && layout !== file) {
      const src = readFileSync(layout, 'utf8');
      // A layout that explicitly hides headers does NOT supply the inset.
      if (/headerShown:\s*false/.test(src)) return false;
      // A Stack with header styling and no headerShown:false shows headers.
      if (/<Stack\b/.test(src) && /header(Style|TintColor|TitleStyle)/.test(src)) return true;
    }
    if (dir === APP) break;
    dir = dirname(dir);
  }
  return false;
}

interface Finding {
  file: string;
  problems: string[];
}

const findings: Finding[] = [];
let scanned = 0;

/**
 * Does this file pad the SCROLLER, rather than merely mentioning insets?
 *
 * ─── WHY THIS IS NOT A TEXT SEARCH ANY MORE (device-test-19) ────────
 *
 *  The first version asked "does the string `insets.bottom` appear in this
 *  file". Every screen passed, and the owner reported clipped content in DT19
 *  anyway — because a screen can reference `insets.bottom` in a pinned footer,
 *  a header, or a comment, and still hand its ScrollView no padding at all.
 *  The audit was measuring the wrong thing and reporting green, which is worse
 *  than not existing: it made the bug look fixed for four rounds.
 *
 *  So it now looks specifically at what is passed to `contentContainerStyle`
 *  (or a `contentContainer`-named style) and requires the inset to appear
 *  INSIDE it.
 */
function paddedScroller(src: string, which: 'top' | 'bottom'): boolean {
  const inset = which === 'top' ? 'insets.top' : 'insets.bottom';
  // Inline contentContainerStyle={{ ... }} / ={[ ... ]}
  for (const m of src.matchAll(/contentContainerStyle=\{([\s\S]{0,600}?)\}\s*(?:\n|\r|[a-zA-Z>])/g)) {
    if (m[1]!.includes(inset)) return true;
  }
  // contentContainerStyle={styles.foo} → look the style up in the sheet.
  for (const m of src.matchAll(/contentContainerStyle=\{(?:\[)?\s*styles\.([A-Za-z0-9_]+)/g)) {
    const name = m[1]!;
    const decl = new RegExp(`\\n\\s*${name}:\\s*\\{[\\s\\S]*?\\n\\s*\\},`).exec(src);
    if (decl && decl[0].includes(inset)) return true;
  }
  return false;
}

/**
 * Pinned bars that do NOT clear the gesture bar on their own element.
 *
 * A StyleSheet is created outside the component, so it can never reference
 * `insets` — which means a bar styled only from the sheet is ALWAYS under the
 * Android nav bar. The check therefore has to be scoped to the element: it is
 * not enough for `insets.bottom` to appear somewhere in the file, which is
 * exactly how `add-member.tsx` shipped a half-visible "Next" button while this
 * audit reported green (device-test-19).
 */
const PINNED = /(footer|actionBar|bottomBar|ctaBar|stickyBar)/i;

/**
 * Is this style actually a BAR, or just something named "footer"?
 *
 * A pinned bar declares its own bottom padding or is absolutely positioned.
 * Leaf styles inside a card — footerText, postFooterCount — do neither, and
 * flagging them would bury the three real findings in noise, which is how an
 * audit stops being read.
 */
function declaresBar(src: string, name: string): boolean {
  const decl = new RegExp(`\\n\\s*${name}:\\s*\\{[\\s\\S]*?\\n\\s*\\},`).exec(src);
  if (!decl) return false;
  return /paddingBottom|position:\s*'absolute'/.test(decl[0]);
}

function unpaddedPinnedBars(src: string): string[] {
  const bad: string[] = [];
  for (const m of src.matchAll(/style=\{(\[[\s\S]{0,400}?\]|[^}]{0,200}?)\}/g)) {
    const expr = m[1]!;
    const named = /styles\.([A-Za-z0-9_]+)/.exec(expr);
    if (!named || !PINNED.test(named[1]!)) continue;
    if (!declaresBar(src, named[1]!)) continue;
    if (!/insets\.bottom/.test(expr)) bad.push(named[1]!);
  }
  return [...new Set(bad)];
}

for (const file of walk(APP)) {
  const rel = file.slice(ROOT.length + 1);
  if (basename(file) === '_layout.tsx') continue;
  const src = readFileSync(file, 'utf8');

  const scrolls = /<ScrollView|<FlatList|<SectionList/.test(src);
  if (!scrolls) continue;
  scanned++;

  const problems: string[] = [];
  const hasOwnHeader = /headerShown:\s*true/.test(src);
  const headed = hasOwnHeader || groupProvidesHeader(file);

  // Two legitimate patterns exist in this codebase and the audit must know
  // both, or it trades false greens for false reds:
  //   A. the scroller pads itself via contentContainerStyle;
  //   B. a wrapper pads the top and a PINNED footer clears the bottom.
  // What is never acceptable is merely MENTIONING an inset — that is what the
  // first version checked, and it is why this passed for four rounds while the
  // owner kept photographing clipped screens.
  const topPadded = paddedScroller(src, 'top') || /paddingTop:\s*insets\.top/.test(src);
  const bottomPadded =
    paddedScroller(src, 'bottom') || /paddingBottom:\s*insets\.bottom/.test(src);

  if (!headed && !topPadded) {
    problems.push(
      'nothing applies insets.top — no header, no padded wrapper, no scroller padding'
    );
  }
  if (!bottomPadded) {
    problems.push(
      'nothing applies insets.bottom — the last item runs into the gesture bar'
    );
  }
  // A tab screen needs clearance for the floating pill on top of the inset.
  if (rel.includes('(tabs)') && !/tabBarClearance|tabBarHeight/.test(src)) {
    problems.push('tab screen without tab-bar clearance — the pill covers the last card');
  }
  // A pinned bar sits OUTSIDE the scroller, so scroll padding cannot save it.
  for (const name of unpaddedPinnedBars(src)) {
    problems.push(
      `pinned bar \`styles.${name}\` has no insets.bottom on its own element — it sits under the nav bar`
    );
  }

  if (problems.length > 0) findings.push({ file: rel, problems });
}

console.log(`\n\x1b[1mSafe-area audit\x1b[0m`);
console.log(`  scrolling screens scanned: ${scanned}`);

if (findings.length === 0) {
  console.log(`\n\x1b[32m✓ every scrolling screen pads both ends.\x1b[0m\n`);
  process.exit(0);
}

console.log(`\n\x1b[31m✗ ${findings.length} screen(s) can have content eaten:\x1b[0m`);
for (const f of findings) {
  console.log(`\n  \x1b[1m${f.file}\x1b[0m`);
  for (const p of f.problems) console.log(`    · ${p}`);
}
console.log('');
process.exit(1);
