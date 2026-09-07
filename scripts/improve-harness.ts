/**
 * Dottie — improvement-engine harness (device-test-29)
 *
 *  The "how do I make this better" screen is advice about a person's own
 *  health data. Advice that is wrong is worse than no advice, and there are
 *  three specific ways this could be wrong:
 *
 *    I1  it tells someone to do something they have already done
 *    I2  it ranks a small lever above a big one, so the person spends effort
 *        on the thing that will not help
 *    I3  it promises improvement that cannot happen — the case that matters
 *        most, because for a genuinely variable cycle more logging does NOT
 *        narrow the window, and saying otherwise is a lie the app would keep
 *        telling forever
 *
 *  Plus the honesty rules the whole app runs on: no invented cohort figures
 *  (rule 2), no diagnosing the reader (rule 1).
 *
 *  Run: npm run test:improve
 */

import './harness/bootstrap';
import {
  improvementActions,
  confidenceBreakdown,
  confidenceLabel,
  type PredictionReadiness,
} from '../src/engine/prediction/improve';

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

const base: PredictionReadiness = {
  cycleCount: 0,
  hasLastPeriod: false,
  cycleSpreadDays: null,
  healthProfile: { age: null, averageCycleLength: null, conditions: [] },
  conditionsAnswered: false,
  weightTracked: false,
  checkInsLast7: 0,
  confidence: 0.35,
  windowDays: 4,
};
const r = (patch: Partial<PredictionReadiness>): PredictionReadiness => ({ ...base, ...patch });

console.log('\x1b[1m\nDottie — what would make the forecast better\x1b[0m');

// ─── I1 · never ask for what is already done ─────────────────────────

section('I1 · done is done');

const fresh = improvementActions(base);
ok('a brand-new user gets a list', fresh.length >= 5, String(fresh.length));
ok('and nothing is marked done', fresh.filter((a) => a.done).length === 0);

const settled = improvementActions(
  r({
    cycleCount: 8,
    hasLastPeriod: true,
    cycleSpreadDays: 1.4,
    healthProfile: { age: 31, averageCycleLength: 28, conditions: [] },
    conditionsAnswered: true,
    weightTracked: true,
    checkInsLast7: 5,
    confidence: 0.86,
  })
);
ok(
  'a fully set-up user has everything ticked off',
  settled.every((a) => a.done),
  settled.filter((a) => !a.done).map((a) => a.id).join(', ')
);
ok(
  'the anchor is done once a period is logged',
  settled.find((a) => a.id === 'log_period_start')?.done === true
);
ok(
  'age counts as done only when it is actually set',
  improvementActions(r({ healthProfile: { age: 24, averageCycleLength: null, conditions: [] } }))
    .find((a) => a.id === 'add_age')?.done === true &&
    fresh.find((a) => a.id === 'add_age')?.done === false
);

// ─── I2 · the ranking is by real effect ──────────────────────────────

section('I2 · biggest lever first');

const undone = fresh.filter((a) => !a.done);
ok('undone actions come first', improvementActions(r({ cycleCount: 8, hasLastPeriod: true }))
  .findIndex((a) => a.done) > 0 || improvementActions(r({ cycleCount: 8, hasLastPeriod: true }))[0]?.done === false);
ok(
  'the first thing asked of a new user is high impact',
  undone[0]?.impact === 'high',
  undone[0]?.impact
);
ok(
  'logging the anchor and logging cycles are both high impact',
  ['log_period_start', 'log_more_cycles'].every(
    (id) => fresh.find((a) => a.id === id)?.impact === 'high'
  )
);
ok(
  'weight and check-ins are ranked small — they are',
  ['track_weight', 'check_in_more'].every(
    (id) => fresh.find((a) => a.id === id)?.impact === 'small'
  )
);
ok(
  'impact never regresses down the undone list',
  (() => {
    const rank = { high: 0, medium: 1, small: 2 } as const;
    const undoneOnly = fresh.filter((a) => !a.done);
    return undoneOnly.every(
      (a, i) => i === 0 || rank[undoneOnly[i - 1]!.impact] <= rank[a.impact]
    );
  })()
);

// The stated cycle length matters hugely at zero history and barely at six.
ok(
  'the setup cycle length is high impact before history exists',
  fresh.find((a) => a.id === 'state_cycle_length')?.impact === 'high'
);
ok(
  'and drops to small once cycles are logged',
  improvementActions(r({ cycleCount: 4 })).find((a) => a.id === 'state_cycle_length')?.impact ===
    'small'
);

// ─── I3 · THE CEILING — the one that must never lie ──────────────────

section('I3 · never promise what the model cannot deliver');

const variable = improvementActions(
  r({ cycleCount: 10, hasLastPeriod: true, cycleSpreadDays: 5.4, confidence: 0.5 })
);
const ceiling = variable.find((a) => a.id === 'measured_signal');
ok('a variable cycle gets the ceiling statement', ceiling !== undefined);
ok(
  'it names the real limit rather than asking for more logging',
  (ceiling?.body ?? '').includes('your body'),
  ceiling?.body?.slice(0, 60)
);
ok(
  'it names the signals we do NOT collect, honestly',
  /ovulation test|temperature|cervical/i.test(ceiling?.body ?? '')
);
ok(
  'and says outright that we do not collect them yet',
  /does not collect|not collect/i.test(ceiling?.body ?? '')
);
ok(
  'a steady cycle gets no ceiling statement — it does not apply',
  improvementActions(r({ cycleCount: 10, hasLastPeriod: true, cycleSpreadDays: 1.2 })).find(
    (a) => a.id === 'measured_signal'
  ) === undefined
);
ok(
  'and neither does someone with too little history to know their spread',
  improvementActions(r({ cycleCount: 2, cycleSpreadDays: null })).find(
    (a) => a.id === 'measured_signal'
  ) === undefined
);
ok(
  'once six cycles are in, more logging is marked DONE rather than nagged',
  improvementActions(r({ cycleCount: 7 })).find((a) => a.id === 'log_more_cycles')?.done === true
);

// ─── I4 · honesty of the copy ────────────────────────────────────────

section('I4 · the copy obeys the app’s own rules');

const everyText = [
  ...improvementActions(r({ cycleCount: 10, cycleSpreadDays: 5.4 })),
].flatMap((a) => [a.title, a.body, a.evidence ?? '']);

ok(
  'no invented cohort statistic (rule 2)',
  !everyText.some((t) => /\b\d+% of (women|people|users)/i.test(t)),
  everyText.find((t) => /\b\d+% of (women|people|users)/i.test(t))
);
ok(
  'nothing diagnoses the reader (rule 1)',
  !everyText.some((t) => /you (have|likely have|probably have) (pcos|a condition)/i.test(t))
);
// An ACCURACY claim ("about two days of error") is a statement about the
// engine's performance and must say where it came from. A statement about the
// user's OWN spread is computed from their own logs and needs no such caveat —
// the first version of this check conflated the two, which is exactly the kind
// of sloppiness rule 2 exists to prevent.
ok(
  'every accuracy figure says it was measured on our own engine',
  everyText
    .filter((t) => /(days?|day) of error/i.test(t))
    .every((t) => /Measured on our own engine/i.test(t)),
  everyText.find((t) => /(days?|day) of error/i.test(t) && !/Measured on our own engine/i.test(t))
);
ok(
  'and at least one such figure is actually quoted, so the check has teeth',
  everyText.some((t) => /Measured on our own engine/i.test(t))
);
ok(
  'every action has a real body, not a stub',
  improvementActions(base).every((a) => a.body.length > 40 && a.title.length > 8)
);
ok(
  'every action with a route points somewhere real',
  improvementActions(base)
    .filter((a) => a.route)
    .every((a) => /^\/\((tabs|profile|modals)\)\//.test(a.route ?? ''))
);

// ─── I5 · the confidence breakdown mirrors the model ─────────────────

section('I5 · the breakdown explains the actual arithmetic');

const noneYet = confidenceBreakdown(base);
ok('a user with no cycles is told that is the reason', noneYet.some((f) => /no completed cycles/i.test(f.label)));
ok('and it is marked as lowering the figure', noneYet.find((f) => /no completed cycles/i.test(f.label))?.direction === 'lowers');

const withConditions = confidenceBreakdown(
  r({ cycleCount: 6, cycleSpreadDays: 2.0, healthProfile: { age: 30, averageCycleLength: 28, conditions: ['pcos'] } })
);
ok('conditions appear as a lowering factor', withConditions.some((f) => f.direction === 'lowers' && /condition/i.test(f.label)));
ok(
  'and the reason says it is deliberate, not a fault',
  /honest|on purpose|deliberate|less certain/i.test(
    withConditions.find((f) => /condition/i.test(f.label))?.detail ?? ''
  )
);

const steady = confidenceBreakdown(r({ cycleCount: 9, cycleSpreadDays: 1.1 }));
ok('a steady cycle is reported as lifting confidence', steady.some((f) => f.direction === 'lifts'));

ok('labels match the predictor’s own thresholds', 
  confidenceLabel(0.85) === 'High' &&
  confidenceLabel(0.7) === 'Good' &&
  confidenceLabel(0.55) === 'Moderate' &&
  confidenceLabel(0.3) === 'Still learning');

console.log(
  failures === 0
    ? `\n\x1b[32m✓ ${checks} checks — the advice is ranked by real effect and never promises past the ceiling.\x1b[0m\n`
    : `\n\x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
