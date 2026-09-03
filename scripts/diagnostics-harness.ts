/**
 * Dottie — Diagnostics Harness
 *
 * Invariants for src/diagnostics/log-format.ts — the pure layer of the
 * owner-requested shareable logger.
 *
 * The rule that matters most: a diagnostic log LEAVES the phone, and this app
 * holds menstrual-health data. By default the log must carry the SHAPE of what
 * happened and never the CONTENT. These tests are the guard on that.
 *
 * Run: npm run test:diag
 */

import {
  isPrivateKey,
  maskValue,
  redactData,
  formatEvent,
  formatReport,
  boundBuffer,
  formatClock,
  type LogEvent,
} from '../src/diagnostics/log-format';

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

const ev = (over: Partial<LogEvent> = {}): LogEvent => ({
  t: new Date('2026-09-03T10:20:30.400').getTime(),
  lvl: 'info',
  cat: 'tap',
  msg: 'calendar:Done',
  ...over,
});

// ─── G1 — what counts as private ─────────────────────────────────────

scenario('G1 — health-bearing keys are recognised', () => {
  for (const k of ['date', 'periodDate', 'startDate', 'flow', 'flowLevel', 'moodScore',
                   'symptomType', 'note', 'displayName', 'severity', 'phase', 'pin']) {
    ok(`"${k}" is private`, isPrivateKey(k));
  }
  for (const k of ['ms', 'count', 'index', 'screen', 'ok', 'threshold']) {
    ok(`"${k}" is not private`, !isPrivateKey(k));
  }
});

scenario('G2 — masking keeps the SHAPE, loses the content', () => {
  ok('a date becomes <date>', maskValue('2026-09-01') === '<date>', maskValue('2026-09-01'));
  ok('a number becomes #', maskValue(3) === '#');
  ok('a boolean survives (not personal)', maskValue(true) === 'true');
  ok('null survives', maskValue(null) === 'null');
  ok('free text becomes a length', maskValue('Vitamin D') === '<9 chars>', maskValue('Vitamin D'));
  ok('the raw text never leaks', !maskValue('Vitamin D').includes('Vitamin'));
});

// ─── G3 — redaction end to end ───────────────────────────────────────

scenario('G3 — redacted by default, raw only when the user opts in', () => {
  const data = { date: '2026-09-01', flowLevel: 3, ms: 4300, screen: 'calendar' };

  const safe = redactData(data, false)!;
  ok('the date is masked', safe.date === '<date>');
  ok('the flow level is masked', safe.flowLevel === '#');
  ok('non-personal timing survives', safe.ms === 4300);
  ok('non-personal screen name survives', safe.screen === 'calendar');

  const full = redactData(data, true)!;
  ok('opt-in keeps the real date', full.date === '2026-09-01');
  ok('opt-in keeps the real flow', full.flowLevel === 3);

  ok('undefined stays undefined', redactData(undefined, false) === undefined);
});

scenario('G4 — a rendered line never leaks a real date by default', () => {
  const line = formatEvent(ev({ cat: 'action', msg: 'logPeriodDay', data: { date: '2026-09-01', flowLevel: 4 } }), false);
  ok('the action name is present', line.includes('logPeriodDay'));
  ok('the real date is NOT present', !line.includes('2026-09-01'), line);
  ok('the shape is present', line.includes('<date>'), line);
});

// ─── G5 — line + report format ───────────────────────────────────────

scenario('G5 — lines carry time, category and the gap since the last event', () => {
  const a = ev();
  const b = ev({ t: a.t + 4300, cat: 'freeze', lvl: 'error', msg: 'js-thread-stalled', data: { ms: 4300 } });
  const line = formatEvent(b, false, a.t);
  ok('shows the category', line.includes('[freeze/error]'), line);
  ok('shows the gap, which is how a stall is spotted', line.includes('+4300ms'), line);
  ok('shows the clock', line.includes(formatClock(b.t)), line);
  ok('first event has no gap', !formatEvent(a, false).includes('+'), formatEvent(a, false));
});

scenario('G6 — the report header states the privacy mode', () => {
  const redacted = formatReport([ev()], false, { app: 'v1' });
  ok('redacted mode is stated', /REDACTED/.test(redacted), redacted.split('\n')[3]);
  const full = formatReport([ev()], true, { app: 'v1' });
  ok('full mode is stated plainly', /FULL/.test(full));
  ok('header carries context', redacted.includes('app: v1'));
  ok('event count is reported', redacted.includes('events: 1'));
});

// ─── G7 — the buffer stays bounded ───────────────────────────────────

scenario('G7 — the buffer is bounded and keeps the NEWEST events', () => {
  const many = Array.from({ length: 50 }, (_, i) => ev({ t: i, msg: `e${i}` }));
  const bounded = boundBuffer(many, 10);
  ok('bounded to the max', bounded.length === 10, `got ${bounded.length}`);
  ok('keeps the newest (the ones near the crash)', bounded[bounded.length - 1]?.msg === 'e49');
  ok('drops the oldest', bounded[0]?.msg === 'e40');
  ok('under the limit is untouched', boundBuffer(many.slice(0, 5), 10).length === 5);
  ok('zero max is empty, not a crash', boundBuffer(many, 0).length === 0);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────

if (failures === 0) {
  console.log('\n\x1b[32m✓ Diagnostics harness — all invariants hold.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\n\x1b[31m✗ ${failures} assertion(s) failed.\x1b[0m`);
  process.exit(1);
}
