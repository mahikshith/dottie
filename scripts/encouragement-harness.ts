/**
 * Dottie — Encouragement Harness
 *
 * Invariants for the post-result nudge pool (src/engine/learn/encouragement.ts).
 *
 * Copy is the thing most likely to rot silently: nobody notices a slightly
 * shaming sentence in a 22-line array until a user does. So the TONE rules are
 * asserted here, not just the mechanics — no line may blame the reader, call a
 * result bad, or imply they should already have known it.
 *
 * Run: npm run test:nudges
 */

import {
  nudgeForScore,
  bandForScore,
  allNudges,
  NUDGE_COUNT,
} from '../src/engine/learn/encouragement';

let failures = 0;
let current = '';

function scenario(name: string, fn: () => void): void {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✗ threw: ${(err as Error).message}\x1b[0m`);
  }
}

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${current}")`);
}

// ─── E1 — the pool is big enough to feel alive ───────────────────────

scenario('E1 · at least the dozen lines the owner asked for', () => {
  ok(`${NUDGE_COUNT} lines total (≥12)`, NUDGE_COUNT >= 12, String(NUDGE_COUNT));
  const texts = allNudges().map((n) => n.text);
  ok('every line is distinct', new Set(texts).size === texts.length);
  ok('no line is a stub', texts.every((t) => t.length > 20));
});

// ─── E2 — bands ──────────────────────────────────────────────────────

scenario('E2 · score maps to the right band', () => {
  ok('1.0 → perfect', bandForScore(1) === 'perfect');
  ok('0.9 → strong', bandForScore(0.9) === 'strong');
  ok('0.6 → middling', bandForScore(0.6) === 'middling');
  ok('0.33 → low', bandForScore(1 / 3) === 'low');
  ok('0 → low', bandForScore(0) === 'low');
  ok('nonsense is safe', bandForScore(NaN) === 'middling');
});

// ─── E3 — rotation ───────────────────────────────────────────────────

scenario('E3 · rotation is real and deterministic', () => {
  const seen = new Set<string>();
  for (let turn = 0; turn < 12; turn++) seen.add(nudgeForScore(0.2, turn).text);
  ok('a low scorer sees several different lines over 12 attempts',
    seen.size >= 5, `${seen.size} distinct`);

  ok('the same turn always gives the same line',
    nudgeForScore(0.2, 3).text === nudgeForScore(0.2, 3).text);
  ok('consecutive turns differ',
    nudgeForScore(0.2, 0).text !== nudgeForScore(0.2, 1).text);
  ok('it wraps rather than running out',
    nudgeForScore(0.2, 999).text.length > 0);
  ok('a negative or bogus turn is safe',
    nudgeForScore(0.2, -4).text.length > 0 && nudgeForScore(0.2, NaN).text.length > 0);
});

// ─── E4 — a low result is invited back ───────────────────────────────

scenario('E4 · a rough result actually invites another go', () => {
  const lowLines = Array.from({ length: 7 }, (_, i) => nudgeForScore(0.1, i));
  const retries = lowLines.filter((n) => n.invitesRetry).length;
  ok('most low-band lines invite a retry', retries >= 5, `${retries}/7`);
  ok('at least one says "try" in so many words',
    lowLines.some((n) => /try|go|round|again/i.test(n.text)));
  ok('a perfect score is NOT told to try again',
    !nudgeForScore(1, 0).invitesRetry);
});

// ─── E5 — tone ───────────────────────────────────────────────────────

scenario('E5 · nothing shaming, blaming or diagnostic', () => {
  const banned =
    /\b(fail(ed|ure)?|bad|poor|wrong with you|should have|obviously|easy|simple|just|stupid|disappoint\w*)\b/i;
  const all = allNudges();
  all.forEach((n) => ok(`"${n.text.slice(0, 40)}…" is kind`, !banned.test(n.text), n.text));
  ok('no line shouts',
    all.every((n) => n.text === n.text.replace(/\b[A-Z]{4,}\b/g, '')));
  ok('no line is a medical claim',
    all.every((n) => !/\b(diagnos\w*|disorder|symptom|treat\w*)\b/i.test(n.text)));
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Encouragement harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
