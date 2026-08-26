/**
 * Dottie — "Dottie Predicts" Types (Canonical)
 *
 * Personal insights mined entirely from the user's own logs:
 *   - Past period start dates → cycle regularity, length trends
 *   - Past check-ins          → mood / energy / sleep patterns
 *   - Past symptoms           → recurring patterns per phase
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Every insight is built from a TEMPLATE + the user's data, so:
 *    - Copy stays warm and on-brand (no LLM hallucinations)
 *    - Insights are deterministic given the same inputs
 *    - Empty / sparse data gracefully yields NO insights instead of
 *      generic filler ("you've logged 0 cycles" would be cold)
 *
 *  This file is the SINGLE SOURCE OF TRUTH for insight shapes.
 *  Engine, store, card UI all import from here.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  Insights NEVER leave the device. They're computed on-demand and
 *  cached in-memory only. No PII, no analytics events.
 *
 * ─── EVOLUTION ──────────────────────────────────────────────────────
 *
 *  v1 (this batch) ships 8 insight types. Adding a 9th later is a
 *  pure additive change: a new entry in `InsightKind`, a new template
 *  in templates.ts, a new generator in dottie-predicts.ts. UI auto-
 *  renders any insight that conforms to `DottieInsight`.
 */

import { Phase } from './cycle.types';

// ─── INSIGHT KINDS ───────────────────────────────────────────────────

/**
 * The set of insight types Dottie can produce. Each kind has a
 * distinct generator and template — they're not interchangeable.
 *
 * The UI renders kinds in priority order (see INSIGHT_PRIORITY).
 */
export type InsightKind =
  /** "Your energy typically dips in N days — soft day coming up." */
  | 'energy_dip_ahead'
  /** "You usually feel most focused around day N — today's the day." */
  | 'focus_peak_today'
  /** "Cramps showed up around day N last cycle — heads up." */
  | 'cramp_window_ahead'
  /** "Your skin tends to clear around now — enjoy it!" */
  | 'skin_clear_window'
  /** "Your last X cycles averaged N days — you're beautifully regular." */
  | 'cycle_regularity_praise'
  /** "Your cycles have varied lately — that's okay, here's what to watch." */
  | 'cycle_irregularity_gentle'
  /** "You've logged X check-ins in a row — Dottie sees you 💛" */
  | 'consistency_celebration'
  /** "Based on your pattern, your next period is in ~N days." */
  | 'period_countdown'
  /** "You tend to log [symptom] ~N days before your period / in your [phase] phase." */
  | 'symptom_pattern_learned';

// ─── TONE & ICONOGRAPHY ──────────────────────────────────────────────

/**
 * The emotional "color" of an insight. Drives the card's accent +
 * iconography. Kept abstract on purpose — no phase coupling here, so
 * insights can be shown regardless of the user's current phase.
 */
export type InsightTone =
  | 'encouraging'  // warm yellow — celebrations + praise
  | 'gentle'       // soft pink — sensitive heads-up
  | 'heads_up'     // peach — non-alarming preparation
  | 'curious'      // sage — pattern observation
  | 'cozy';        // lavender — rest / comfort suggestions

// ─── ATOMIC SHAPES ───────────────────────────────────────────────────

/**
 * A small data point an insight references — e.g., "3 cycles",
 * "day 22", "29 days". Used for inline highlight rendering.
 */
export interface InsightHighlight {
  label: string;
  value: string;
}

// ─── INSIGHT SHAPE ───────────────────────────────────────────────────

/**
 * A single insight ready to render. Pure data — UI never computes it,
 * engine never renders it.
 *
 *  - `kind` drives priority + which generator produced it.
 *  - `title` is the headline (short, ~6 words).
 *  - `body` is the warm explanation (1–2 sentences).
 *  - `tip` is the optional gentle suggestion (a single soft action).
 *  - `highlights` surface the key numbers (for chip rendering).
 *  - `tone` drives the card accent.
 *  - `emoji` is the leading marker on the card.
 *  - `confidence` (0..1) lets the engine downgrade insights based on
 *    sparse history; UI may hide insights below a threshold.
 *  - `relatedPhase` is purely informational — used by the UI to show
 *    a phase pill when relevant.
 */
export interface DottieInsight {
  id: string; // stable per (kind + date), so memoization works
  kind: InsightKind;
  title: string;
  body: string;
  tip: string | null;
  highlights: InsightHighlight[];
  tone: InsightTone;
  emoji: string;
  confidence: number;
  relatedPhase: Phase | null;
}

// ─── DECK SHAPE ──────────────────────────────────────────────────────

/**
 * The complete daily "deck" of insights Dottie has for the user.
 *
 *  - Always present (the UI handles empty decks gracefully).
 *  - Up to MAX_INSIGHTS_PER_DAY, ranked by priority × confidence.
 *  - Tied to a date so cross-midnight rollover regenerates cleanly.
 */
export interface DottiePredictsDeck {
  /** ISO date this deck covers (YYYY-MM-DD). */
  date: string;
  /** ISO timestamp when the deck was generated. */
  generatedAt: string;

  /** Ranked insights — empty array is a valid, common state. */
  insights: DottieInsight[];

  /**
   * True when the deck is empty because the user simply doesn't have
   * enough data yet (vs. a true "nothing to say" day). UI uses this
   * to switch between an encouraging "log a few more days" hint and
   * a neutral "Dottie is listening" state.
   */
  isLearning: boolean;

  /**
   * Number of cycles the engine had access to when generating.
   * Drives the "Dottie is still learning your rhythm" affordance —
   * the first few cycles surface lower-confidence insights with a
   * tasteful note that more cycles unlock deeper predictions.
   */
  cyclesAvailable: number;
}

// ─── INSIGHT PRIORITY ────────────────────────────────────────────────

/**
 * Higher number = ranked first in the deck. Tunable without touching
 * the generators. Priority is multiplicative with confidence at sort time.
 *
 * Rationale:
 *  - Period countdown is the most actionable → highest priority
 *  - Heads-ups (cramps, energy) come next
 *  - Praise + curiosity insights are gentle accompaniment
 */
export const INSIGHT_PRIORITY: Record<InsightKind, number> = {
  period_countdown: 100,
  cramp_window_ahead: 90,
  energy_dip_ahead: 85,
  focus_peak_today: 75,
  // A learned personal symptom pattern is high-value ("Dottie *gets* me"),
  // but sits just under the actionable heads-ups.
  symptom_pattern_learned: 72,
  skin_clear_window: 60,
  cycle_irregularity_gentle: 55,
  cycle_regularity_praise: 45,
  consistency_celebration: 40,
};

// ─── DECK BUDGET ─────────────────────────────────────────────────────

/** Hard cap so the home screen never feels overloaded. */
export const MAX_INSIGHTS_PER_DAY = 3;

/** Insights below this confidence are filtered out entirely. */
export const MIN_INSIGHT_CONFIDENCE = 0.35;
