/**
 * Dottie — Fertile window (pure)
 *
 * The estimated fertile days and ovulation day, drawn on the calendar.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Every serious cycle tracker marks this — it is the single most requested
 *  thing a calendar can show beyond the period itself. And Dottie was already
 *  computing it: `predictNextPeriod()` returns `predictedOvulation`, derived
 *  from the predicted date minus the luteal phase. Nothing ever drew it. Same
 *  shape of gap as the premenstrual flag the predictor accepted but was never
 *  given (device-test-12).
 *
 * ─── THE WINDOW, AND WHY IT IS THAT SHAPE ───────────────────────────
 *
 *  Sperm survive in the reproductive tract for up to ~5 days; an egg is viable
 *  for roughly 24 hours after release. So the window that matters is the 5 days
 *  BEFORE ovulation plus ovulation day itself and the day after — asymmetric,
 *  not a symmetric band around the middle of the cycle. Drawing it symmetrically
 *  is the common mistake and it is wrong on the side that matters.
 *
 * ─── HOW CONFIDENT WE ARE ALLOWED TO SOUND ──────────────────────────
 *
 *  This is estimated from CYCLE LENGTH alone. It is not measured: no LH test,
 *  no basal temperature, no cervical fluid. The luteal phase is the more stable
 *  half of the cycle, which is why counting back from the next period is the
 *  standard estimate — but ovulation still moves by days between cycles, and it
 *  moves most in exactly the cycles that are least regular.
 *
 *  So `confidence` is derived from how much history there is and how variable
 *  it is, and the copy says plainly what it is based on. A confident-looking
 *  fertile window computed from two cycles would be the worst thing in the app.
 *
 * ─── NOT CONTRACEPTION ──────────────────────────────────────────────
 *
 *  People do use calendar apps as birth control, and calendar-based methods
 *  have a high failure rate under typical use. The UI must carry that plainly
 *  wherever this window is shown — `NOT_CONTRACEPTION` below is the single
 *  wording, so it can never drift or be dropped in one place and not another.
 *  Asserted by the harness.
 */

import { addDays, daysBetween, isCivilDate } from '../../utils/civil-date';

/** The one wording. Never paraphrase this per-screen. */
export const NOT_CONTRACEPTION =
  'This is an estimate from your cycle length — not a contraceptive method, and not a fertility test.';

/** Days sperm can survive, and so how far before ovulation the window opens. */
const FERTILE_LEAD_DAYS = 5;
/** Egg viability after release — ovulation day plus one. */
const FERTILE_TRAIL_DAYS = 1;
/**
 * Luteal phase length used to count back from the next period. The luteal half
 * is the more stable one, which is why this is the standard estimate.
 */
export const LUTEAL_DAYS = 14;

export type FertileKind = 'fertile' | 'ovulation';

export interface FertileWindow {
  /** Estimated ovulation day (ISO), or null when there's nothing to base it on. */
  ovulation: string | null;
  /** First fertile day (ISO). */
  start: string | null;
  /** Last fertile day (ISO). */
  end: string | null;
  /** Every day in the window, for O(1) lookup while rendering a grid. */
  days: Map<string, FertileKind>;
  /** 0..1 — how much to trust it, from history depth and variability. */
  confidence: number;
  /** 'estimate' always; named so the UI can never imply measurement. */
  basis: 'cycle-length-estimate';
  /** One honest sentence naming what it is based on. */
  summary: string;
}

export interface FertileWindowInput {
  /** The predicted next period start (ISO) — the anchor we count back from. */
  predictedNextPeriod: string | null;
  /** Completed cycle lengths, newest first. Drives confidence. */
  cycleLengths: readonly number[];
  /** Override the luteal estimate if a caller ever has a better one. */
  lutealDays?: number;
}

const EMPTY: FertileWindow = {
  ovulation: null,
  start: null,
  end: null,
  days: new Map(),
  confidence: 0,
  basis: 'cycle-length-estimate',
  summary: '',
};

/**
 * Build the window by counting back from the predicted period.
 *
 * Deterministic: same inputs, same output, always. No randomness and no
 * "today"-dependence, so the same day renders identically whenever it is drawn.
 */
export function buildFertileWindow(input: FertileWindowInput): FertileWindow {
  const anchor = input.predictedNextPeriod;
  if (!anchor || !isCivilDate(anchor)) return EMPTY;

  const luteal = clampInt(input.lutealDays ?? LUTEAL_DAYS, 10, 16);
  const ovulation = addDays(anchor, -luteal);
  const start = addDays(ovulation, -FERTILE_LEAD_DAYS);
  const end = addDays(ovulation, FERTILE_TRAIL_DAYS);

  const days = new Map<string, FertileKind>();
  const span = daysBetween(start, end);
  for (let i = 0; i <= span; i++) {
    const iso = addDays(start, i);
    days.set(iso, iso === ovulation ? 'ovulation' : 'fertile');
  }

  const confidence = confidenceFrom(input.cycleLengths);
  return {
    ovulation,
    start,
    end,
    days,
    confidence,
    basis: 'cycle-length-estimate',
    summary: summarise(confidence, input.cycleLengths.length),
  };
}

/**
 * Confidence from history depth and variability.
 *
 * Deliberately harsh at the low end. With one or two cycles this is barely
 * better than a guess, and showing a crisp six-day band as though it were known
 * would be the most misleading thing the calendar could do.
 */
function confidenceFrom(lengths: readonly number[]): number {
  const usable = lengths.filter((n) => Number.isFinite(n) && n >= 15 && n <= 60);
  const n = usable.length;
  if (n === 0) return 0.15;
  if (n === 1) return 0.3;

  const mean = usable.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(usable.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));

  // More cycles → more trust, up to a ceiling; more spread → less.
  const depth = Math.min(1, n / 6);
  const steadiness = sd <= 1.5 ? 1 : sd <= 3 ? 0.75 : sd <= 5 ? 0.5 : 0.3;
  return round2(Math.max(0.15, Math.min(0.85, 0.35 + 0.5 * depth * steadiness)));
}

function summarise(confidence: number, cycles: number): string {
  const strength =
    confidence >= 0.7
      ? 'Your cycles have been steady enough for this to be a reasonable estimate.'
      : confidence >= 0.45
        ? 'Treat this as a rough guide — your cycle length still varies.'
        : 'This is a loose estimate; a few more logged cycles will sharpen it.';
  const basis =
    cycles === 0
      ? 'Counted back from your predicted period using a typical luteal phase.'
      : `Counted back from your predicted period, using ${cycles} logged cycle${cycles === 1 ? '' : 's'}.`;
  return `${basis} ${strength}`;
}

/** What kind of fertile day this is, if any. */
export function fertileKindFor(window: FertileWindow, iso: string): FertileKind | null {
  return window.days.get(iso) ?? null;
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
