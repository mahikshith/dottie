/**
 * Dottie — Symptom Recall Harness
 *
 * Invariants for src/engine/symptoms/symptom-recall.ts — the layer that turns
 * daily symptom logs into "on day 2 you've logged nausea in 2 of your last 3
 * periods".
 *
 * ─── THE TEST THAT MATTERS MOST IS THE HONESTY ONE ──────────────────
 *
 *  This feature sits one careless sentence away from fabricating health claims.
 *  It would be trivially easy — and the owner explicitly asked for it — to
 *  write "68% of people report nausea on day 2". Dottie has no cohort: it is
 *  local-first, nothing leaves the phone, there is no population to aggregate.
 *  Any such number would be invented, and this app already had to strip exactly
 *  that once (the "You & 12,363 others" counters).
 *
 *  So the copy is asserted, not just reviewed: it must never claim to speak for
 *  other people, must always carry the sample size, and must stay quiet on a
 *  single occurrence rather than dressing a coincidence up as a forecast.
 *
 * Run: npm run test:recall
 */

import {
  recallSymptoms,
  recallForDay,
  detectPremenstrualSignal,
  type SymptomLog,
} from '../src/engine/symptoms/symptom-recall';
import { addDays } from '../src/utils/civil-date';

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

const TODAY = '2026-09-04';
// Three past periods, roughly 28 days apart.
const STARTS = ['2026-08-10', '2026-07-13', '2026-06-15'];
const log = (date: string, symptomType: string, severity = 3): SymptomLog => ({
  date,
  symptomType,
  severity,
});

// ─── R1 — nothing to say ─────────────────────────────────────────────

scenario('R1 · with no data it stays silent rather than guessing', () => {
  const none = recallSymptoms({ symptoms: [], periodStarts: STARTS });
  ok('flagged empty', none.empty);
  ok('no items invented', none.items.length === 0);
  ok('no line for any day', recallForDay(none, 1) === null);

  const noPeriods = recallSymptoms({
    symptoms: [log('2026-08-11', 'nausea')],
    periodStarts: [],
  });
  ok('no period starts → nothing to anchor to', noPeriods.empty);
});

// ─── R2 — alignment to the day of the period ─────────────────────────

scenario('R2 · symptoms are aligned to the day OF THE PERIOD', () => {
  const r = recallSymptoms({
    symptoms: [
      log('2026-08-11', 'nausea'), // day 2
      log('2026-07-14', 'nausea'), // day 2
      log('2026-06-16', 'nausea'), // day 2
    ],
    periodStarts: STARTS,
  });
  const nausea = r.items.find((i) => i.symptomType === 'nausea')!;
  ok('found it', !!nausea);
  ok('typical day is 2, not a calendar date', nausea.typicalDay === 2, String(nausea.typicalDay));
  ok('seen in all three cycles', nausea.occurrences === 3, String(nausea.occurrences));
  ok('denominator is the three periods', nausea.cycles === 3, String(nausea.cycles));
  ok('marked as repeating', nausea.repeated);
});

scenario('R3 · symptoms outside the bleeding window are ignored', () => {
  const r = recallSymptoms({
    symptoms: [
      log('2026-08-11', 'nausea'), // day 2 — counts
      log('2026-08-25', 'nausea'), // mid-cycle — must not count
    ],
    periodStarts: STARTS,
    windowDays: 6,
  });
  const nausea = r.items.find((i) => i.symptomType === 'nausea')!;
  ok('only the in-window log counted', nausea.occurrences === 1, String(nausea.occurrences));
});

scenario('R4 · the earliest day in a cycle wins, not the last re-log', () => {
  const r = recallSymptoms({
    symptoms: [
      log('2026-08-10', 'cramps'), // day 1
      log('2026-08-12', 'cramps'), // day 3, same period
    ],
    periodStarts: STARTS,
  });
  const cramps = r.items.find((i) => i.symptomType === 'cramps')!;
  ok('counted once for that cycle', cramps.occurrences === 1, String(cramps.occurrences));
  ok('the day recorded is when it STARTED', cramps.typicalDay === 1, String(cramps.typicalDay));
});

scenario('R5 · low-severity noise is filtered out', () => {
  const r = recallSymptoms({
    symptoms: [log('2026-08-11', 'nausea', 1), log('2026-07-14', 'nausea', 1)],
    periodStarts: STARTS,
  });
  ok('severity-1 logs do not become a pattern', r.empty, JSON.stringify(r.items));
});

// ─── R6 — the honesty rules ──────────────────────────────────────────

scenario('R6 · a single occurrence is NOT presented as a forecast', () => {
  const r = recallSymptoms({
    symptoms: [log('2026-08-11', 'nausea')],
    periodStarts: STARTS,
  });
  const nausea = r.items.find((i) => i.symptomType === 'nausea')!;
  ok('it is recorded', nausea.occurrences === 1);
  ok('but NOT marked as repeating', !nausea.repeated);
  ok('and no day-line is offered for it', recallForDay(r, 2) === null);
});

scenario('R7 · the copy never speaks for other people', () => {
  const r = recallSymptoms({
    symptoms: [
      log('2026-08-11', 'nausea'),
      log('2026-07-14', 'nausea'),
      log('2026-08-10', 'cramps'),
      log('2026-07-13', 'cramps'),
    ],
    periodStarts: STARTS,
  });
  const lines = [r.summary, recallForDay(r, 1) ?? '', recallForDay(r, 2) ?? ''].filter(Boolean);
  ok('there are lines to check', lines.length >= 2, String(lines.length));

  // No population claims — Dottie has no cohort to speak for.
  const population = /\b(\d+\s*%|most people|people report|others report|users|average (woman|person))\b/i;
  lines.forEach((l) =>
    ok(`"${l.slice(0, 46)}…" makes no population claim`, !population.test(l), l)
  );

  // No diagnosis, no instruction.
  const clinical = /\b(diagnos\w*|disorder|abnormal|you should see|treat\w*|condition)\b/i;
  lines.forEach((l) => ok(`"${l.slice(0, 46)}…" is non-diagnostic`, !clinical.test(l), l));

  // The sample size must be visible wherever a claim is made.
  const dayLine = recallForDay(r, 2)!;
  ok('the day line states the sample size', /\d+ of your last \d+/.test(dayLine), dayLine);
  ok('the day line is hedged', /may|might|worth/i.test(dayLine), dayLine);
  ok('the summary states how many periods it drew on', /last \d+ periods/.test(r.summary), r.summary);
});

scenario('R8 · one period of data says so explicitly', () => {
  const r = recallSymptoms({
    symptoms: [log('2026-08-11', 'nausea'), log('2026-08-12', 'cramps')],
    periodStarts: STARTS,
  });
  ok('admits it is drawing on one period', /one period/i.test(r.summary), r.summary);
  ok('invites more data rather than concluding', /log another/i.test(r.summary), r.summary);
});

// ─── R9 — ordering ───────────────────────────────────────────────────

scenario('R9 · the most consistent things come first', () => {
  const r = recallSymptoms({
    symptoms: [
      log('2026-08-12', 'headache'),
      log('2026-08-10', 'cramps'),
      log('2026-07-13', 'cramps'),
      log('2026-06-15', 'cramps'),
    ],
    periodStarts: STARTS,
  });
  ok('cramps (3 cycles) outranks headache (1)',
    r.items[0]?.symptomType === 'cramps', r.items.map((i) => i.symptomType).join());
});

// ─── R10 — the PMS signal the predictor was never given ──────────────

scenario('R10 · the premenstrual signal needs real evidence', () => {
  const two: SymptomLog[] = [
    log(addDays(TODAY, -1), 'cramps'),
    log(addDays(TODAY, -1), 'bloating'),
  ];
  ok('two distinct markers in range → signal', detectPremenstrualSignal(two, TODAY));

  ok('a single marker is NOT a signal',
    !detectPremenstrualSignal([log(addDays(TODAY, -1), 'cramps')], TODAY));
  ok('the same marker twice is NOT a signal',
    !detectPremenstrualSignal(
      [log(addDays(TODAY, -1), 'cramps'), log(addDays(TODAY, -2), 'cramps')],
      TODAY
    ));
  ok('stale markers do not count',
    !detectPremenstrualSignal(
      [log(addDays(TODAY, -20), 'cramps'), log(addDays(TODAY, -20), 'bloating')],
      TODAY
    ));
  ok('unrelated symptoms do not count',
    !detectPremenstrualSignal(
      [log(addDays(TODAY, -1), 'sore_throat'), log(addDays(TODAY, -1), 'fever')],
      TODAY
    ));
  ok('severity-1 logs do not count',
    !detectPremenstrualSignal(
      [log(addDays(TODAY, -1), 'cramps', 1), log(addDays(TODAY, -1), 'bloating', 1)],
      TODAY
    ));
});

// ─── R11 — defensive ─────────────────────────────────────────────────

scenario('R11 · junk data cannot break it', () => {
  const r = recallSymptoms({
    symptoms: [
      log('not-a-date', 'nausea'),
      log('2026-08-11', ''),
      { date: '2026-08-11', symptomType: 'nausea', severity: Number.NaN },
      log('2026-08-11', 'nausea'),
      log('2026-07-14', 'nausea'),
    ],
    periodStarts: ['bogus', ...STARTS],
  });
  ok('only the real logs survive',
    r.items.length === 1 && r.items[0]!.occurrences === 2,
    JSON.stringify(r.items));
  ok('a bogus period start is dropped', r.items[0]!.cycles === 3, String(r.items[0]!.cycles));
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Symptom recall harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
