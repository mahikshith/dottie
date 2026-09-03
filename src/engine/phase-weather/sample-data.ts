/**
 * Dottie — Phase Weather Sample Distribution (MVP)
 *
 * Hand-crafted distribution that drives the local Phase Weather demo
 * during the MVP phase. We deliberately don't randomize wildly — the
 * weather should feel like a real community pulse, with a believable
 * dominant phase, a believable top-3 of feelings, and a population
 * size that hints at scale without overpromising.
 *
 * ─── WHY HAND-CRAFTED ───────────────────────────────────────────────
 *
 *  - Real community data is tightly skewed (most users in follicular +
 *    luteal, a smaller share in menstrual + ovulatory at any moment).
 *  - Feelings and cravings cluster around a few recognizable themes.
 *  - Pure random noise would feel synthetic to testers.
 *
 *  We model "shape", not "exact values". The aggregator perturbs these
 *  slightly with a date-seeded variation so the snapshot looks fresh
 *  each day without feeling glitchy.
 *
 * ─── HOW TO EVOLVE LATER ────────────────────────────────────────────
 *
 *  When real backend data lands:
 *    - This file becomes the fallback used only when network fails.
 *    - The aggregator gains a `source: 'remote' | 'local'` parameter.
 *    - UI doesn't change.
 */

import { Phase } from '../../types/cycle.types';

// ─── BASE POPULATION (typical distribution of a women's-health app) ─

export interface BasePhaseShare {
  phase: Phase;
  /** Approximate share of population in this phase at any given moment. */
  share: number;
  emoji: string;
}

/**
 * These shares sum to ~1.0. Derived from menstrual cycle math: average
 * cycle ≈ 28 days, period ≈ 5 days, ovulation window ≈ 5 days. The
 * remainder splits between follicular and luteal.
 */
export const BASE_PHASE_DISTRIBUTION: BasePhaseShare[] = [
  { phase: 'menstrual',  share: 0.18, emoji: '🌊' },
  { phase: 'follicular', share: 0.32, emoji: '🌱' },
  { phase: 'ovulatory',  share: 0.18, emoji: '☀️' },
  { phase: 'luteal',     share: 0.32, emoji: '🌙' },
];

// ─── FEELINGS POOL (by phase — most common emotional themes) ────────

export interface SampleFeeling {
  label: string;
  emoji: string;
  /** Phases this feeling is most associated with. */
  associatedPhases: Phase[];
  /** Weight (higher = more likely to top the list). */
  baseWeight: number;
}

export const FEELINGS_POOL: SampleFeeling[] = [
  // Menstrual-heavy
  { label: 'cozy',        emoji: '🧣', associatedPhases: ['menstrual'],              baseWeight: 80 },
  { label: 'reflective',  emoji: '🌧️', associatedPhases: ['menstrual'],              baseWeight: 70 },
  { label: 'tired',       emoji: '😴', associatedPhases: ['menstrual', 'luteal'],    baseWeight: 90 },

  // Follicular-heavy
  { label: 'hopeful',     emoji: '🌱', associatedPhases: ['follicular'],             baseWeight: 95 },
  { label: 'focused',     emoji: '🧠', associatedPhases: ['follicular'],             baseWeight: 85 },
  { label: 'creative',    emoji: '🎨', associatedPhases: ['follicular', 'ovulatory'], baseWeight: 75 },

  // Ovulatory-heavy
  { label: 'energized',   emoji: '⚡', associatedPhases: ['ovulatory'],              baseWeight: 90 },
  { label: 'social',      emoji: '💛', associatedPhases: ['ovulatory'],              baseWeight: 80 },
  { label: 'confident',   emoji: '✨', associatedPhases: ['ovulatory', 'follicular'], baseWeight: 78 },

  // Luteal-heavy
  { label: 'sensitive',   emoji: '🌷', associatedPhases: ['luteal'],                 baseWeight: 80 },
  { label: 'introspective', emoji: '📖', associatedPhases: ['luteal', 'menstrual'],  baseWeight: 70 },
  { label: 'patient',     emoji: '🌿', associatedPhases: ['luteal'],                 baseWeight: 65 },

  // Universal
  { label: 'grateful',    emoji: '🙏', associatedPhases: ['menstrual', 'follicular', 'ovulatory', 'luteal'], baseWeight: 60 },
  { label: 'curious',     emoji: '🔍', associatedPhases: ['follicular', 'ovulatory'], baseWeight: 55 },
];

// ─── CRAVINGS POOL ──────────────────────────────────────────────────

export interface SampleCraving {
  label: string;
  emoji: string;
  associatedPhases: Phase[];
  baseWeight: number;
}

export const CRAVINGS_POOL: SampleCraving[] = [
  { label: 'chocolate',       emoji: '🍫', associatedPhases: ['luteal', 'menstrual'],   baseWeight: 100 },
  { label: 'warm tea',        emoji: '🍵', associatedPhases: ['menstrual', 'luteal'],   baseWeight: 85 },
  { label: 'fresh fruit',     emoji: '🍓', associatedPhases: ['follicular', 'ovulatory'], baseWeight: 70 },
  { label: 'salty snacks',    emoji: '🥨', associatedPhases: ['luteal'],                baseWeight: 75 },
  { label: 'coffee',          emoji: '☕', associatedPhases: ['follicular', 'ovulatory'], baseWeight: 80 },
  { label: 'comfort food',    emoji: '🍜', associatedPhases: ['menstrual'],             baseWeight: 90 },
  { label: 'fresh greens',    emoji: '🥗', associatedPhases: ['follicular'],            baseWeight: 60 },
  { label: 'something sweet', emoji: '🍯', associatedPhases: ['luteal', 'menstrual'],   baseWeight: 70 },
];

// ─── SYMPTOMS POOL ──────────────────────────────────────────────────

export interface SampleSymptom {
  label: string;
  emoji: string;
  associatedPhases: Phase[];
  baseWeight: number;
}

export const SYMPTOMS_POOL: SampleSymptom[] = [
  { label: 'cramps',           emoji: '🌊', associatedPhases: ['menstrual'],            baseWeight: 95 },
  { label: 'low energy',       emoji: '🔋', associatedPhases: ['menstrual', 'luteal'],  baseWeight: 85 },
  { label: 'bloating',         emoji: '🎈', associatedPhases: ['luteal', 'menstrual'],  baseWeight: 80 },
  { label: 'mood shifts',      emoji: '🌈', associatedPhases: ['luteal'],               baseWeight: 75 },
  { label: 'skin breakout',    emoji: '🌟', associatedPhases: ['luteal'],               baseWeight: 70 },
  { label: 'restful sleep',    emoji: '🌙', associatedPhases: ['follicular'],           baseWeight: 60 },
  { label: 'clear skin',       emoji: '✨', associatedPhases: ['follicular', 'ovulatory'], baseWeight: 55 },
  { label: 'extra energy',     emoji: '⚡', associatedPhases: ['ovulatory'],            baseWeight: 70 },
  { label: 'headache',         emoji: '💫', associatedPhases: ['menstrual', 'luteal'],  baseWeight: 50 },
];

// ─── WARM MESSAGE BANK ──────────────────────────────────────────────

/**
 * One of these is picked deterministically per day so the message feels
 * fresh without being random-jarring.
 */
export const WARM_MESSAGES: string[] = [
  "You're never alone in this rhythm.",
  "A whole sisterhood is breathing with you today.",
  "Your body has company — millions of beautiful rhythms unfolding together.",
  "Wherever you are in your cycle, countless others are somewhere in theirs.",
  "Today, your body is part of something larger and softer than itself.",
  "You and so many others — all moving with the same quiet music.",
  "Cycles all over the world are humming alongside yours right now.",
];

// ─── SCALE HINT ─────────────────────────────────────────────────────

/**
 * The "feels like a real community" total. Tuned to feel believable
 * for an early-stage app — large enough to feel like company, small
 * enough to feel honest. Aggregator perturbs this slightly per day.
 */
export const BASE_TOTAL_DOTTIES = 42_108;
