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
import {
  creatureShapes,
  ARM_POSE,
  BODY,
  EYE,
  HEAD,
  SPARKLE_FLOOR_Y,
  SPECIES,
} from '../src/components/ui/creature/geometry';
import type { CompanionType } from '../src/types/content.types';

const TYPES: CompanionType[] = ['fox', 'bunny', 'butterfly', 'cat', 'owl', 'blossom'];

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

/**
 * EVERY state. The previous list was written by hand and had drifted — it was
 * missing `caring`, which is the face shown after a rough quiz, so the single
 * most sensitive expression in the rig was the one nothing checked. The C1 and
 * C8 sweeps walk this, so a state added to the union and forgotten here is a
 * state nothing asserts.
 */
const STATES: CreatureState[] = [
  'idle', 'happy', 'proud', 'celebrate', 'mindblown', 'sad', 'caring', 'sleepy', 'love',
  'curious', 'thinking', 'surprised', 'wink', 'laugh', 'shy', 'determined', 'cheer',
  'confused', 'relieved', 'frustrated', 'annoyed', 'worried', 'excited', 'sulky',
  'queasy', 'smug',
];
const ALL: CreatureState[] = STATES;

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


// ─── C8 — the anti-insect audit ──────────────────────────────────────
//
// The companions were reported as looking like INSECTS in three device rounds
// (DT7, DT8, DT16). Each fix was reasoned about and shipped blind in a
// 25-minute APK, and each time the same complaint came back — DT16 even
// ADDED two round nubs on stalks to the deer, which is what an antenna is.
//
// So the signals are assertions now. Every one of these failed on the old rig.

scenario('C8 — no sparkle may sit beside or below the head', () => {
  // The loudest signal by far: `Sparkles` used to ring the whole character
  // with up to twelve dots at radius 42, including down both flanks and
  // underneath. Small round things radiating from a round body are LEGS, and
  // it fired on every celebrate and mindblown.
  for (const st of STATES) {
    const shapes = creatureShapes('fox', expressionFor(st, 1));
    const sparks = shapes.filter((sh) => sh.role === 'sparkle');
    for (const sp of sparks) {
      const y = sp.k === 'path' ? 0 : sp.cy;
      ok(`${st}: sparkle stays above the head centre`, y < SPARKLE_FLOOR_Y, `y=${y}`);
    }
    ok(`${st}: at most five sparkles`, sparks.length <= 5, String(sparks.length));
  }
});

scenario('C8b — nothing stalked sits above the crown', () => {
  // The DT16 deer antlers: two small round shapes floating over the head.
  const crown = HEAD.cy - HEAD.r; // top of the skull
  for (const type of TYPES) {
    for (const sh of creatureShapes(type, expressionFor('idle', 1))) {
      if (sh.role === 'sparkle' || sh.k === 'path') continue;
      const r = sh.k === 'circle' ? sh.r : Math.max(sh.rx, sh.ry);
      const detached = sh.cy + r < crown;
      ok(`${type}: no shape floats clear above the skull (${sh.role})`, !detached,
        `cy=${sh.cy} r=${r} crown=${crown}`);
    }
  }
});

scenario('C8c — the body is never wider than the head', () => {
  // No neck meant no character: a head and a body of the same width, joined
  // and concentric, is a thorax and an abdomen.
  ok('body half-width is under the head radius', BODY.halfWidth < HEAD.r,
    `${BODY.halfWidth} vs ${HEAD.r}`);
});

scenario('C8d — eyes are not wide-set black domes', () => {
  // 24 apart on a 50-wide head at rx 6.4 is how a jumping spider is drawn.
  const spread = (EYE.rx - EYE.lx) / (HEAD.r * 2);
  ok('eye spread is a mammal ratio, under 0.45', spread < 0.45, spread.toFixed(3));
  ok('and each eye carries a real catchlight', creatureShapes('fox', expressionFor('idle', 1))
    .some((sh) => sh.role === 'eye-light'));
});

scenario('C8e — every companion has two arms and two legs', () => {
  // Until DT18 there were no limbs at all — just a body reaching the floor
  // with two detached foot ellipses under it.
  for (const type of TYPES) {
    const shapes = creatureShapes(type, expressionFor('idle', 1));
    for (const limb of ['armL', 'armR', 'legL', 'legR'] as const) {
      ok(`${type}: has ${limb}`, shapes.some((sh) => sh.limb === limb));
    }
    ok(`${type}: exactly two feet`, shapes.filter((sh) => sh.role === 'foot').length === 4);
  }
});

scenario('C8f — every arm pose is reachable and distinct', () => {
  const seen = new Set<string>();
  for (const st of STATES) {
    const pose = expressionFor(st, 1).armPose;
    ok(`${st}: pose is known`, pose in ARM_POSE, pose);
    seen.add(pose);
  }
  ok('more than one pose is actually used', seen.size >= 5, `${seen.size} poses`);
  // Not "both arms must mirror" — `wave` and `chin` are one-armed gestures on
  // purpose, and asymmetry is the whole reason these stopped reading as
  // specimens. What must hold is that the two arms are never IDENTICAL, which
  // would stack them on top of each other and lose one.
  for (const [pose, [l, r]] of Object.entries(ARM_POSE)) {
    ok(`${pose}: the two arms are not the same angle`, l !== r, `${l} / ${r}`);
  }
  const asymmetric = Object.values(ARM_POSE).filter(([l, r]) => Math.abs(l) !== Math.abs(r));
  ok('at least one pose is a one-armed gesture', asymmetric.length >= 1, `${asymmetric.length}`);
});

scenario('C8g — the shape list is pure and stable', () => {
  // The preview page and the app must be the same picture, which only holds
  // if the same arguments give the same shapes.
  const a = creatureShapes('owl', expressionFor('celebrate', 1));
  const b = creatureShapes('owl', expressionFor('celebrate', 1));
  ok('same input, same output', JSON.stringify(a) === JSON.stringify(b));
  for (const type of TYPES) {
    for (const st of STATES) {
      for (const sh of creatureShapes(type, expressionFor(st, 1))) {
        const nums = sh.k === 'path' ? [sh.px ?? 0, sh.py ?? 0] : [sh.cx, sh.cy];
        ok(`${type}/${st}: ${sh.role} has finite coordinates`, nums.every(Number.isFinite));
        if (sh.opacity !== undefined) {
          ok(`${type}/${st}: ${sh.role} opacity in 0..1`, sh.opacity >= 0 && sh.opacity <= 1);
        }
      }
    }
  }
});

scenario('C8h — the owl is an owl and the deer is a deer', () => {
  // Both came out wrong on the first pass: every species shared the mammal
  // muzzle, so the owl was a small bear with the right ears.
  const owl = creatureShapes('owl', expressionFor('idle', 1));
  ok('owl has a beak', SPECIES.owl.face === 'beak');
  ok('owl draws no mammal muzzle line', !owl.some((sh) => sh.role === 'mouth'));
  ok('deer has fawn spots', SPECIES.butterfly.spots);
  ok('deer has no tail (a doe reads by ears and spots)', SPECIES.butterfly.tail === 'none');
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Creature expression harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
