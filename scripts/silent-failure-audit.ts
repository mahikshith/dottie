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
 * ─── AND THE CHECK HAD A HOLE (device-test-22) ──────────────────────
 *
 *  It matched only the one-line form. The BLOCK form —
 *
 *      if (__DEV__) {
 *        console.warn('[Hydration] User load failed:', err);
 *      }
 *
 *  — is the same silence and sailed straight through for four rounds. That
 *  exact site was the hydration failure that left the quiz screen spinning
 *  forever with nothing to report (DT22-1). So the audit now reads the file as
 *  TEXT, not as lines, and catches the pattern across a newline.
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

/**
 * The shape the rule forbids, in both spellings:
 *
 *   if (__DEV__) console.warn(err)
 *   if (__DEV__) { console.error(err) }
 *
 * `[\s\S]*?` is bounded by a `{` and the first console call, so it cannot
 * run away and pair an `if (__DEV__)` with an unrelated console line further
 * down the file. console.LOG is deliberately not matched — a dev trace of
 * something that worked is not a swallowed error.
 */
const OFFENDER = /if \(__DEV__\)\s*(?:\{\s*)?console\.(warn|error)\(/;

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
  const source = readFileSync(file, 'utf8');
  // Scan the whole file so the block form is caught, then map the byte offset
  // back to a line number for the report.
  const re = new RegExp(OFFENDER.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const line = source.slice(0, m.index).split('\n').length;
    hits.push({
      file: rel,
      line,
      text: m[0].replace(/\s+/g, ' ').trim() + ' …',
    });
  }
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
