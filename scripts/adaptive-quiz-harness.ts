/**
 * Dottie — Adaptive Quiz Harness (Learn Redesign Phase 3)
 *
 * Fails loudly if the tier-aware selector regresses. Six invariants,
 * pinned to the Gemini Master Spec §3 with our three fixes.
 *
 * Run: npm run test:adaptive
 * When: locally on every quiz-engine change + in CI when we wire it.
 *
 *   INV 1  First question is always `beginner`.
 *   INV 2  Correct answer promotes ONE tier; wrong answer HOLDS.
 *   INV 3  Promotion caps at `hard`.
 *   INV 4  Nearest-tier fallback: `moderate` request against a beginner/hard-only
 *          bank returns the closer of the two present tiers, never a random pick.
 *   INV 5  Same session seed + same bank + same call sequence → same picks.
 *   INV 6  Legacy question with no `level` behaves as `beginner`.
 *
 * No React Native imports — runnable in Node via tsx.
 */

import type { QuizQuestion } from '../src/types/content.types';
import {
  TIER_ORDER,
  promoteTier,
  questionTier,
  nearestTierPool,
  pickAdaptiveSlate,
  pickNextQuestion,
  seedFromSessionId,
} from '../src/engine/learn/adaptive-quiz';

// ─── FIXTURE ─────────────────────────────────────────────────────────

function q(id: string, level?: QuizQuestion['level']): QuizQuestion {
  return {
    id,
    text: `Q ${id}`,
    options: ['a', 'b'],
    correctIndex: 0,
    explanation: '',
    level,
  };
}

// 4 beginner / 3 moderate / 3 hard — enough at every tier for a full 5-pick
// slate to reach and STAY at 'hard' without triggering nearest-tier fallback.
const bankMixed: QuizQuestion[] = [
  q('b1', 'beginner'), q('b2', 'beginner'), q('b3', 'beginner'), q('b4', 'beginner'),
  q('m1', 'moderate'), q('m2', 'moderate'), q('m3', 'moderate'),
  q('h1', 'hard'), q('h2', 'hard'), q('h3', 'hard'),
];

const bankNoModerate: QuizQuestion[] = [
  q('b1', 'beginner'), q('b2', 'beginner'),
  q('h1', 'hard'),
];

const bankLegacy: QuizQuestion[] = [
  q('L1'), q('L2'), q('L3'), q('L4'),
];

// ─── ASSERTION HELPERS ───────────────────────────────────────────────

let failures = 0;
function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}

// ─── INV 2: promoteTier ─────────────────────────────────────────────

console.log('\n\x1b[1mAdaptive Quiz Harness\x1b[22m');
console.log('\nINV 2 — promote on correct, hold on wrong');
ok('beginner + correct → moderate', promoteTier('beginner', true) === 'moderate');
ok('moderate + correct → hard',     promoteTier('moderate', true) === 'hard');
ok('hard + correct → hard (cap)',   promoteTier('hard', true) === 'hard');           // INV 3
ok('beginner + wrong → beginner (hold, never demote)', promoteTier('beginner', false) === 'beginner');
ok('moderate + wrong → moderate (hold)', promoteTier('moderate', false) === 'moderate');
ok('hard + wrong → hard (hold)',     promoteTier('hard', false) === 'hard');

// ─── INV 6: legacy level fallback ────────────────────────────────────

console.log('\nINV 6 — missing level treated as beginner');
ok('questionTier(legacy) === beginner', questionTier(q('x')) === 'beginner');

// ─── INV 4: nearest-tier fallback ────────────────────────────────────

console.log('\nINV 4 — nearest-tier fallback');
const poolMod = nearestTierPool(bankNoModerate, 'moderate');
ok(
  'moderate on {beg,hard} → nearest tier (beg or hard), not random from all',
  poolMod.length > 0 && poolMod.every((qq) => qq.level === 'beginner' || qq.level === 'hard')
);
// Beginner is at index 0, hard at index 2 — moderate is centre (index 1). Distance to
// beginner is 1 (dir -1), distance to hard is also 1 (dir +1). Symmetric radius walk
// tries dir -1 FIRST, so 'beginner' wins the tie.
ok(
  'moderate tie-break prefers the easier tier (beginner over hard)',
  poolMod.every((qq) => qq.level === 'beginner'),
  `got: ${poolMod.map((qq) => qq.level).join(', ')}`
);
const poolHardEmpty = nearestTierPool([q('b1', 'beginner')], 'hard');
ok(
  'hard on {beginner-only} → beginner (walks 2 steps down)',
  poolHardEmpty.length === 1 && poolHardEmpty[0]!.level === 'beginner'
);
const poolEmpty = nearestTierPool([], 'moderate');
ok('empty bank → empty pool (no crash)', poolEmpty.length === 0);

// ─── INV 1: first question always beginner ───────────────────────────

console.log('\nINV 1 — first pick is always beginner (given any bank with a beginner)');
const seed = seedFromSessionId('qz_test_session_alpha');
const first = pickNextQuestion({
  bank: bankMixed,
  currentTier: 'beginner',
  alreadyAsked: new Set(),
  seed,
});
ok('pickNextQuestion(default beginner) returns a beginner question', first != null && questionTier(first!) === 'beginner');

const slate = pickAdaptiveSlate({ bank: bankMixed, count: 5, seed });
ok('pickAdaptiveSlate first is beginner', slate.length > 0 && questionTier(slate[0]!) === 'beginner');

// Optimistic promote → 5-question slate should climb beg → mod → hard → hard → hard.
console.log('\nOptimistic slate tier progression');
const expected = ['beginner', 'moderate', 'hard', 'hard', 'hard'];
const actual = slate.map((qq) => questionTier(qq));
ok(
  `slate tiers === ${expected.join(',')}`,
  JSON.stringify(actual) === JSON.stringify(expected),
  `got: ${actual.join(',')}`
);

// ─── Fallback fires when a tier runs out mid-slate ──────────────────

console.log('\nFallback fires when a tier runs out mid-slate');
// Bank sized so the walk exits `hard` after pick 3 and demonstrates the
// nearest-tier walk over moderate → beginner as the moderate pool drains.
const bankHardLimited: QuizQuestion[] = [
  q('b1', 'beginner'), q('b2', 'beginner'), q('b3', 'beginner'),
  q('m1', 'moderate'), q('m2', 'moderate'),
  q('h1', 'hard'), // only ONE hard — picks 4-5 must fall back to nearest
];
const slateLimited = pickAdaptiveSlate({ bank: bankHardLimited, count: 5, seed });
ok(
  '5-pick slate on a 1-hard bank climbs beg,mod,hard for picks 1-3',
  slateLimited.length === 5 &&
    slateLimited[0]!.level === 'beginner' &&
    slateLimited[1]!.level === 'moderate' &&
    slateLimited[2]!.level === 'hard',
  `got: ${slateLimited.map((qq) => qq.level).join(',')}`
);
ok(
  'picks 4-5 fall back — never repeat h1, all picks unique, all still in the bank',
  (() => {
    const ids = slateLimited.map((qq) => qq.id);
    const bankIds = new Set(bankHardLimited.map((qq) => qq.id));
    const uniqueIds = new Set(ids);
    return (
      uniqueIds.size === ids.length &&
      ids.every((id) => bankIds.has(id)) &&
      ids.filter((id) => id === 'h1').length === 1
    );
  })(),
  `got ids: ${slateLimited.map((qq) => qq.id).join(',')}`
);

// ─── INV 5: session-seeded determinism ───────────────────────────────

console.log('\nINV 5 — determinism (same seed + bank → same picks)');
const slateA = pickAdaptiveSlate({ bank: bankMixed, count: 5, seed });
const slateB = pickAdaptiveSlate({ bank: bankMixed, count: 5, seed });
ok(
  'two identical calls return identical slates',
  JSON.stringify(slateA.map((x) => x.id)) === JSON.stringify(slateB.map((x) => x.id))
);
const slateC = pickAdaptiveSlate({ bank: bankMixed, count: 5, seed: seed + 1 });
ok(
  'different seed → likely different slate',
  JSON.stringify(slateA.map((x) => x.id)) !== JSON.stringify(slateC.map((x) => x.id))
);

// ─── Legacy bank behavior (no `level` on any question) ──────────────

console.log('\nLegacy bank (no level tags) — everything treated beginner');
const legacySlate = pickAdaptiveSlate({ bank: bankLegacy, count: 3, seed });
ok(
  'legacy slate returns 3 questions all treated as beginner',
  legacySlate.length === 3 && legacySlate.every((qq) => questionTier(qq) === 'beginner')
);

// ─── REPORT ─────────────────────────────────────────────────────────

console.log('');
if (failures === 0) {
  console.log(`  \x1b[32m✓ Adaptive quiz — all invariants hold.\x1b[0m`);
  console.log(`    tiers ordered: ${TIER_ORDER.join(' → ')}`);
  process.exit(0);
}
console.log(`  \x1b[31m✗ ${failures} invariant failure(s)\x1b[0m`);
process.exit(1);
