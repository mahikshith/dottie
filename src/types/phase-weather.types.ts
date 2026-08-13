/**
 * Dottie — Phase Weather Types (Canonical)
 *
 * Phase Weather is a gentle, anonymous "weather report" for the global
 * Dottie community. It tells the user how many other Dotties are in the
 * same phase right now, what the top feelings and cravings are, and
 * makes them feel less alone — without ever sharing a single byte of
 * personal data.
 *
 * ─── MVP DESIGN ─────────────────────────────────────────────────────
 *
 *  v1 (this batch): All data is generated LOCALLY from a sample
 *  distribution. The aggregator is a pure function so the moment we
 *  decide to scale, we swap in a real backend source and the UI never
 *  notices the difference.
 *
 *  This keeps the experience real-feeling for our 100 testers while
 *  honoring the MVP-first principle: no backend until feedback proves
 *  it's worth building.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  Phase Weather is fundamentally ANONYMOUS by design:
 *    - No user IDs
 *    - No timestamps tied to individuals
 *    - Only aggregate counts and rankings
 *    - User's OWN phase is computed locally and shown for context only
 *
 *  This shape is identical to what a real backend would return.
 *
 * ─── SINGLE SOURCE OF TRUTH ─────────────────────────────────────────
 *
 *  Engines, stores, and UI all import from this file. If the shape ever
 *  evolves (e.g., adding a "top symptom" alongside top feeling), it
 *  evolves here first.
 */

import { Phase } from './cycle.types';

// ─── ATOMIC ENTRIES ──────────────────────────────────────────────────

/** Per-phase population count from the global pulse. */
export interface PhasePopulation {
  phase: Phase;
  count: number;
  /** Share of the population in this phase (0.0–1.0). */
  share: number;
}

/** A ranked feeling/emotion the community is reporting today. */
export interface FeelingTally {
  /** Display label (e.g., "hopeful", "tired", "energized"). */
  label: string;
  emoji: string;
  count: number;
}

/** A ranked craving the community is logging today. */
export interface CravingTally {
  label: string;
  emoji: string;
  count: number;
}

/** A ranked symptom the community is logging today. */
export interface SymptomTally {
  label: string;
  emoji: string;
  count: number;
}

// ─── TOP-LEVEL SNAPSHOT ──────────────────────────────────────────────

/**
 * A single "weather snapshot" — what the community is feeling RIGHT NOW.
 *
 * This is the only shape the UI ever sees. Engine, store, future
 * backend — they all produce this.
 */
export interface PhaseWeatherSnapshot {
  /** ISO timestamp when this snapshot was generated. */
  generatedAt: string;
  /** ISO date the snapshot covers (YYYY-MM-DD). */
  date: string;

  /** Total Dotties represented in the snapshot. */
  totalDotties: number;

  /** Population per phase (sums to totalDotties). */
  byPhase: PhasePopulation[];

  /** The dominant phase across the community right now. */
  dominantPhase: Phase;

  /** Top N feelings being logged today, ranked highest first. */
  topFeelings: FeelingTally[];

  /** Top N cravings being logged today, ranked highest first. */
  topCravings: CravingTally[];

  /** Top N symptoms being logged today, ranked highest first. */
  topSymptoms: SymptomTally[];

  /**
   * Warm one-liner the UI can render verbatim. Always present.
   * Examples:
   *   "You're never alone in this rhythm."
   *   "A whole sisterhood is breathing with you today."
   */
  warmMessage: string;

  /**
   * True if the snapshot is the locally-generated demo distribution
   * (MVP mode). UI may show a tiny tasteful "Local preview" hint so
   * testers know this is illustrative — not invasive.
   */
  isLocalPreview: boolean;
}

// ─── PERSONAL CONTEXT VIEW ───────────────────────────────────────────

/**
 * A snapshot enriched with the user's own phase, so the card can render
 * the warm "you and ___ others are in the same rhythm" line without
 * needing to read multiple stores from the UI layer.
 *
 * This is the shape the Home screen actually consumes.
 */
export interface PhaseWeatherView {
  snapshot: PhaseWeatherSnapshot;
  userPhase: Phase;
  /** How many Dotties are in the user's same phase. */
  inSameRhythmCount: number;
  /** Pretty human-readable count ("42,108", "1.2k", etc.). */
  inSameRhythmDisplay: string;
}
