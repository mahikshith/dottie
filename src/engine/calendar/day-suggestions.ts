/**
 * Dottie — Day Suggestion Engine v2 (Calendar Planner · design-v2)
 *
 * Turns a single calendar day into a rich, NON-DIAGNOSTIC set of suggestions
 * and context — the "why is today the way it is" a user gets when they open a
 * day on the calendar. Competitor scan (Flo, Clue, MyFLO, Natural Cycles,
 * cycle-syncing writeups) fed the shape:
 *
 *   Flo            — countdown-to-next, symptom-pattern detection, phase-tuned
 *                    daily tips, "talk to a doctor" flags.
 *   Clue           — SUB-PHASE resolution ("early luteal" vs "late luteal / PMS"),
 *                    hormonal narrative ("estrogen is climbing → energy tends to
 *                    lift"), a soft social signal ("many report…"), and a
 *                    "what to track" hint.
 *   MyFLO          — cycle-syncing recommendations (food / workout / focus).
 *   Natural Cycles — single-glance status; ours is the header chip.
 *
 * Where the original engine had one line per phase × category, v2 adds:
 *
 *   • SUB-PHASE resolution (9 sub-phases across the 4 phases) so the same phase
 *     doesn't say the same thing for 12 days straight.
 *   • A HORMONE STORY (one line, "tends to", non-diagnostic) per sub-phase.
 *   • A CULTURE line ("Many report …") — a soft social/normalisation signal.
 *   • `why?` on each suggestion — a 2-4 word tag tying the tip to the phase
 *     so a user sees the reasoning, not a raw list.
 *   • PERSONAL SIGNALS from today's check-in + last-7d symptom logs — flat,
 *     non-alarming ("you logged headaches recently — pack a painkiller").
 *   • TRACK-TODAY chip row — what's most useful to log in this sub-phase.
 *   • Richer pools (4-5 per category) so rotation stays fresh through the phase.
 *
 * ─── DESIGN PRINCIPLES ──────────────────────────────────────────────
 *
 *  • NON-DIAGNOSTIC, always. "Tends to", "many report", "may help" — never
 *    "you have X" or "you should do Y". Same discipline as
 *    engine/reports/condition-signals.
 *  • Additive & PURE. No I/O. Every input is passed in from the caller so the
 *    engine is trivially unit-testable (same input → same output).
 *  • Backward compatible. `DaySuggestionInput` only added OPTIONAL fields;
 *    `DaySuggestionSet` only added OPTIONAL fields. Existing callers that
 *    only render suggestions[] keep working; the sheet opts in to the rest.
 *  • Deterministic under `daySeed` — the same date always renders the same
 *    set. Personalization also feeds off deterministic inputs.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device — reason carefully.
 */

import { Phase, UserMode, HealthCondition } from '../../types/cycle.types';

// ─── PUBLIC TYPES ────────────────────────────────────────────────────

export type SuggestionCategory = 'supplies' | 'comfort' | 'food' | 'movement' | 'mind';

/**
 * A more granular slicing of the cycle than plain Phase. The four classical
 * phases stretch across many days, so the same "follicular" or "luteal"
 * suggestion set would repeat itself — Clue's insight was to say "early
 * follicular" vs "late follicular" and change the story. This is the same idea.
 *
 * Rough day-of-cycle mapping for a "typical" 28-day cycle (softened by
 * daysUntilPredictedPeriod when we have it):
 *
 *   menstrual_early     day 1-2   (heaviest, low energy)
 *   menstrual_late      day 3-5   (tapering, energy returning)
 *   follicular_early    day 6-9   (estrogen begins to climb)
 *   follicular_mid      day 10-12 (peak lightness, focused)
 *   follicular_late     day 13    (approaching ovulation)
 *   ovulation_day       day 14    (peak day)
 *   luteal_early        day 15-19 (post-ov, still bright)
 *   luteal_mid          day 20-24 (progesterone dominant, softer)
 *   luteal_late_pms     day 25-28 (PMS window, may run tender)
 */
export type SubPhase =
  | 'menstrual_early'
  | 'menstrual_late'
  | 'follicular_early'
  | 'follicular_mid'
  | 'follicular_late'
  | 'ovulation_day'
  | 'luteal_early'
  | 'luteal_mid'
  | 'luteal_late_pms';

export interface DaySuggestion {
  id: string;
  category: SuggestionCategory;
  emoji: string;
  title: string;
  detail: string;
  /**
   * A short (2-6 word) reason tying this tip to the phase. Shown as a small
   * caption under the suggestion in the UI ("aligns with rising estrogen").
   * Optional so old suggestions without a reason still render. NEW in v2.
   */
  why?: string;
}

export interface DayPrediction {
  /** 'due' = likely today, 'soon' = within a few days, 'window' = approaching. */
  tone: 'due' | 'soon' | 'window';
  text: string;
}

/**
 * A small "for you today" nudge derived from the user's own recent data — the
 * personalisation layer Flo/Clue both lean on. Never alarming, always framed
 * as a pattern from the user's logs, never a diagnosis.
 * NEW in v2.
 */
export interface PersonalSignal {
  id: string;
  emoji: string;
  /** One-line title ("Headaches around this window"). */
  title: string;
  /** One-line supportive suggestion ("A painkiller in your bag helps."). */
  detail: string;
  /** Tag on where this signal came from — for the "why we're saying this" caption. */
  source: 'recent_symptoms' | 'check_in_mood' | 'check_in_energy' | 'check_in_sleep' | 'check_in_stress';
}

/**
 * A single "what's worth logging today" nudge. Modelled on Clue's "here's what
 * others in this sub-phase are tracking" prompt — used as a lightweight way to
 * remind the user WHAT to log, not what to feel. NEW in v2.
 */
export interface TrackPrompt {
  id: string;
  emoji: string;
  label: string; // Short — fits in a chip.
}

export interface DaySuggestionSet {
  phase: Phase;
  /** Fine-grained sub-phase for headline + narrative. NEW in v2. */
  subphase: SubPhase;
  phaseLabel: string;
  /** Sub-phase label for the header chip ("Late luteal · PMS window"). NEW in v2. */
  subphaseLabel: string;
  /** Short headline for the day, e.g. "Winding down". */
  headline: string;
  /**
   * One-line non-diagnostic hormone / body narrative for this sub-phase
   * ("Progesterone tends to peak — sleep and warmth help a lot right now").
   * NEW in v2.
   */
  hormoneStory: string;
  /**
   * A soft community signal ("Many people report needing more sleep here").
   * Meant to normalise, never medicalise. NEW in v2.
   */
  cultureLine: string;
  /** Optional soft period heads-up. */
  prediction: DayPrediction | null;
  /** One warm, non-diagnostic line (the UI prefixes the companion). */
  companionLine: string;
  suggestions: DaySuggestion[];
  /** 0-3 personalised nudges from the user's own recent data. NEW in v2. */
  personalSignals: PersonalSignal[];
  /** 2-3 quick "worth tracking today" chips. NEW in v2. */
  trackPrompts: TrackPrompt[];
  disclaimer: string;
}

/**
 * Minimal shape of a symptom log the engine needs. Structurally compatible
 * with `RecentSymptom` from engine/content so callers can pass those in
 * directly (no adapter). NEW in v2.
 */
export interface DaySuggestionSymptom {
  symptomType: string;
  severity: number; // 1-10
  date: string; // ISO YYYY-MM-DD
  category?: string;
}

/**
 * Today's check-in summary the engine looks at for personal signals. All
 * fields optional so it degrades gracefully when the user hasn't checked in.
 * NEW in v2.
 */
export interface DaySuggestionCheckIn {
  moodScore?: number | null;    // 1-5
  energyLevel?: number | null;  // 1-5
  sleepQuality?: number | null; // 1-5
  stressLevel?: number | null;  // 1-5
}

export interface DaySuggestionInput {
  phase: Phase;
  /** Days until the predicted next period; null if unknown; negative = overdue. */
  daysUntilPredictedPeriod: number | null;
  /** True if this exact day is already logged as a period day. */
  isPeriodDay: boolean;
  mode: UserMode;
  conditions: HealthCondition[];
  /**
   * A small per-day seed (e.g. day-of-month) so suggestions ROTATE day to day
   * instead of showing the same tips every day of a phase. Deterministic, so the
   * same date always shows the same set. Defaults to 0.
   */
  daySeed?: number;
  /**
   * Day in the cycle (1-indexed). If provided, the engine computes a
   * fine-grained sub-phase instead of collapsing the whole phase into one
   * narrative. When missing (e.g. no cycle data yet), the engine falls back
   * to phase-only defaults. NEW in v2.
   */
  dayInCycle?: number | null;
  /**
   * Today's check-in (mood / energy / sleep / stress). Powers personal
   * signals — a low-mood day nudges "be gentle with yourself", a high-stress
   * day suggests a wind-down. NEW in v2.
   */
  todayCheckIn?: DaySuggestionCheckIn | null;
  /**
   * Symptom logs from the last 7 days. Used to spot a dominant cluster
   * (headaches, cramps, low mood) and surface a personal signal about it.
   * NEW in v2.
   */
  recentSymptoms?: DaySuggestionSymptom[];
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
  const seed = input.daySeed ?? 0;
  const subphase = resolveSubPhase(input);
  const narrative = SUBPHASE_NARRATIVE[subphase];

  // Compose: personal signals FIRST (most relevant), then proximity
  // supplies (most actionable), then phase base (background).
  const suggestions: DaySuggestion[] = [
    ...proximitySuggestions(input, prediction),
    ...phaseSuggestions(phase, { hasPcos, hasEndo, hasThyroid }, seed),
    ...subphaseAdditions(subphase, seed),
  ];

  return {
    phase,
    subphase,
    phaseLabel: PHASE_LABEL[phase],
    subphaseLabel: narrative.label,
    headline: PHASE_HEADLINE[phase],
    hormoneStory: narrative.hormoneStory,
    cultureLine: narrative.culture,
    prediction,
    companionLine: companionLine(phase, prediction, subphase),
    suggestions: dedupeByCategoryTitle(suggestions).slice(0, 6),
    personalSignals: buildPersonalSignals(input, subphase).slice(0, 3),
    trackPrompts: SUBPHASE_TRACK_PROMPTS[subphase],
    disclaimer: DISCLAIMER,
  };
}

// ─── SUB-PHASE RESOLUTION ────────────────────────────────────────────

/**
 * Map coarse phase + optional day-in-cycle → fine sub-phase. Falls back to a
 * mid-of-phase default when day-in-cycle isn't known. Also uses
 * `daysUntilPredictedPeriod` to sharpen the luteal → PMS boundary (the tail
 * of the cycle is the most feel-different part, so we lean on the prediction
 * when it's tight).
 */
export function resolveSubPhase(input: {
  phase: Phase;
  dayInCycle?: number | null;
  daysUntilPredictedPeriod: number | null;
  isPeriodDay: boolean;
}): SubPhase {
  const { phase, dayInCycle, daysUntilPredictedPeriod, isPeriodDay } = input;

  if (phase === 'menstrual') {
    // Day 1-2 = heavy, day 3+ = tapering. If we don't know the day, assume mid.
    if (dayInCycle != null && dayInCycle <= 2) return 'menstrual_early';
    if (dayInCycle != null && dayInCycle >= 3) return 'menstrual_late';
    // Fallback: if the day was just flagged as a period, treat as early.
    return isPeriodDay ? 'menstrual_early' : 'menstrual_late';
  }

  if (phase === 'follicular') {
    if (dayInCycle == null) return 'follicular_mid';
    if (dayInCycle <= 8) return 'follicular_early';
    if (dayInCycle <= 12) return 'follicular_mid';
    return 'follicular_late';
  }

  if (phase === 'ovulatory') {
    return 'ovulation_day';
  }

  // luteal — split into early / mid / late-PMS using the prediction when we have
  // it (tail is the feel-different part), else day-of-cycle, else default mid.
  if (daysUntilPredictedPeriod != null) {
    if (daysUntilPredictedPeriod <= 3) return 'luteal_late_pms';
    if (daysUntilPredictedPeriod <= 7) return 'luteal_mid';
    return 'luteal_early';
  }
  if (dayInCycle != null) {
    if (dayInCycle <= 19) return 'luteal_early';
    if (dayInCycle <= 24) return 'luteal_mid';
    return 'luteal_late_pms';
  }
  return 'luteal_mid';
}

interface SubPhaseNarrative {
  label: string;
  hormoneStory: string;
  culture: string;
}

/**
 * Non-diagnostic hormone story + normalising culture line per sub-phase.
 *
 * The hormone story is written as a "tends to / often" observation, not a
 * clinical claim — it explains what's typical without saying it's YOU. The
 * culture line normalises common experiences without medicalising them.
 */
const SUBPHASE_NARRATIVE: Record<SubPhase, SubPhaseNarrative> = {
  menstrual_early: {
    label: 'Early menstrual',
    hormoneStory:
      'Estrogen and progesterone are at their lowest. Flow tends to be heaviest and energy lowest today.',
    culture: 'Many people describe today as "duvet day" energy — that\'s biology, not laziness.',
  },
  menstrual_late: {
    label: 'Late menstrual',
    hormoneStory:
      'Flow is tapering and estrogen is starting to lift. Mood and energy often begin to return.',
    culture: 'Many report the fog lifting from around day 3 — a good moment to plan something soft to look forward to.',
  },
  follicular_early: {
    label: 'Early follicular',
    hormoneStory:
      'Estrogen is climbing. Mood, motivation and focus tend to feel lighter as the days pass.',
    culture: 'Many notice sharper thinking and steadier moods this week — a good stretch for planning and learning.',
  },
  follicular_mid: {
    label: 'Mid follicular',
    hormoneStory:
      'Estrogen keeps rising. Energy, verbal ease and sociability often peak toward ovulation.',
    culture: 'Many report their most productive stretch of the month is right here.',
  },
  follicular_late: {
    label: 'Late follicular',
    hormoneStory:
      'Estrogen peaks and LH begins to surge. You may feel warmer, more confident, more social.',
    culture: 'Many notice increased libido and self-assurance in this window.',
  },
  ovulation_day: {
    label: 'Ovulation window',
    hormoneStory:
      'LH surge fires; an egg is released. Basal body temperature will nudge up right after.',
    culture: 'Many report a brief cramp on one side (mittelschmerz) or clearer cervical mucus.',
  },
  luteal_early: {
    label: 'Early luteal',
    hormoneStory:
      'Progesterone rises. You may feel a warmer body temp, calmer focus, and needing slightly more sleep.',
    culture: 'Many describe a "cosy" energy — great for finishing what you started earlier this cycle.',
  },
  luteal_mid: {
    label: 'Mid luteal',
    hormoneStory:
      'Progesterone dominates. Sleep may feel less refreshing and cravings can rise.',
    culture: 'Many report reaching for carbs and dark chocolate this week — bodies are asking for magnesium.',
  },
  luteal_late_pms: {
    label: 'Late luteal · PMS window',
    hormoneStory:
      'Estrogen and progesterone drop sharply. Mood can dip, breasts may feel tender, sleep can suffer.',
    culture: 'Many notice a shorter fuse in this window — biology, not personality. It usually lifts fast.',
  },
};

const SUBPHASE_TRACK_PROMPTS: Record<SubPhase, TrackPrompt[]> = {
  menstrual_early: [
    { id: 'tp_flow', emoji: '🩸', label: 'Flow' },
    { id: 'tp_pain', emoji: '🤕', label: 'Cramps' },
    { id: 'tp_energy', emoji: '🔋', label: 'Energy' },
  ],
  menstrual_late: [
    { id: 'tp_flow', emoji: '🩸', label: 'Flow tapering?' },
    { id: 'tp_mood', emoji: '💭', label: 'Mood' },
    { id: 'tp_energy', emoji: '🔋', label: 'Energy returning?' },
  ],
  follicular_early: [
    { id: 'tp_energy', emoji: '🔋', label: 'Energy' },
    { id: 'tp_mood', emoji: '💭', label: 'Focus' },
    { id: 'tp_sleep', emoji: '😴', label: 'Sleep' },
  ],
  follicular_mid: [
    { id: 'tp_energy', emoji: '⚡', label: 'Energy' },
    { id: 'tp_skin', emoji: '🌿', label: 'Skin' },
    { id: 'tp_mood', emoji: '💭', label: 'Motivation' },
  ],
  follicular_late: [
    { id: 'tp_discharge', emoji: '💧', label: 'Cervical mucus' },
    { id: 'tp_libido', emoji: '💗', label: 'Libido' },
    { id: 'tp_energy', emoji: '⚡', label: 'Energy' },
  ],
  ovulation_day: [
    { id: 'tp_discharge', emoji: '💧', label: 'Cervical mucus' },
    { id: 'tp_pain', emoji: '📍', label: 'Side twinge' },
    { id: 'tp_bbt', emoji: '🌡️', label: 'BBT' },
  ],
  luteal_early: [
    { id: 'tp_energy', emoji: '🔋', label: 'Energy' },
    { id: 'tp_mood', emoji: '💭', label: 'Mood' },
    { id: 'tp_sleep', emoji: '😴', label: 'Sleep' },
  ],
  luteal_mid: [
    { id: 'tp_cravings', emoji: '🍫', label: 'Cravings' },
    { id: 'tp_bloating', emoji: '🎈', label: 'Bloating' },
    { id: 'tp_sleep', emoji: '😴', label: 'Sleep quality' },
  ],
  luteal_late_pms: [
    { id: 'tp_mood', emoji: '💭', label: 'Mood' },
    { id: 'tp_pain', emoji: '💗', label: 'Breast tenderness' },
    { id: 'tp_sleep', emoji: '😴', label: 'Sleep' },
    { id: 'tp_headache', emoji: '🤕', label: 'Headache' },
  ],
};

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
      why: 'period likely soon',
    });
    out.push({
      id: 'com_kit',
      category: 'comfort',
      emoji: '🎒',
      title: 'Pack a comfort kit',
      detail: 'Tuck a spare + a painkiller into your bag so the first day is easy.',
      why: 'kinder first day',
    });
  }
  if (prediction.tone === 'due') {
    out.push({
      id: 'com_cozy',
      category: 'comfort',
      emoji: '🧣',
      title: 'Set up for cozy',
      detail: 'Heat pad, comfy waistband, water nearby. Lighten the day where you can.',
      why: 'lowest hormones today',
    });
  }
  return out;
}

// ─── PERSONAL SIGNALS (from user data) ───────────────────────────────

/**
 * Build 0-3 personalised nudges from today's check-in + recent symptom logs.
 * Everything here is a pattern from the user's OWN data — never a diagnosis,
 * always framed as "you tend to log X, here's a soft idea." Deterministic on
 * the input; safe to call every render.
 */
function buildPersonalSignals(
  input: DaySuggestionInput,
  subphase: SubPhase,
): PersonalSignal[] {
  const out: PersonalSignal[] = [];

  // — 1. Dominant recent-symptom cluster (last 7 days).
  const symptomSignal = pickDominantSymptomSignal(input.recentSymptoms ?? [], subphase);
  if (symptomSignal) out.push(symptomSignal);

  // — 2. Today's check-in signals (mood / energy / sleep / stress).
  const ci = input.todayCheckIn;
  if (ci) {
    if (ci.moodScore != null && ci.moodScore <= 2) {
      out.push({
        id: 'ci_low_mood',
        emoji: '🫂',
        title: 'A tender mood today',
        detail: 'Be gentle — lighter plans and a warm drink often help more than pushing through.',
        source: 'check_in_mood',
      });
    }
    if (ci.energyLevel != null && ci.energyLevel <= 2) {
      out.push({
        id: 'ci_low_energy',
        emoji: '🔋',
        title: 'Energy is low',
        detail: 'One short walk + protein at your next meal tends to help more than caffeine.',
        source: 'check_in_energy',
      });
    }
    if (ci.sleepQuality != null && ci.sleepQuality <= 2) {
      out.push({
        id: 'ci_poor_sleep',
        emoji: '😴',
        title: 'Sleep was rough',
        detail: 'A cooler, darker wind-down tonight — 20 min earlier than usual — often resets it.',
        source: 'check_in_sleep',
      });
    }
    if (ci.stressLevel != null && ci.stressLevel >= 4) {
      out.push({
        id: 'ci_high_stress',
        emoji: '🌬️',
        title: 'Stress feels high',
        detail: 'A 4-6 breath (inhale 4s, exhale 6s) for two minutes calms the nervous system fast.',
        source: 'check_in_stress',
      });
    }
  }

  return out;
}

/**
 * Look at the last 7 days of symptom logs and, if a single symptom shows up
 * repeatedly, surface a supportive suggestion about it. Weighted by severity
 * so a single "10" pain counts more than three "2" logs.
 */
function pickDominantSymptomSignal(
  logs: DaySuggestionSymptom[],
  subphase: SubPhase,
): PersonalSignal | null {
  if (logs.length === 0) return null;
  const scoreByType = new Map<string, number>();
  for (const l of logs) {
    const cur = scoreByType.get(l.symptomType) ?? 0;
    // Ignore invalid severities silently.
    const sev = typeof l.severity === 'number' && l.severity > 0 ? l.severity : 1;
    scoreByType.set(l.symptomType, cur + sev);
  }
  let bestType: string | null = null;
  let bestScore = 0;
  for (const [type, score] of scoreByType) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  }
  // Only surface if it's genuinely dominant — otherwise we're guessing.
  if (bestType == null || bestScore < 3) return null;

  const rec = SYMPTOM_TIPS[bestType.toLowerCase()];
  if (!rec) {
    // Generic fallback so a user still sees SOME acknowledgment.
    return {
      id: 'sym_generic',
      emoji: '📝',
      title: `You've been logging ${bestType}`,
      detail: subphase.startsWith('menstrual')
        ? 'A pattern worth noting on your doctor report — heat, hydration and rest often help.'
        : 'A pattern worth noting on your doctor report — see what eases it best over the next few days.',
      source: 'recent_symptoms',
    };
  }
  return { ...rec, source: 'recent_symptoms' };
}

/** Symptom-specific tips (lowercased key match — matches Dottie's log names). */
const SYMPTOM_TIPS: Record<string, Omit<PersonalSignal, 'source'>> = {
  headache: {
    id: 'sym_headache',
    emoji: '🤕',
    title: 'Headaches around this window',
    detail: 'A painkiller in your bag + steady hydration often takes the edge off before it lands.',
  },
  cramps: {
    id: 'sym_cramps',
    emoji: '💗',
    title: 'Cramps have been showing up',
    detail: 'A heat pad + magnesium (dark chocolate, nuts, greens) tends to help more than either alone.',
  },
  bloating: {
    id: 'sym_bloating',
    emoji: '🎈',
    title: 'Bloating pattern',
    detail: 'Softer waistbands and easing on salt for a day or two often calms it.',
  },
  fatigue: {
    id: 'sym_fatigue',
    emoji: '😴',
    title: 'Fatigue is repeating',
    detail: 'Iron-rich meal + a 20-min nap or a walk in daylight tends to lift it more than coffee does.',
  },
  anxiety: {
    id: 'sym_anxiety',
    emoji: '🫧',
    title: 'Anxious moments recently',
    detail: 'Slow exhales (twice as long as your inhale) for 2 minutes can dial the nervous system down.',
  },
  irritability: {
    id: 'sym_irritability',
    emoji: '🌬️',
    title: 'Irritability pattern',
    detail: 'Blood-sugar swings often make this worse — pair carbs with protein at your next meal.',
  },
  acne: {
    id: 'sym_acne',
    emoji: '🌿',
    title: 'Skin has been reactive',
    detail: 'Keep the routine simple this week — cleanse + moisturize; sensitivity often eases fast.',
  },
  back_pain: {
    id: 'sym_backpain',
    emoji: '🧘',
    title: 'Back pain repeating',
    detail: 'Cat-cow stretch + a heat pad on the low back for 10 minutes tends to loosen it.',
  },
};

// ─── PHASE BASE (with condition modifiers) ───────────────────────────

interface Cond { hasPcos: boolean; hasEndo: boolean; hasThyroid: boolean }

interface PhasePool {
  food: DaySuggestion[];
  comfort: DaySuggestion[];
  movement: DaySuggestion[];
  mind: DaySuggestion[];
}

/**
 * Compose one suggestion per category, ROTATED by the day seed for variety, with
 * condition-specific tips taking precedence when they apply. Ideas are framed as
 * general wellness tendencies ("many find", "tends to") — the phase→lifestyle
 * link is popular but not settled science, so we keep it gentle + non-diagnostic.
 */
function phaseSuggestions(phase: Phase, c: Cond, seed: number): DaySuggestion[] {
  const pool = PHASE_POOLS[phase];
  const pick = <T,>(arr: T[]): T => arr[Math.abs(seed) % arr.length]!;
  return [
    conditionFood(phase, c) ?? pick(pool.food),
    conditionComfort(phase, c) ?? pick(pool.comfort),
    conditionMovement(phase, c) ?? pick(pool.movement),
    pick(pool.mind),
  ];
}

/**
 * A small SUB-PHASE-specific extra tip that layers on top of the phase base.
 * Adds granularity without duplicating whole pools per sub-phase.
 * Returns 0-1 suggestion.
 */
function subphaseAdditions(sub: SubPhase, seed: number): DaySuggestion[] {
  const extra = SUBPHASE_EXTRAS[sub];
  if (!extra || extra.length === 0) return [];
  const pick = extra[Math.abs(seed) % extra.length]!;
  return [pick];
}

// ─── ROTATING PHASE POOLS (general wellness ideas) ───────────────────

const PHASE_POOLS: Record<Phase, PhasePool> = {
  menstrual: {
    food: [
      food('Iron & magnesium', 'Iron-rich foods (greens, beans) + magnesium (dark chocolate, nuts) may ease cramps.', 'replenishes what flow takes'),
      food('Warm & simple', 'Soups, stews and warm teas feel kind on a tender day.', 'warmth is anti-cramp'),
      food('Hydrate & soothe', 'Water plus ginger or peppermint tea can settle cramps and bloating for some.', 'hydration eases cramps'),
      food('Iron + vitamin C', 'A squeeze of lemon on a leafy greens meal helps your body absorb iron better.', 'boosts iron uptake'),
    ],
    comfort: [
      comfort('Warmth helps', 'A heat pad and soft, loose clothing tend to feel best today.', 'heat calms the uterus'),
      comfort('Cosy + covered', 'Darker, comfy clothes and a spare in your bag = one less worry.', 'one less thing to think about'),
      comfort('Waist off', 'Skip anything with a tight waistband today — the bloat is real, and comfort helps.'),
    ],
    movement: [
      movement('Gentle only', 'Walks, stretching, restorative yoga. Skip the PRs.', 'body is repairing'),
      movement('Rest counts', 'A slow stroll — or nothing at all. Recovery is training too.', 'recovery is training'),
      movement('Legs up the wall', 'Five minutes with legs against a wall calms the pelvis and cramps for many.'),
    ],
    mind: [
      mind('Rest is productive', 'Lower the bar today. Recovery is doing something, not nothing.'),
      mind('A quiet check-in', 'A few lines on how you feel — future-you will thank you.'),
      mind('Say no easily today', 'A tender day is a good day to defer the "maybes" to next week.'),
    ],
  },
  follicular: {
    food: [
      food('Fresh & building', 'Fresh produce and protein support the energy that\'s climbing now.', 'estrogen is rising'),
      food('Colourful plates', 'Lighter, varied meals tend to match rising energy.', 'aligns with rising energy'),
      food('Fermented add-ons', 'A spoon of kimchi, yogurt, or sauerkraut supports the gut as estrogen rises.'),
    ],
    comfort: [
      comfort('Easy layers', 'You may run a little cooler than last week — layers work well.', 'BBT is lower here'),
      comfort('Bright light early', 'Morning sunlight for 5–10 min anchors your circadian rhythm as energy lifts.'),
    ],
    movement: [
      movement('Try something new', 'A good window for higher-intensity movement or a new class.', 'peak recovery capacity'),
      movement('Build a little', 'Progressive strength often feels great as energy rises.', 'estrogen aids recovery'),
      movement('HIIT or heavy', 'Body handles intensity best right about now — go a little harder if it feels good.'),
    ],
    mind: [
      mind('Great day to plan', 'Focus and motivation tend to rise — start that thing.'),
      mind('Feed your curiosity', 'A curious day — a lesson or a book lands well.'),
      mind('Have the conversation', 'Words come easier this week — a good moment for the ask you\'ve been putting off.'),
    ],
  },
  ovulatory: {
    food: [
      food('Light & bright', 'Lighter meals with fibre sit well around your peak.', 'aids estrogen clearance'),
      food('Antioxidant-rich', 'Berries, leafy greens and plenty of water around ovulation.', 'supports egg health'),
      food('Zinc-forward', 'Pumpkin seeds, oysters, chickpeas — zinc supports the LH surge.'),
    ],
    comfort: [
      comfort('Breathable layers', 'You may run warm; breathable fabrics feel best.', 'BBT rises after ovulation'),
      comfort('Water + salt', 'Cervical mucus is thin and clear now; extra hydration matches the shift.'),
    ],
    movement: [
      movement('Peak strength', 'Often the strongest days — lean in if it feels good.', 'strength peaks here'),
      movement('Group energy', 'Social workouts or classes can feel extra fun now.', 'sociability peaks'),
      movement('Sprint short', 'Short, sharp intervals often feel best right around ovulation.'),
    ],
    mind: [
      mind('Social energy high', 'A natural day for conversations and big asks.'),
      mind('Say the thing', 'Confidence tends to peak — a good day for a bold conversation.'),
      mind('Take the photo', 'You often look and feel your best today — capture it.'),
    ],
  },
  luteal: {
    food: [
      food('Steady the mood', 'Complex carbs + magnesium may steady mood; easing salt can help bloating.', 'progesterone effect'),
      food('Craving-friendly', 'Pair carbs with protein + fat so treats don\'t spike the crash.', 'blood sugar stability'),
      food('Warm & balanced', 'Satisfying meals with fibre help keep energy even.', 'even energy'),
      food('Magnesium at dinner', 'Pumpkin seeds, dark chocolate, greens — magnesium at dinner often helps luteal sleep.'),
    ],
    comfort: [
      comfort('Comfy over fitted', 'Softer waistbands and flowy layers as bloating tends to peak.', 'bloat peaks luteal'),
      comfort('Sleep-friendly', 'An earlier, cooler, darker wind-down helps luteal sleep.', 'progesterone warms core temp'),
      comfort('Bra check', 'Breasts often feel tender this week — a softer bra can make the whole day easier.'),
    ],
    movement: [
      movement('Moderate & kind', 'Moderate strength or pilates — meet your energy where it is.', 'meet where you are'),
      movement('Walk it out', 'Long, gentle walks suit the wind-down phase.', 'gentle is right'),
      movement('Yoga wind-down', 'A 15-min evening flow helps luteal-phase sleep more than a big workout would.'),
    ],
    mind: [
      mind('Be gentle with you', 'If you feel more sensitive, that\'s biology — not a flaw.'),
      mind('Boundaries are okay', 'Fewer plans, more rest — it\'s fine to protect your energy.'),
      mind('Journal the swirl', 'If the brain is looping, 3 lines on paper often lets it settle.'),
    ],
  },
};

/**
 * A sub-phase-specific extra suggestion that layers on top of the phase base.
 * Kept short — one focused idea per sub-phase.
 */
const SUBPHASE_EXTRAS: Partial<Record<SubPhase, DaySuggestion[]>> = {
  menstrual_early: [
    comfort('Heat, early', 'A heat pad on the lower belly in the first 30 minutes often heads off cramps for the day.', 'day 1 is the peak-cramp day'),
  ],
  menstrual_late: [
    mind('Plan the next arc', 'Energy is returning — jot the top 3 things you want to move on in the next 10 days.', 'estrogen starts rising here'),
  ],
  follicular_early: [
    mind('Ease back on', 'Rebuild routine gently — one workout, one social thing this week is plenty.'),
  ],
  follicular_mid: [
    mind('Push once', 'A single ambitious task (a workout PR, a hard conversation, a deep-work block) tends to land well right now.'),
  ],
  follicular_late: [
    comfort('Watch the discharge', 'Clear, stretchy cervical mucus is the classic pre-ovulation signal — a good day to log it.', 'ovulation is close'),
  ],
  ovulation_day: [
    comfort('One-sided twinge?', 'A brief cramp on one side (mittelschmerz) is normal today — worth logging so patterns show up over time.'),
  ],
  luteal_early: [
    food('Iron ahead of time', 'A ferritin-friendly meal (red meat, lentils, spinach + vitamin C) this week softens the drop into your period.'),
  ],
  luteal_mid: [
    comfort('Cooler bedroom', 'Body temp is a touch higher — a slightly cooler room + a light blanket often improves sleep.'),
  ],
  luteal_late_pms: [
    mind('Kinder self-talk', 'The dip in estrogen makes the inner critic louder for many — that voice is hormonal, not honest.'),
  ],
};

// ─── CONDITION-SPECIFIC OVERRIDES (non-diagnostic) ───────────────────

function conditionFood(phase: Phase, c: Cond): DaySuggestion | null {
  if (c.hasEndo && phase === 'menstrual')
    return food('Anti-inflammatory', 'Leafy greens, omega-3s and iron; go easy on processed foods on heavy days.', 'endo-friendly idea');
  if (c.hasPcos && (phase === 'follicular' || phase === 'ovulatory'))
    return food('Steady blood sugar', 'Protein + fibre with lower-GI carbs to keep energy even (a PCOS-friendly idea).', 'insulin-friendly');
  if (c.hasPcos && phase === 'luteal')
    return food('Lower-GI choices', 'Complex carbs paired with protein help avoid the crash (a PCOS-friendly idea).', 'insulin-friendly');
  if (c.hasThyroid && phase === 'luteal')
    return food('Selenium-friendly', 'A brazil nut or two + oily fish this week supports thyroid conversion (a thyroid-friendly idea).', 'thyroid-friendly');
  return null;
}

function conditionComfort(phase: Phase, c: Cond): DaySuggestion | null {
  if (c.hasEndo && phase === 'menstrual')
    return comfort('Heat early', 'Heat and rest without guilt — honor a heavier day.', 'endo-friendly idea');
  if (c.hasEndo && phase === 'luteal')
    return comfort('Rest early', 'A heavier pre-period ache is common with endo — an earlier wind-down helps.', 'endo-friendly idea');
  return null;
}

function conditionMovement(phase: Phase, c: Cond): DaySuggestion | null {
  if (c.hasEndo && phase === 'luteal')
    return movement('Gentle & kind', 'Gentle strength or pilates; rest when pain says so.', 'endo-friendly idea');
  if (c.hasThyroid && phase === 'follicular')
    return movement('Ease in', 'Energy may be returning — build gently, no need to overdo it.', 'thyroid-friendly');
  if (c.hasPcos && (phase === 'follicular' || phase === 'ovulatory'))
    return movement('Strength + walking', 'Strength training and walking may support insulin sensitivity (PCOS-friendly).', 'insulin-friendly');
  if (c.hasPcos && phase === 'luteal')
    return movement('Steady zone-2', 'Zone-2 cardio (long, easy walks or slow jog) is easier on the nervous system and PCOS-friendly.', 'insulin-friendly');
  return null;
}

// ─── SUGGESTION BUILDERS ─────────────────────────────────────────────

function food(title: string, detail: string, why?: string): DaySuggestion {
  return { id: `food_${slug(title)}`, category: 'food', emoji: '🍽️', title, detail, ...(why ? { why } : {}) };
}
function comfort(title: string, detail: string, why?: string): DaySuggestion {
  return { id: `com_${slug(title)}`, category: 'comfort', emoji: '👗', title, detail, ...(why ? { why } : {}) };
}
function movement(title: string, detail: string, why?: string): DaySuggestion {
  return { id: `mov_${slug(title)}`, category: 'movement', emoji: '🧘', title, detail, ...(why ? { why } : {}) };
}
function mind(title: string, detail: string, why?: string): DaySuggestion {
  return { id: `mind_${slug(title)}`, category: 'mind', emoji: '💭', title, detail, ...(why ? { why } : {}) };
}

// ─── COMPANION LINE ──────────────────────────────────────────────────

function companionLine(phase: Phase, prediction: DayPrediction | null, sub: SubPhase): string {
  if (prediction?.tone === 'due') return 'A tender day — a little prep makes it softer. I\'ve got you.';
  if (prediction?.tone === 'soon') return 'A few gentle things now make next week kinder to you.';
  // Sub-phase-specific companion lines for finer voice.
  switch (sub) {
    case 'menstrual_early': return 'Rest is the move. Take what you need.';
    case 'menstrual_late':  return 'The fog\'s lifting — one small thing to look forward to?';
    case 'follicular_early': return 'Fresh energy is rising — what feels possible?';
    case 'follicular_mid':   return 'Focus feels sharper right now — use it on the thing that matters.';
    case 'follicular_late':  return 'You\'re near your peak — say the thing, do the thing.';
    case 'ovulation_day':    return 'You\'re glowing right about now. Enjoy it.';
    case 'luteal_early':     return 'Softer strength this week — meet your body where it is.';
    case 'luteal_mid':       return 'Cravings and cosy energy — snack on protein, wind down earlier.';
    case 'luteal_late_pms':  return 'That inner critic is hormonal, not honest. Be kind to yourself.';
  }
  // Fallback — shouldn't reach here since SubPhase covers all phases.
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
