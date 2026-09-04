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

  if (!/insets\.top/.test(src) && !headed) {
    problems.push('no insets.top and no navigation header — content starts under the status bar');
  }
  if (!/insets\.bottom/.test(src)) {
    problems.push('no insets.bottom — the last item runs into the gesture bar');
  }
  // A tab screen needs clearance for the floating pill on top of the inset.
  if (rel.includes('(tabs)') && !/tabBarClearance/.test(src)) {
    problems.push('tab screen without Spacing.tabBarClearance — the tab pill covers the last card');
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
