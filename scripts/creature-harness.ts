/**
 * Dottie — Companion Expression Harness
 *
 * Invariants for src/components/ui/creature/expressions.ts — the pure layer
 * behind the drawn, rigged companions (owner: "real animations, detailed
 * expressions based on user score and mood, mind-blowing at 100%+").
 *
 * These test the EMOTIONAL rules, which is the part that's easy to get subtly
 * wrong: a sad companion must not smile, praise must scale with the score
 * instead of being uniformly enthusiastic, and the top of the ladder has to be
 * visibly bigger than everything below it.
 *
 * Run: npm run test:creature
 */

import {
  expressionFor,
  stateForScore,
  intensityForScore,
  stateForMood,
  type CreatureState,
} from '../src/components/ui/creature/expressions';

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

const ALL: CreatureState[] = ['idle', 'happy', 'proud', 'celebrate', 'mindblown', 'sad', 'sleepy', 'love'];

// ─── C1 — every state is well-formed ─────────────────────────────────

scenario('C1 — every state produces sane, in-range parameters', () => {
  for (const st of ALL) {
    const e = expressionFor(st);
    ok(`${st}: eyeOpen in 0..1`, e.eyeOpen >= 0 && e.eyeOpen <= 1, String(e.eyeOpen));
    ok(`${st}: mouthCurve in -1..1`, e.mouthCurve >= -1 && e.mouthCurve <= 1, String(e.mouthCurve));
    ok(`${st}: mouthOpen in 0..1`, e.mouthOpen >= 0 && e.mouthOpen <= 1, String(e.mouthOpen));
    ok(`${st}: blush in 0..1`, e.blush >= 0 && e.blush <= 1, String(e.blush));
    ok(`${st}: tempo > 0 (a zero tempo would divide by zero in the rig)`, e.tempo > 0);
    ok(`${st}: bounce >= 0`, e.bounce >= 0);
    ok(`${st}: sparkles is a non-negative integer`,
      Number.isInteger(e.sparkles) && e.sparkles >= 0, String(e.sparkles));
  }
});

// ─── C2 — the emotions actually read differently ─────────────────────

scenario('C2 — a sad companion does not smile, a happy one does', () => {
  ok('sad frowns', expressionFor('sad').mouthCurve < 0);
  ok('sad brows are worried (tilt negative)', expressionFor('sad').browTilt < 0);
  ok('happy smiles', expressionFor('happy').mouthCurve > 0.4);
  ok('celebrate smiles harder than happy',
    expressionFor('celebrate').mouthCurve > expressionFor('happy').mouthCurve);
  ok('sleepy has near-shut eyes', expressionFor('sleepy').eyeOpen < 0.2);
  ok('idle is neutral-ish, not grinning', expressionFor('idle').mouthCurve < 0.4);
});

scenario('C3 — mindblown is unmistakably the biggest reaction', () => {
  const wow = expressionFor('mindblown', 1);
  const cel = expressionFor('celebrate', 1);
  ok('eyes blown wider than celebrate', wow.pupilScale > cel.pupilScale, `${wow.pupilScale} vs ${cel.pupilScale}`);
  ok('jaw fully open', wow.mouthOpen >= 1);
  ok('more sparkles than celebrate', wow.sparkles > cel.sparkles, `${wow.sparkles} vs ${cel.sparkles}`);
  ok('moves more than celebrate', wow.bounce > cel.bounce);
  ok('faster than celebrate', wow.tempo > cel.tempo);
  ok('eyes are ROUND not arced — surprise, not contentment', !wow.eyeArc);
});

scenario('C4 — intensity scales the performance', () => {
  const soft = expressionFor('celebrate', 0);
  const full = expressionFor('celebrate', 1);
  ok('a stronger celebrate bounces more', full.bounce > soft.bounce);
  ok('a stronger celebrate has more sparkles', full.sparkles > soft.sparkles);
  ok('intensity is clamped (2 behaves like 1)',
    expressionFor('celebrate', 2).bounce === full.bounce);
  ok('negative intensity behaves like 0',
    expressionFor('celebrate', -5).bounce === soft.bounce);
});

// ─── C5 — score → reaction ladder ────────────────────────────────────

scenario('C5 — the score ladder is monotonic and tops out at mindblown', () => {
  // The bottom two bands are 'caring' — a rough result gets support, never a
  // grin (which is what device-test-8 caught) and never disappointment.
  ok('0% → caring', stateForScore(0) === 'caring');
  ok('30% → caring', stateForScore(30) === 'caring');
  ok('50% → happy', stateForScore(50) === 'happy');
  ok('70% → proud', stateForScore(70) === 'proud');
  ok('90% → celebrate', stateForScore(90) === 'celebrate');
  ok('100% → mindblown', stateForScore(100) === 'mindblown');
  ok('200% → still mindblown', stateForScore(200) === 'mindblown');
  ok('nonsense input is safe', stateForScore(NaN) === 'idle');
  // The specific regression: a low score must never look pleased.
  const grins: CreatureState[] = ['happy', 'proud', 'celebrate', 'mindblown'];
  ok('no low score reads as pleased',
    [0, 10, 20, 33, 39].every((pct) => !grins.includes(stateForScore(pct))),
    [0, 10, 20, 33, 39].map((p) => `${p}:${stateForScore(p)}`).join(' '));
  ok('caring is warm, not sad', expressionFor('caring').mouthCurve > 0);
  ok('caring reads as empathy (inner brows up)', expressionFor('caring').browTilt < 0);
  ok('caring is clearly not a grin',
    expressionFor('caring').mouthCurve < expressionFor('happy').mouthCurve / 2,
    `${expressionFor('caring').mouthCurve} vs ${expressionFor('happy').mouthCurve}`);
});

scenario('C6 — 200% plays harder than a bare 100%', () => {
  const at100 = intensityForScore(100);
  const at200 = intensityForScore(200);
  ok('200% is more intense than 100%', at200 > at100, `${at200} vs ${at100}`);
  ok('intensity stays in 0..1', at200 <= 1 && at100 >= 0);
  ok('and that reaches the expression',
    expressionFor('mindblown', at200).sparkles > expressionFor('mindblown', at100).sparkles);
});

// ─── C7 — mood → reaction ────────────────────────────────────────────

scenario('C7 — the companion matches how the user says they feel', () => {
  ok('lowest mood → sad', stateForMood(1) === 'sad');
  ok('low mood → sad', stateForMood(2) === 'sad');
  ok('middling mood → idle', stateForMood(3) === 'idle');
  ok('good mood → happy', stateForMood(4) === 'happy');
  ok('great mood → celebrate', stateForMood(5) === 'celebrate');
  ok('unknown mood is safe', stateForMood(null) === 'idle');
  ok('a rough day never gets a grin', expressionFor(stateForMood(1)).mouthCurve < 0);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Creature expression harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
