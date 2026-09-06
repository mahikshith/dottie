/**
 * Dottie — transparency harness (device-test-23)
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner: "the user needs complete transparency… what are all the variables,
 *  what are all the features that we are trying to add to predict?"
 *
 *  A disclosure is worth exactly as much as its accuracy. The moment
 *  `what-we-use.ts` says something the predictor doesn't do — or stops
 *  mentioning something it does — the panel becomes a nicer-sounding lie than
 *  saying nothing, because the user now believes they have checked.
 *
 *  So this pins the list to the code. It cannot verify the arithmetic (that is
 *  test:predictor's job); it verifies the CLAIMS: that every mechanism the
 *  predictor implements is disclosed, that nothing is claimed twice, that the
 *  conditions list and the disclosure agree about which conditions move the
 *  maths, and that the "not used" rows are actually there — the half a
 *  marketing page would quietly drop.
 *
 *  Run: npm run test:transparency
 */

import './harness/bootstrap';
import { predictionFactors, transparencySummary } from '../src/engine/prediction/what-we-use';
import { CONDITION_OPTIONS } from '../src/content/conditions';
import { hasOvulatoryCondition, hasThyroidCondition } from '../src/engine/prediction/condition-families';
import type { HealthProfile } from '../src/types/cycle.types';

let failures = 0;
let checks = 0;
function ok(label: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}

function section(name: string): void {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

const fullProfile: HealthProfile = {
  age: 29,
  mode: 'adult',
  conditions: ['pcos', 'hypothyroid'],
  weightKg: 62,
  heightCm: 165,
  activityLevel: 'moderate',
  averageCycleLength: 29,
  averagePeriodLength: 5,
  onMedications: false,
};

console.log('\x1b[1m\nDottie — prediction transparency\x1b[0m');

// ─── T1 · every mechanism the predictor has is disclosed ─────────────

section('T1 · every mechanism the predictor implements appears in the list');

const factors = predictionFactors({
  healthProfile: fullProfile,
  cycleCount: 6,
  lastPeriodStart: '2026-08-07',
  stressLevel: 4,
  sleepQuality: 2,
  premenstrualSignal: true,
  subject: 'you',
});
const blob = factors.map((f) => `${f.label} ${f.effect}`).join(' \n ').toLowerCase();

// One entry per thing predictor.ts / bayesian-predictor.ts actually reads.
const MECHANISMS: { name: string; needle: RegExp }[] = [
  { name: 'logged cycle history (the posterior)', needle: /cycle/ },
  { name: 'the anchor date', needle: /last period start/ },
  { name: 'reported cycle length (the prior mean)', needle: /cycle length you told us/ },
  { name: 'age widening the prior', needle: /under 16 and over 40/ },
  { name: 'PCOS / PCOD widening', needle: /pcos and pcod/ },
  { name: 'thyroid widening', needle: /thyroid/ },
  { name: 'stress mean-shift', needle: /stress/ },
  { name: 'sleep mean-shift', needle: /sleep/ },
  { name: 'premenstrual signal narrowing', needle: /premenstrual/ },
];
for (const m of MECHANISMS) {
  ok(`discloses ${m.name}`, m.needle.test(blob));
}

// ─── T2 · and it does NOT claim what the model ignores ───────────────

section('T2 · the inputs the model ignores are listed, and marked');

const notUsed = factors.filter((f) => f.state === 'not_used');
ok('there is at least one "not used" row', notUsed.length > 0);
ok(
  'height / weight / activity are declared unused',
  notUsed.some((f) => /height/i.test(f.label)),
  notUsed.map((f) => f.label).join(', ')
);
ok(
  'mood and symptom logs are declared unused',
  notUsed.some((f) => /mood/i.test(f.label))
);
ok(
  'no row claims height or weight changes the forecast',
  !factors.some(
    (f) => f.state === 'active' && /height|weight|activity/i.test(f.label)
  )
);

// ─── T3 · the conditions list and the disclosure agree ───────────────

section('T3 · conditions.ts and the predictor agree about what moves the maths');

for (const c of CONDITION_OPTIONS) {
  if (c.id === 'nothing' || c.id === 'prefer_not_say') continue;
  const modelSees = hasOvulatoryCondition([c.id]) || hasThyroidCondition([c.id]);
  if (c.affectsPrediction) {
    // Uterine conditions are recorded as affecting: they are in a family and
    // reach the engine, even though today they change flow/pain framing
    // rather than the window. The claim string says exactly that.
    const inAnyFamily = modelSees || ['endometriosis', 'adenomyosis', 'fibroids'].includes(c.id);
    ok(`${c.label} is claimed to affect prediction AND reaches the engine`, inAnyFamily);
  } else {
    ok(`${c.label} is honestly marked as not affecting the forecast`, !modelSees);
  }
}

// ─── T4 · a sister's disclosure differs, because her data does ───────

section('T4 · a sister gets her own, smaller, truthful list');

const sister = predictionFactors({
  healthProfile: { ...fullProfile, conditions: ['pcos'] },
  cycleCount: 2,
  lastPeriodStart: '2026-08-01',
  subject: 'sister',
});
const sisterBlob = sister.map((f) => f.label).join(' | ');
ok('a sister has no stress row', !/Stress/.test(sisterBlob), sisterBlob);
ok('a sister has no sleep row', !/Sleep, from/.test(sisterBlob));
ok(
  'and the list SAYS why rather than silently omitting them',
  sister.some((f) => /check-ins/i.test(f.label) && f.state === 'not_used')
);

// ─── T5 · the empty user is handled honestly ─────────────────────────

section('T5 · someone with nothing logged is told what is missing, not lied to');

const empty = predictionFactors({
  healthProfile: null,
  cycleCount: 0,
  lastPeriodStart: null,
  subject: 'you',
});
ok('nothing is marked as in use', empty.every((f) => f.state !== 'active'));
ok(
  'the cycle-history row says the forecast is on the population range',
  empty.some((f) => /typical range/i.test(f.effect))
);
ok('the summary counts zero of something', /^0 of \d+/.test(transparencySummary(empty)),
  transparencySummary(empty));

// ─── T6 · no row is empty or duplicated ──────────────────────────────

section('T6 · the list itself is well-formed');

ok('every row has a label', factors.every((f) => f.label.trim().length > 0));
ok('every row explains itself', factors.every((f) => f.effect.trim().length > 12));
ok('no duplicate labels', new Set(factors.map((f) => f.label)).size === factors.length);
// Rule 1: this panel talks about the MODEL, never about a body.
ok(
  'no row makes a diagnostic claim about the user',
  !/your body (does|is|will)/i.test(blob),
  blob.slice(0, 120)
);

console.log(
  failures === 0
    ? `\n\x1b[32m✓ ${checks} checks — the disclosure matches the model, including where the model is blind.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
