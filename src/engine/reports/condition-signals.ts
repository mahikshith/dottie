/**
 * Dottie — Condition-Pattern Signals (pure, NON-diagnostic)
 *
 * Surfaces gentle "patterns worth mentioning to a clinician" from the user's
 * OWN aggregated data — the kinds of signals that sometimes relate to PCOS,
 * PMDD, endometriosis, or heavy bleeding. This lives in the DOCTOR REPORT
 * (which is literally for taking to a doctor and already carries a "not a
 * diagnosis" footer) — deliberately NOT on the home feed, where a "possible
 * PCOS" card could alarm a teen.
 *
 * ─── SAFETY RULES (do not soften these) ─────────────────────────────
 *
 *  1. NEVER diagnose. Every observation describes a PATTERN in the user's
 *     self-reported logs and says it may be "worth mentioning" — never "you
 *     have X". Condition names appear only as gentle, hedged context.
 *  2. Only trigger on CONSERVATIVE thresholds with enough data — a false flag
 *     here causes real anxiety. When in doubt, stay silent.
 *  3. No alarming language. Warm, matter-of-fact, agency-preserving.
 *  This is the apple-design *Responsibility* principle applied literally.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). The thresholds are clinician-informed
 *  rules of thumb, not validated cutoffs — review with a professional before a
 *  public launch.
 */

import {
  ReportCycleSummary,
  ReportPatternObservation,
  ReportSymptomEntry,
} from '../../types/report.types';

// ─── THRESHOLDS (conservative on purpose) ────────────────────────────

const MIN_CYCLES_FOR_CYCLE_FLAGS = 3;
const LONG_CYCLE_DAYS = 35; // avg above this is longer than the typical range
const SHORT_CYCLE_DAYS = 21; // avg below this is shorter than typical
const LONG_PERIOD_DAYS = 7.5; // avg bleeding length above this
const HIGH_SEVERITY = 7; // /10, "high on average"
const MIN_SYMPTOM_OCCURRENCES = 3;

export interface ConditionSignalInput {
  cyclesTracked: number;
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  regularity: ReportCycleSummary['regularity'];
  /** Top symptoms (already aggregated by the report engine). */
  symptoms: ReportSymptomEntry[];
}

/**
 * Produce 0–N gentle, non-diagnostic "worth mentioning" observations.
 * Empty is the common, healthy result.
 */
export function detectPatternsToDiscuss(input: ConditionSignalInput): ReportPatternObservation[] {
  const out: ReportPatternObservation[] = [];
  const cyclesOk = input.cyclesTracked >= MIN_CYCLES_FOR_CYCLE_FLAGS;

  // ── Cycle variability (sometimes related to PCOS/thyroid) ──
  if (cyclesOk && input.regularity === 'irregular') {
    out.push({
      id: 'cycle_variability',
      title: 'Your cycle lengths vary a fair amount',
      detail:
        'Across your tracked cycles, the length varies more than a typical range. Irregular cycles are common and often harmless, but if they’re frequently unpredictable it can be worth mentioning to a clinician.',
      severity: 'discuss',
    });
  }

  // ── Long / short average cycle length ──
  if (cyclesOk && input.averageCycleLength !== null && input.averageCycleLength > LONG_CYCLE_DAYS) {
    out.push({
      id: 'long_cycles',
      title: 'Your cycles run on the longer side',
      detail: `Your cycles average about ${Math.round(input.averageCycleLength)} days, longer than the usual ~21–35 day range. Worth a mention if you haven’t discussed it.`,
      severity: 'discuss',
    });
  }
  if (cyclesOk && input.averageCycleLength !== null && input.averageCycleLength < SHORT_CYCLE_DAYS) {
    out.push({
      id: 'short_cycles',
      title: 'Your cycles run on the shorter side',
      detail: `Your cycles average about ${Math.round(input.averageCycleLength)} days, shorter than the usual ~21–35 day range. Worth a mention if you haven’t discussed it.`,
      severity: 'discuss',
    });
  }

  // ── Long / heavy periods (sometimes related to fibroids/menorrhagia) ──
  if (input.averagePeriodLength !== null && input.averagePeriodLength > LONG_PERIOD_DAYS) {
    out.push({
      id: 'long_periods',
      title: 'Your periods tend to run long',
      detail: `Your bleeding averages about ${Math.round(input.averagePeriodLength)} days. Consistently long or heavy periods are worth raising with a clinician.`,
      severity: 'discuss',
    });
  }

  // ── Frequent, high-severity pain (sometimes related to endometriosis) ──
  const pain = input.symptoms.find(
    (s) =>
      s.averageSeverity >= HIGH_SEVERITY &&
      s.occurrences >= MIN_SYMPTOM_OCCURRENCES &&
      (s.category === 'physical' || isPainLabel(s.symptomType))
  );
  if (pain) {
    out.push({
      id: 'high_pain',
      title: 'You’ve logged frequent, strong pain',
      detail: `You’ve logged ${pain.symptomType} ${pain.occurrences} times, averaging ${pain.averageSeverity}/10. If pain regularly disrupts your day, it’s worth discussing — help exists.`,
      severity: 'discuss',
    });
  }

  // ── Strong pre-period mood changes (sometimes described as PMDD) ──
  const lutealMood = input.symptoms.find(
    (s) =>
      s.category === 'emotional' &&
      s.mostCommonPhase === 'luteal' &&
      s.averageSeverity >= HIGH_SEVERITY &&
      s.occurrences >= MIN_SYMPTOM_OCCURRENCES
  );
  if (lutealMood) {
    out.push({
      id: 'luteal_mood',
      title: 'Strong mood changes before your period',
      detail: `You often log ${lutealMood.symptomType} in the days before your period, with notable intensity. When this pattern is severe it’s sometimes described as PMDD — worth mentioning to a clinician if it affects your life.`,
      severity: 'discuss',
    });
  }

  return out;
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function isPainLabel(symptomType: string): boolean {
  const s = symptomType.toLowerCase();
  return (
    s.includes('cramp') ||
    s.includes('pain') ||
    s.includes('pelvic') ||
    s.includes('ache')
  );
}
