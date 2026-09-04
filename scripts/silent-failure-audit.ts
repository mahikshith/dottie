/**
 * Dottie — rule 18 audit
 *
 * `if (__DEV__) console.warn(...)` inside a catch is SILENCE.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  `__DEV__` is false in the release build — the only build the owner ever
 *  installs. So every one of these swallowed an error and produced no console
 *  line, no log entry, and no user-visible sign, on the one build that matters.
 *
 *  The rule was written into CLAUDE.md after the DT15 white screen, and
 *  `logSilentFailure` was built to replace the pattern. Then it was applied to
 *  a handful of call sites and stopped: DT18 found SIXTY-TWO still in place,
 *  including one in the quiz screen's reward path, where a failed XP award
 *  would vanish completely.
 *
 *  A rule nothing checks is a comment. This is the check.
 *
 *      npm run audit:silent
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const ROOTS = ['src', 'app'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'android', 'ios']);

/**
 * `silent-failure.ts` is allowed to use the pattern — its own dev echo is the
 * one place a `__DEV__` console line is the point rather than an accident.
 */
const ALLOWED = new Set(['src/diagnostics/silent-failure.ts']);

/** The shape the rule forbids: a dev-only console call carrying an error. */
const OFFENDER = /if \(__DEV__\)\s*console\.(warn|error)\(/;

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files: string[] = [];
for (const r of ROOTS) walk(join(ROOT, r), files);

const hits: { file: string; line: number; text: string }[] = [];
for (const file of files) {
  const rel = relative(ROOT, file).split('\\').join('/');
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    if (OFFENDER.test(text)) hits.push({ file: rel, line: i + 1, text: text.trim() });
  });
}

console.log('\x1b[1mSilent-failure audit (CLAUDE.md rule 18)\x1b[0m');
console.log(`  files scanned: ${files.length}`);

if (hits.length === 0) {
  console.log('\n\x1b[32m✓ no swallowed errors — every catch reports through logSilentFailure.\x1b[0m');
  process.exit(0);
}

console.log(`\n\x1b[31m✗ ${hits.length} swallowed error(s). __DEV__ is FALSE in the owner's build,`);
console.log("  so each of these is silence. Use logSilentFailure('code', err) instead.\x1b[0m\n");
for (const h of hits) console.log(`  ${h.file}:${h.line}\n    ${h.text}`);
process.exit(1);
