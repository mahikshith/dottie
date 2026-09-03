/**
 * Dottie — chart-data
 *
 * Pure builders for the figures in the prediction explainer. Kept OUT of the
 * components so every number on screen is testable in Node (see
 * `scripts/chart-data-harness.ts`) and so the charts can never invent data:
 * if the inputs are thin, these functions say so via `provisional`/`source`
 * rather than drawing a confident-looking line over nothing.
 *
 * ─── WHY THESE THREE FIGURES ────────────────────────────────────────
 *
 *  Competitor apps (Flo's "cycle length variation" bars, Clue's cycle-history
 *  strip, Natural Cycles' deviation band) all converge on the same trio, and
 *  each answers a different question the owner asked out loud:
 *
 *   1. WHEN will it start?      → the log-normal density (existing chart)
 *   2. Am I regular?            → cycle-length history vs. the mean ± SD band
 *   3. Which days will be bad?  → predicted flow heaviness per period day
 *
 *  2 is the one that makes "standard deviation" mean something: the band IS
 *  the SD, drawn around the user's own dots.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  Nothing here labels a cycle "irregular", "abnormal" or "a problem". Spread
 *  is described, never judged; the heaviness curve is explicitly "what most
 *  people report", not a claim about this body.
 */

import type { CycleRecord } from '../../types/cycle.types';

// ─── CYCLE-LENGTH HISTORY ────────────────────────────────────────────

export interface CycleLengthPoint {
  /** ISO start date of the cycle this length was measured from. */
  startDate: string;
  /** Total days start-to-start. */
  length: number;
  /** 1-based index, oldest first — the x position. */
  index: number;
}

export interface CycleLengthSeries {
  points: CycleLengthPoint[];
  /** Arithmetic mean of the plotted lengths (0 when there are none). */
  mean: number;
  /** Sample SD of the plotted lengths (0 with fewer than 2 points). */
  sd: number;
  /** Plot domain, padded so dots never touch the frame. */
  minLength: number;
  maxLength: number;
  /** True when there is not yet enough history to draw a real series. */
  provisional: boolean;
  /** One line under the figure, in Dottie's voice. */
  caption: string;
}

/** Cycles longer than this are data-entry noise, not cycles. */
const MIN_PLOTTABLE = 15;
const MAX_PLOTTABLE = 90;

/**
 * Build the cycle-length history series from logged cycles.
 *
 * `limit` keeps the strip readable on a phone — the most RECENT n cycles, in
 * chronological order (oldest left), which is how every tracker draws it.
 */
export function buildCycleLengthSeries(
  history: CycleRecord[],
  limit = 12
): CycleLengthSeries {
  const usable = history
    .filter(
      (c) =>
        Number.isFinite(c.cycleLength) &&
        c.cycleLength >= MIN_PLOTTABLE &&
        c.cycleLength <= MAX_PLOTTABLE
    )
    // Chronological: repositories hand back newest-first, and a left-to-right
    // time axis is the whole point of the figure.
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));

  const recent = usable.slice(Math.max(0, usable.length - limit));

  const points: CycleLengthPoint[] = recent.map((c, i) => ({
    startDate: c.startDate,
    length: c.cycleLength,
    index: i + 1,
  }));

  const n = points.length;
  const mean = n > 0 ? points.reduce((s, p) => s + p.length, 0) / n : 0;
  const sd =
    n > 1
      ? Math.sqrt(points.reduce((s, p) => s + (p.length - mean) ** 2, 0) / (n - 1))
      : 0;

  // Domain always includes the ±SD band so the band is never clipped.
  const lo = n > 0 ? Math.min(...points.map((p) => p.length), mean - sd) : 24;
  const hi = n > 0 ? Math.max(...points.map((p) => p.length), mean + sd) : 32;
  const pad = Math.max(1, (hi - lo) * 0.15);

  return {
    points,
    mean: round1(mean),
    sd: round1(sd),
    minLength: Math.floor(lo - pad),
    maxLength: Math.ceil(hi + pad),
    provisional: n < 2,
    caption: cycleLengthCaption(n, round1(mean), round1(sd)),
  };
}

function cycleLengthCaption(n: number, mean: number, sd: number): string {
  if (n === 0) {
    return 'Nothing plotted yet — each period you log adds a dot here, and the band around them is your own spread.';
  }
  if (n === 1) {
    return 'One cycle so far. The band appears once there are two, because spread needs at least two numbers.';
  }
  const spread =
    sd <= 1.5
      ? 'Your cycles have been landing close together, which is what tightens the window.'
      : sd <= 4
        ? 'There is some natural month-to-month variation here — very common, and the window widens to hold it.'
        : 'These have varied quite a bit month to month. That is common too; it just means a wider window until a pattern settles.';
  return `${n} cycles, averaging ${mean} days. The shaded band is ±${sd} days — your own standard deviation. ${spread}`;
}

// ─── FLOW HEAVINESS BY PERIOD DAY ────────────────────────────────────

export interface FlowDayPoint {
  /** 1-based day of the period. */
  day: number;
  /** 0–1 relative heaviness. 1 = the heaviest day of this period. */
  level: number;
  /** Word shown under the bar. */
  label: 'Light' | 'Medium' | 'Heavy';
  /** True for the days flagged as the likely-heaviest stretch. */
  heavy: boolean;
}

export interface FlowShapeSeries {
  points: FlowDayPoint[];
  /** True when the shape comes from population data, not the user's own logs. */
  provisional: boolean;
  source: 'your-logs' | 'typical-pattern';
  caption: string;
}

/**
 * Predicted heaviness across the days of the next period.
 *
 * The shape (peak on days 1–2, tapering to spotting) is the well-replicated
 * population pattern. When the user has logged flow of their own we scale that
 * shape by their recorded average flow so a consistently light period doesn't
 * get drawn as a heavy one — but we never claim a per-day measurement we don't
 * have, which is why `source` is surfaced and the caption says which it is.
 */
export function buildFlowShape(
  periodLengthDays: number,
  history: CycleRecord[]
): FlowShapeSeries {
  const days = clamp(Math.round(periodLengthDays), 2, 8);

  // Relative population shape, index 0 = day 1. Days 1–2 heaviest, then taper.
  const SHAPE = [1, 0.95, 0.7, 0.45, 0.28, 0.18, 0.12, 0.08];

  const flows = history
    .map((c) => c.averageFlow)
    .filter((f) => Number.isFinite(f) && f > 0 && f <= 5);
  const hasOwn = flows.length > 0;
  const ownAvg = hasOwn ? flows.reduce((s, f) => s + f, 0) / flows.length : 3;

  // Scale the shape toward the user's own average flow (3 = the middle of the
  // 1-5 scale, so an average of 3 leaves the population shape untouched).
  const scale = clamp(0.55 + (ownAvg / 3) * 0.45, 0.5, 1);

  const points: FlowDayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const level = round2(clamp((SHAPE[i] ?? 0.06) * scale, 0.05, 1));
    points.push({
      day: i + 1,
      level,
      label: level >= 0.7 ? 'Heavy' : level >= 0.4 ? 'Medium' : 'Light',
      heavy: level >= 0.7,
    });
  }

  const heavyDays = points.filter((p) => p.heavy).map((p) => p.day);
  const heavyText =
    heavyDays.length === 0
      ? 'No single day stands out as heaviest in this shape.'
      : heavyDays.length === 1
        ? `Day ${heavyDays[0]} is usually the fullest.`
        : `Days ${heavyDays[0]}–${heavyDays[heavyDays.length - 1]} are usually the fullest.`;

  return {
    points,
    provisional: !hasOwn,
    source: hasOwn ? 'your-logs' : 'typical-pattern',
    caption: hasOwn
      ? `${heavyText} Scaled to the flow you've logged across ${flows.length} cycle${flows.length === 1 ? '' : 's'}. Yours may differ, and that's fine.`
      : `${heavyText} This is the pattern most people report — log your flow and it reshapes to yours.`,
  };
}

// ─── SMALL HELPERS ───────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
