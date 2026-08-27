/**
 * Dottie — Day Suggestion Engine (Calendar Planner · design-v2)
 *
 * Turns a single calendar day into a set of gentle, NON-DIAGNOSTIC suggestions:
 * what the phase tends to feel like, a soft heads-up if a period is near, and
 * ideas for comfort / food / movement — tuned by the user's mode and any health
 * conditions (PCOS / endometriosis / thyroid).
 *
 * ─── DESIGN PRINCIPLES ──────────────────────────────────────────────
 *
 *  • NON-DIAGNOSTIC, always. These are supportive ideas, never medical advice —
 *    same discipline as `engine/reports/condition-signals`. Every set carries a
 *    disclaimer, and the copy avoids clinical claims ("ideas", "tends to", "may").
 *  • Additive & pure. No I/O, no store reads — the screen passes everything in.
 *    Deterministic for a given input, so it's trivially testable.
 *  • The user is always in charge — the UI lets them dismiss/ignore any of this.
 *
 * ─── HOW IT COMPOSES ────────────────────────────────────────────────
 *
 *   base phase ideas  →  prepend period-proximity ideas (supplies/comfort)
 *                     →  apply condition modifiers (PCOS/endo/thyroid)
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Pure logic — reason carefully.
 */

import { Phase, UserMode, HealthCondition } from '../../types/cycle.types';

// ─── PUBLIC TYPES ────────────────────────────────────────────────────

export type SuggestionCategory = 'supplies' | 'comfort' | 'food' | 'movement' | 'mind';

export interface DaySuggestion {
  id: string;
  category: SuggestionCategory;
  emoji: string;
  title: string;
  detail: string;
}

export interface DayPrediction {
  /** 'due' = likely today, 'soon' = within a few days, 'window' = approaching. */
  tone: 'due' | 'soon' | 'window';
  text: string;
}

export interface DaySuggestionSet {
  phase: Phase;
  phaseLabel: string;
  /** Short headline for the day, e.g. "Winding down". */
  headline: string;
  /** Optional soft period heads-up. */
  prediction: DayPrediction | null;
  /** One warm, non-diagnostic line (the UI prefixes the companion). */
  companionLine: string;
  suggestions: DaySuggestion[];
  disclaimer: string;
}

export interface DaySuggestionInput {
  phase: Phase;
  /** Days until the predicted next period; null if unknown; negative = overdue. */
  daysUntilPredictedPeriod: number | null;
  /** True if this exact day is already logged as a period day. */
  isPeriodDay: boolean;
  mode: UserMode;
  conditions: HealthCondition[];
}

const DISCLAIMER = 'Gentle ideas, not medical advice — take what helps, skip the rest. 💛';

const PHASE_LABEL: Record<Phase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

const PHASE_HEADLINE: Record<Phase, string> = {
  menstrual: 'Rest & reset',
  follicular: 'Rising energy',
  ovulatory: 'Peak & social',
  luteal: 'Winding down',
};

// ─── PUBLIC API ──────────────────────────────────────────────────────

export function buildDaySuggestions(input: DaySuggestionInput): DaySuggestionSet {
  const { phase, conditions } = input;
  const hasPcos = conditions.includes('pcos');
  const hasEndo = conditions.includes('endometriosis');
  const hasThyroid = conditions.includes('thyroid');

  const prediction = buildPrediction(input, hasPcos);

  // Compose: proximity supplies first (most actionable), then phase base.
  const suggestions: DaySuggestion[] = [
    ...proximitySuggestions(input, prediction),
    ...phaseSuggestions(phase, { hasPcos, hasEndo, hasThyroid }),
  ];

  return {
    phase,
    phaseLabel: PHASE_LABEL[phase],
    headline: PHASE_HEADLINE[phase],
    prediction,
    companionLine: companionLine(phase, prediction),
    suggestions: dedupeByCategoryTitle(suggestions),
    disclaimer: DISCLAIMER,
  };
}

// ─── PREDICTION HEADS-UP ─────────────────────────────────────────────

function buildPrediction(input: DaySuggestionInput, hasPcos: boolean): DayPrediction | null {
  const { daysUntilPredictedPeriod: d, isPeriodDay } = input;
  if (isPeriodDay) return { tone: 'due', text: 'A period day — be extra kind to yourself today.' };
  if (d === null) return null;

  // PCOS cycles are often less regular — soften the certainty of the window.
  const softener = hasPcos ? ' (windows can shift with PCOS — this is just a guess)' : '';

  if (d <= 0) return { tone: 'due', text: `A period is likely around now${softener}.` };
  if (d <= 3) return { tone: 'soon', text: `Period likely in about ${d} ${plural(d, 'day')}${softener}.` };
  if (d <= 6) return { tone: 'window', text: `Your window is approaching — about ${d} days out${softener}.` };
  return null;
}

function proximitySuggestions(input: DaySuggestionInput, prediction: DayPrediction | null): DaySuggestion[] {
  if (!prediction) return [];
  const out: DaySuggestion[] = [];

  if (prediction.tone === 'soon' || prediction.tone === 'window') {
    out.push({
      id: 'sup_restock',
      category: 'supplies',
      emoji: '🩸',
      title: 'Restock supplies',
      detail: 'A good day to make sure pads / tampons / your cup are ready to go.',
    });
    out.push({
      id: 'com_kit',
      category: 'comfort',
      emoji: '🎒',
      title: 'Pack a comfort kit',
      detail: 'Tuck a spare + a painkiller into your bag so the first day is easy.',
    });
  }
  if (prediction.tone === 'due') {
    out.push({
      id: 'com_cozy',
      category: 'comfort',
      emoji: '🧣',
      title: 'Set up for cozy',
      detail: 'Heat pad, comfy waistband, water nearby. Lighten the day where you can.',
    });
  }
  return out;
}

// ─── PHASE BASE (with condition modifiers) ───────────────────────────

interface Cond { hasPcos: boolean; hasEndo: boolean; hasThyroid: boolean }

function phaseSuggestions(phase: Phase, c: Cond): DaySuggestion[] {
  switch (phase) {
    case 'menstrual':
      return [
        food('Iron & magnesium', c.hasEndo
          ? 'Anti-inflammatory + iron: leafy greens, lentils, omega-3s. Go easy on processed foods.'
          : 'Iron-rich foods (greens, beans) + magnesium (dark chocolate, nuts) can ease cramps.'),
        comfort('Warmth helps', c.hasEndo
          ? 'Heat early and rest without guilt — honor a heavier day.'
          : 'A heat pad and soft, loose clothing tend to feel best today.'),
        movement('Gentle only', 'Walks, stretching, restorative yoga. Skip the PRs.'),
        mind('Rest is productive', 'Lower the bar today. Recovery is doing something, not nothing.'),
      ];
    case 'follicular':
      return [
        food('Fresh & building', c.hasPcos
          ? 'Protein + fiber with steady carbs (lower-GI) to keep energy even.'
          : 'Fresh produce and protein support the energy that\'s climbing now.'),
        movement('Try something new', c.hasThyroid
          ? 'Energy may be returning — build gently, no need to overdo it.'
          : 'A good window for higher-intensity movement or a new class.'),
        mind('Great day to plan', 'Focus and motivation tend to rise — start that thing.'),
      ];
    case 'ovulatory':
      return [
        food('Light & bright', c.hasPcos
          ? 'Fiber + protein to steady blood sugar around the peak.'
          : 'Lighter meals with fiber sit well around your peak.'),
        movement('Peak strength', 'Often the strongest days — lean into it if it feels good.'),
        comfort('Breathable layers', 'You may run warm; breathable fabrics feel best.'),
        mind('Social energy high', 'A natural day for conversations and big asks.'),
      ];
    case 'luteal':
      return [
        food('Steady the mood', c.hasPcos
          ? 'Complex carbs paired with protein; lower-GI choices help avoid the crash.'
          : 'Complex carbs + magnesium steady mood; easing salt can help bloating.'),
        comfort('Comfy over fitted', 'Softer waistbands and flowy layers as bloating tends to peak.'),
        movement('Moderate & kind', c.hasEndo
          ? 'Gentle strength or pilates; rest when pain says so.'
          : 'Moderate strength or pilates — meet your energy where it is.'),
        mind('Be gentle with you', 'If you feel more sensitive, that\'s biology — not a flaw.'),
      ];
  }
}

// ─── SUGGESTION BUILDERS ─────────────────────────────────────────────

function food(title: string, detail: string): DaySuggestion {
  return { id: `food_${slug(title)}`, category: 'food', emoji: '🍽️', title, detail };
}
function comfort(title: string, detail: string): DaySuggestion {
  return { id: `com_${slug(title)}`, category: 'comfort', emoji: '👗', title, detail };
}
function movement(title: string, detail: string): DaySuggestion {
  return { id: `mov_${slug(title)}`, category: 'movement', emoji: '🧘', title, detail };
}
function mind(title: string, detail: string): DaySuggestion {
  return { id: `mind_${slug(title)}`, category: 'mind', emoji: '💭', title, detail };
}

// ─── COMPANION LINE ──────────────────────────────────────────────────

function companionLine(phase: Phase, prediction: DayPrediction | null): string {
  if (prediction?.tone === 'due') return 'A tender day — a little prep makes it softer. I\'ve got you.';
  if (prediction?.tone === 'soon') return 'A few gentle things now make next week kinder to you.';
  switch (phase) {
    case 'menstrual': return 'Rest is the move today. Take what you need.';
    case 'follicular': return 'Fresh energy is rising — what feels possible?';
    case 'ovulatory': return 'You\'re glowing right about now. Enjoy it.';
    case 'luteal': return 'Softer days ask for softer plans. That\'s allowed.';
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function plural(n: number, word: string): string {
  return Math.abs(n) === 1 ? word : `${word}s`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Keep the first suggestion per (category+title) so composition never duplicates. */
function dedupeByCategoryTitle(items: DaySuggestion[]): DaySuggestion[] {
  const seen = new Set<string>();
  const out: DaySuggestion[] = [];
  for (const s of items) {
    const key = `${s.category}::${s.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
