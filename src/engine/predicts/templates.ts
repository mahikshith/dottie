/**
 * Dottie — Insight Templates
 *
 * Every line of copy in "Dottie Predicts" lives here. Generators in
 * dottie-predicts.ts call into these templates with the user's specific
 * numbers/dates. This separation:
 *   - Keeps copy reviewable in one place
 *   - Lets us A/B variants without touching engine logic
 *   - Makes localization a future drop-in (swap this file per locale)
 *
 * ─── COPY STYLE ─────────────────────────────────────────────────────
 *
 *  - Warm, friendly, second-person ("you", "your")
 *  - Never alarmist — even cramp heads-ups stay gentle ("cozy supplies"
 *    not "prepare for pain")
 *  - One soft emoji per line, never more
 *  - Numbers are bolded by context in the UI — copy stays plain
 *  - "Maybe", "could", "might" preferred over "will" / "should"
 *  - Never medical advice — observations and gentle nudges only
 */

import {
  DottieInsight,
  InsightHighlight,
  InsightKind,
  InsightTone,
} from '../../types/dottie-predicts.types';
import { Phase } from '../../types/cycle.types';

// ─── TEMPLATE INPUTS ─────────────────────────────────────────────────

export interface EnergyDipAheadVars {
  daysAhead: number;
  cyclesObserved: number;
  confidence: number;
}

export interface FocusPeakTodayVars {
  dayInCycle: number;
  cyclesObserved: number;
  confidence: number;
}

export interface CrampWindowAheadVars {
  daysAhead: number;
  lastObservedDayInCycle: number;
  confidence: number;
}

export interface SkinClearWindowVars {
  daysAhead: number;
  confidence: number;
}

export interface CycleRegularityPraiseVars {
  averageLength: number;
  cyclesObserved: number;
  confidence: number;
}

export interface CycleIrregularityGentleVars {
  shortest: number;
  longest: number;
  cyclesObserved: number;
  confidence: number;
}

export interface ConsistencyCelebrationVars {
  streakDays: number;
  confidence: number;
}

export interface PeriodCountdownVars {
  daysUntilPeriod: number;
  windowDays: number;
  confidence: number;
}

// ─── BUILDERS (kind → DottieInsight) ─────────────────────────────────

export function buildEnergyDipAhead(
  v: EnergyDipAheadVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'energy_dip_ahead',
    id: `energy_dip_ahead__${isoDate}`,
    tone: 'cozy',
    emoji: '🌙',
    title: 'A soft day might be coming',
    body:
      v.daysAhead === 0
        ? `Based on your last ${v.cyclesObserved} cycles, today is often when your energy quietly dips. Be kind to yourself. 💛`
        : `Based on your last ${v.cyclesObserved} cycles, your energy usually dips in about ${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'}. A gentle landing zone is on the way.`,
    tip: v.daysAhead <= 2
      ? 'Maybe move one thing off tomorrow and lean into rest tonight.'
      : 'Could be a good week to schedule heavier work earlier and ease into the weekend.',
    highlights: [
      { label: 'Cycles observed', value: String(v.cyclesObserved) },
      ...(v.daysAhead > 0
        ? [{ label: 'In about', value: `${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'}` }]
        : [{ label: 'Window', value: 'today' }]),
    ],
    confidence: v.confidence,
    relatedPhase: 'luteal',
  });
}

export function buildFocusPeakToday(
  v: FocusPeakTodayVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'focus_peak_today',
    id: `focus_peak_today__${isoDate}`,
    tone: 'encouraging',
    emoji: '✨',
    title: "You're often sharpest right around now",
    body: `Across your last ${v.cyclesObserved} cycles, day ${v.dayInCycle} has been a quiet peak for focus. Today's a beautiful day for the things on your mind.`,
    tip: 'Maybe the conversation you\'ve been postponing? Or the thing you keep almost finishing?',
    highlights: [
      { label: 'Day in cycle', value: String(v.dayInCycle) },
      { label: 'Cycles observed', value: String(v.cyclesObserved) },
    ],
    confidence: v.confidence,
    relatedPhase: 'follicular',
  });
}

export function buildCrampWindowAhead(
  v: CrampWindowAheadVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'cramp_window_ahead',
    id: `cramp_window_ahead__${isoDate}`,
    tone: 'heads_up',
    emoji: '🧣',
    title: 'A heads-up, with care',
    body:
      v.daysAhead === 0
        ? `Last cycle, cramps showed up around today. Cozy supplies and slow plans might feel really good.`
        : `Last cycle, cramps showed up around day ${v.lastObservedDayInCycle}. That's about ${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'} away. Heads up — gently.`,
    tip: 'Heating pad nearby? Favourite tea stocked? A soft plan for the day if it visits?',
    highlights: [
      { label: 'Last observed', value: `Day ${v.lastObservedDayInCycle}` },
      ...(v.daysAhead > 0
        ? [{ label: 'In about', value: `${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'}` }]
        : [{ label: 'Window', value: 'today' }]),
    ],
    confidence: v.confidence,
    relatedPhase: 'menstrual',
  });
}

export function buildSkinClearWindow(
  v: SkinClearWindowVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'skin_clear_window',
    id: `skin_clear_window__${isoDate}`,
    tone: 'encouraging',
    emoji: '✨',
    title: 'A glowy window is here',
    body:
      v.daysAhead === 0
        ? `Right around now is when your skin often clears up. Catch that natural glow in your favorite photos this week.`
        : `In about ${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'}, you tend to enter your clearest-skin window. Enjoy it.`,
    tip: 'Lower-key skincare can do wonders here — sometimes less really is more.',
    highlights: [
      ...(v.daysAhead > 0
        ? [{ label: 'In about', value: `${v.daysAhead} day${v.daysAhead === 1 ? '' : 's'}` }]
        : [{ label: 'Window', value: 'today' }]),
    ],
    confidence: v.confidence,
    relatedPhase: 'follicular',
  });
}

export function buildCycleRegularityPraise(
  v: CycleRegularityPraiseVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'cycle_regularity_praise',
    id: `cycle_regularity_praise__${isoDate}`,
    tone: 'encouraging',
    emoji: '💛',
    title: "You're beautifully steady right now",
    body: `Your last ${v.cyclesObserved} cycles averaged ${v.averageLength} days. That's a lovely, predictable rhythm — Dottie can plan with you confidently.`,
    tip: null,
    highlights: [
      { label: 'Average', value: `${v.averageLength} days` },
      { label: 'Cycles observed', value: String(v.cyclesObserved) },
    ],
    confidence: v.confidence,
    relatedPhase: null,
  });
}

export function buildCycleIrregularityGentle(
  v: CycleIrregularityGentleVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'cycle_irregularity_gentle',
    id: `cycle_irregularity_gentle__${isoDate}`,
    tone: 'gentle',
    emoji: '🌷',
    title: 'Your cycles are dancing a little',
    body: `Across your last ${v.cyclesObserved} cycles, lengths have ranged from ${v.shortest} to ${v.longest} days. That's completely okay — bodies are not metronomes.`,
    tip: 'Keep logging — every entry helps Dottie hold space for your real pattern, not an average one.',
    highlights: [
      { label: 'Shortest', value: `${v.shortest} days` },
      { label: 'Longest', value: `${v.longest} days` },
    ],
    confidence: v.confidence,
    relatedPhase: null,
  });
}

export function buildConsistencyCelebration(
  v: ConsistencyCelebrationVars,
  isoDate: string
): DottieInsight {
  return base({
    kind: 'consistency_celebration',
    id: `consistency_celebration__${isoDate}`,
    tone: 'encouraging',
    emoji: '🌸',
    title: 'Dottie sees you showing up',
    body: `${v.streakDays} days of check-ins in a row. Every tap is teaching Dottie what *your* body's rhythm sounds like — thank you for sharing it. 💛`,
    tip: null,
    highlights: [
      { label: 'Streak', value: `${v.streakDays} days` },
    ],
    confidence: v.confidence,
    relatedPhase: null,
  });
}

export function buildPeriodCountdown(
  v: PeriodCountdownVars,
  isoDate: string
): DottieInsight {
  // Pick the phrasing based on how close we are
  let title: string;
  let body: string;
  let tip: string | null;

  if (v.daysUntilPeriod <= 0) {
    title = 'Your period might be arriving today';
    body = `Based on your pattern, today's right around the window. Stay kind to yourself — and grab anything you need close at hand.`;
    tip = 'A heads-up to anyone you trust, if it helps. And maybe extra rest tonight.';
  } else if (v.daysUntilPeriod === 1) {
    title = 'About one day to go';
    body = `Based on your pattern, your period is likely tomorrow (give or take ${v.windowDays} day${v.windowDays === 1 ? '' : 's'}). Cozy night plans?`;
    tip = 'Stocked on supplies? Comfort foods? Favourite blanket nearby?';
  } else if (v.daysUntilPeriod <= 3) {
    title = `About ${v.daysUntilPeriod} days to go`;
    body = `Your period is roughly ${v.daysUntilPeriod} days away (window of ±${v.windowDays} day${v.windowDays === 1 ? '' : 's'}). A gentle window to start the wind-down.`;
    tip = 'Maybe move one social plan, or save tougher work for early in the week.';
  } else {
    title = `Period likely in about ${v.daysUntilPeriod} days`;
    body = `Based on your last cycles, you're looking at roughly ${v.daysUntilPeriod} days (±${v.windowDays}). Plenty of runway. ☁️`;
    tip = null;
  }

  return base({
    kind: 'period_countdown',
    id: `period_countdown__${isoDate}`,
    tone: v.daysUntilPeriod <= 1 ? 'heads_up' : 'curious',
    emoji: v.daysUntilPeriod <= 1 ? '🌹' : '🌸',
    title,
    body,
    tip,
    highlights: [
      ...(v.daysUntilPeriod > 0
        ? [{ label: 'Roughly', value: `${v.daysUntilPeriod} day${v.daysUntilPeriod === 1 ? '' : 's'}` }]
        : [{ label: 'Window', value: 'today' }]),
      { label: 'Confidence ±', value: `${v.windowDays} day${v.windowDays === 1 ? '' : 's'}` },
    ],
    confidence: v.confidence,
    relatedPhase: 'menstrual',
  });
}

export interface SymptomPatternLearnedVars {
  /** lowercased symptom label, e.g. "headaches" */
  symptomType: string;
  dominantPhase: Phase;
  medianDayInCycle: number;
  /** for luteal symptoms: ~days before next period (else null) */
  daysBeforePeriod: number | null;
  count: number;
  confidence: number;
}

export function buildSymptomPatternLearned(
  v: SymptomPatternLearnedVars,
  isoDate: string
): DottieInsight {
  const times = `${v.count} time${v.count === 1 ? '' : 's'} now`;

  let body: string;
  let timingHighlight: InsightHighlight;

  if (v.dominantPhase === 'luteal' && v.daysBeforePeriod !== null) {
    const d = v.daysBeforePeriod;
    body =
      d === 0
        ? `Dottie's noticed you tend to log ${v.symptomType} right as your period arrives — ${times}. Knowing it's part of your rhythm can make it feel less out of the blue. 💛`
        : `Dottie's noticed you tend to log ${v.symptomType} around ${d} day${d === 1 ? '' : 's'} before your period — ${times}. Naming the pattern can make it feel less out of the blue. 💛`;
    timingHighlight = { label: 'Before period', value: d === 0 ? 'day of' : `~${d}d` };
  } else if (v.dominantPhase === 'luteal') {
    body = `Dottie's noticed ${v.symptomType} tends to show up in your luteal phase — the stretch before your period — ${times}.`;
    timingHighlight = { label: 'Phase', value: 'Luteal' };
  } else if (v.dominantPhase === 'menstrual') {
    body = `You often log ${v.symptomType} in the first days of your period — Dottie's seen it ${times}. A pattern worth being gentle with. 💛`;
    timingHighlight = { label: 'Phase', value: 'Menstrual' };
  } else if (v.dominantPhase === 'follicular') {
    body = `Dottie's noticed ${v.symptomType} tends to land in your follicular phase, around day ${v.medianDayInCycle} — ${times}.`;
    timingHighlight = { label: 'Around', value: `Day ${v.medianDayInCycle}` };
  } else {
    body = `${v.symptomType} tends to show up around your ovulation window for you — ${times}.`;
    timingHighlight = { label: 'Phase', value: 'Ovulatory' };
  }

  return base({
    kind: 'symptom_pattern_learned',
    id: `symptom_pattern_learned__${v.symptomType.replace(/\s+/g, '_')}__${isoDate}`,
    tone: 'curious',
    emoji: '💫',
    title: 'Dottie noticed a pattern',
    body,
    // Deliberately non-diagnostic — an observation + a gentle door to care.
    tip: `This is just your own pattern, not medical advice — but if it ever feels heavy, it's always okay to mention to a doctor.`,
    highlights: [{ label: 'Seen', value: `${v.count}×` }, timingHighlight],
    confidence: v.confidence,
    relatedPhase: v.dominantPhase,
  });
}

// ─── INTERNAL BASE BUILDER ───────────────────────────────────────────

interface BaseInput {
  id: string;
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

function base(b: BaseInput): DottieInsight {
  return {
    id: b.id,
    kind: b.kind,
    title: b.title,
    body: b.body,
    tip: b.tip,
    highlights: b.highlights,
    tone: b.tone,
    emoji: b.emoji,
    confidence: clamp01(b.confidence),
    relatedPhase: b.relatedPhase,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
