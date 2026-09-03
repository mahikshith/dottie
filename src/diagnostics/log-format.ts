/**
 * Dottie — Diagnostic log: pure formatting + privacy redaction.
 *
 * Split out from the logger itself so every rule that matters (what gets
 * masked, how a line is rendered, how the buffer is bounded) is a pure function
 * with unit tests — scripts/diagnostics-harness.ts.
 *
 * ─── PRIVACY IS THE HARD PART ───────────────────────────────────────
 *
 *  Dottie is local-first and holds menstrual-health data, which is about as
 *  sensitive as personal data gets. A diagnostic log is meant to LEAVE the
 *  phone, so by default it must carry the SHAPE of what happened (which screen,
 *  which control, in what order, how long it took) and never the CONTENT
 *  (period dates, moods, symptoms, notes, names).
 *
 *  So values under PRIVATE_KEYS are masked unless the user explicitly turns on
 *  "include details" for a specific report. That switch is theirs to make, on a
 *  screen that says plainly what it will include — not a default we chose for
 *  them.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'nav'        // screen changes
  | 'tap'        // a control was pressed
  | 'action'     // a meaningful app action (log a period, save a check-in)
  | 'db'         // storage / query
  | 'perf'       // timings
  | 'freeze'     // the JS thread stalled
  | 'error'      // thrown / rejected
  | 'lifecycle'; // app start, background, session boundaries

export interface LogEvent {
  /** Epoch ms. */
  t: number;
  lvl: LogLevel;
  cat: LogCategory;
  /** Short, stable label — "calendar/DayDetailSheet:Done", "logPeriodDay". */
  msg: string;
  /** Small structured payload. Values under PRIVATE_KEYS are masked. */
  data?: Record<string, string | number | boolean | null>;
}

/**
 * Keys whose VALUES are personal health data or free text. Masked by default.
 * Matching is case-insensitive and substring-based, so `periodDate`,
 * `date`, `startDate` are all caught by 'date'.
 */
export const PRIVATE_KEYS: readonly string[] = [
  'date',
  'flow',
  'mood',
  'symptom',
  'note',
  'name',
  'email',
  'phase',
  'severity',
  'weight',
  'height',
  'age',
  'pin',
];

export function isPrivateKey(key: string): boolean {
  const k = key.toLowerCase();
  return PRIVATE_KEYS.some((p) => k.includes(p));
}

/**
 * Mask a value while keeping its SHAPE, which is what debugging needs:
 * a date stays recognisably a date, a number stays a number of the same width.
 */
export function maskValue(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return '#';
  // ISO date → keep the shape, lose the day.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return '<date>';
  return value.length === 0 ? '""' : `<${value.length} chars>`;
}

/** Redact a payload for sharing. `detailed` = the user opted in. */
export function redactData(
  data: Record<string, string | number | boolean | null> | undefined,
  detailed: boolean
): Record<string, string | number | boolean | null> | undefined {
  if (!data) return undefined;
  if (detailed) return data;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = isPrivateKey(k) ? maskValue(v) : v;
  }
  return out;
}

/** hh:mm:ss.mmm in local time — readable, and enough to spot a stall. */
export function formatClock(t: number): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** One compact line per event. `+123ms` is the gap since the previous event. */
export function formatEvent(e: LogEvent, detailed: boolean, prevT?: number): string {
  const gap = prevT === undefined ? '' : ` +${Math.max(0, e.t - prevT)}ms`;
  const data = redactData(e.data, detailed);
  const payload =
    data && Object.keys(data).length > 0
      ? ' ' + Object.entries(data).map(([k, v]) => `${k}=${v}`).join(' ')
      : '';
  return `${formatClock(e.t)}${gap} [${e.cat}/${e.lvl}] ${e.msg}${payload}`;
}

/** The whole report, newest LAST so it reads like a story. */
export function formatReport(
  events: readonly LogEvent[],
  detailed: boolean,
  header: Record<string, string | number>
): string {
  const head = [
    '── Dottie diagnostic log ──',
    ...Object.entries(header).map(([k, v]) => `${k}: ${v}`),
    detailed
      ? 'detail: FULL (includes cycle dates/values — you chose to include them)'
      : 'detail: REDACTED (health values masked)',
    `events: ${events.length}`,
    '───────────────────────────',
  ].join('\n');

  const lines: string[] = [];
  let prev: number | undefined;
  for (const e of events) {
    lines.push(formatEvent(e, detailed, prev));
    prev = e.t;
  }
  return `${head}\n${lines.join('\n')}`;
}

/** Keep the newest `max` events. Pure so the bound is testable. */
export function boundBuffer(events: readonly LogEvent[], max: number): LogEvent[] {
  if (max <= 0) return [];
  return events.length <= max ? [...events] : events.slice(events.length - max);
}
