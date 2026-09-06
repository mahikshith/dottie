/**
 * Dottie — Phase Calculator
 *
 * Determines the user's CURRENT menstrual cycle phase based on:
 * - Last period start date
 * - Average cycle length
 * - Average period length
 *
 * KEY INSIGHT: Luteal phase is nearly constant (~14 days).
 * All variation happens in the follicular phase.
 * Ovulation = next_period - 14 days.
 *
 * Phases:
 * - Menstrual: Day 1 → period end (typically 3-7 days)
 * - Follicular: Period end → ovulation - 1
 * - Ovulatory: Ovulation ± 2 days
 * - Luteal: Post-ovulation → next period
 */

import { Phase, CyclePrediction } from '../../types/cycle.types';

/** Default assumptions when data is limited */
const DEFAULTS = {
  CYCLE_LENGTH: 28,
  PERIOD_LENGTH: 5,
  LUTEAL_PHASE_LENGTH: 14,
  OVULATION_WINDOW: 2, // ± days around predicted ovulation
};

export interface PhaseResult {
  phase: Phase;
  dayInPhase: number;
  dayInCycle: number;
  totalCycleDays: number;
  predictedOvulationDay: number; // day in cycle
  phaseDaysRemaining: number;
  /**
   * How far past the expected end of the cycle this day is. 0 while inside it.
   *
   * ─── WHY THIS EXISTS (device-test-24) ─────────────────────────────
   *
   *  `dayInCycle` grows without bound, and the last branch below is `else`.
   *  So every day past the ovulatory window is LUTEAL — forever. One period
   *  logged in early August and the whole of August, September and every
   *  month after renders solid purple, which is exactly what the owner
   *  photographed: "it is showing luteal phase for the entire month".
   *
   *  For the PREDICTOR that behaviour is right: a period that is nine days
   *  late is late, not unknowable, and the model should keep counting. For a
   *  CALENDAR it is a lie told in colour — day 60 of a 28-day cycle is not a
   *  luteal day, it is a day we know nothing about.
   *
   *  So the calculation is unchanged and this number is added: callers that
   *  are DISPLAYING a phase stop drawing one once it goes past a grace
   *  period; callers that are PREDICTING carry on as before.
   */
  daysPastExpected: number;
}

/**
 * Calculate current phase from last period start date.
 *
 * @param lastPeriodStart - Date when last period started
 * @param today - Current date (defaults to today)
 * @param avgCycleLength - Average cycle length in days
 * @param avgPeriodLength - Average period (bleeding) length in days
 */
export function calculateCurrentPhase(
  lastPeriodStart: Date,
  today: Date = new Date(),
  avgCycleLength: number = DEFAULTS.CYCLE_LENGTH,
  avgPeriodLength: number = DEFAULTS.PERIOD_LENGTH
): PhaseResult {
  // Calculate day in cycle (1-indexed)
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayInCycle = Math.floor((today.getTime() - lastPeriodStart.getTime()) / msPerDay) + 1;

  // Past the expected cycle length the phase is EXTENDED, not wrapped — a
  // late period is late, and re-starting the count at day 1 would invent a
  // period that has not happened. What the caller does with that is its own
  // decision; `daysPastExpected` is how it makes it (device-test-24).
  const effectiveCycleDay = dayInCycle;
  const daysPastExpected = Math.max(0, dayInCycle - avgCycleLength);

  // Calculate phase boundaries
  const ovulationDay = avgCycleLength - DEFAULTS.LUTEAL_PHASE_LENGTH;
  const ovulationStart = ovulationDay - DEFAULTS.OVULATION_WINDOW;
  const ovulationEnd = ovulationDay + DEFAULTS.OVULATION_WINDOW;

  // Determine current phase
  let phase: Phase;
  let dayInPhase: number;
  let phaseDaysRemaining: number;

  if (effectiveCycleDay <= avgPeriodLength) {
    // MENSTRUAL PHASE
    phase = 'menstrual';
    dayInPhase = effectiveCycleDay;
    phaseDaysRemaining = avgPeriodLength - effectiveCycleDay;
  } else if (effectiveCycleDay < ovulationStart) {
    // FOLLICULAR PHASE
    phase = 'follicular';
    dayInPhase = effectiveCycleDay - avgPeriodLength;
    phaseDaysRemaining = ovulationStart - effectiveCycleDay;
  } else if (effectiveCycleDay <= ovulationEnd) {
    // OVULATORY PHASE
    phase = 'ovulatory';
    dayInPhase = effectiveCycleDay - ovulationStart + 1;
    phaseDaysRemaining = ovulationEnd - effectiveCycleDay;
  } else {
    // LUTEAL PHASE
    phase = 'luteal';
    dayInPhase = effectiveCycleDay - ovulationEnd;
    phaseDaysRemaining = Math.max(0, avgCycleLength - effectiveCycleDay);
  }

  return {
    phase,
    dayInPhase,
    dayInCycle: effectiveCycleDay,
    totalCycleDays: avgCycleLength,
    predictedOvulationDay: ovulationDay,
    phaseDaysRemaining,
    daysPastExpected,
  };
}

/**
 * How many days past the expected cycle a DISPLAY may keep colouring days.
 *
 * Cycles vary; a few days late is ordinary and coloured normally. Beyond this
 * the grid stops asserting a phase and says so instead (device-test-24).
 */
export const PHASE_DISPLAY_GRACE_DAYS = 7;

/**
 * Get human-friendly phase name
 */
export function getPhaseName(phase: Phase): string {
  const names: Record<Phase, string> = {
    menstrual: 'Menstrual Phase',
    follicular: 'Follicular Phase',
    ovulatory: 'Ovulatory Phase',
    luteal: 'Luteal Phase',
  };
  return names[phase];
}

/**
 * Get phase emoji
 */
export function getPhaseEmoji(phase: Phase): string {
  const emojis: Record<Phase, string> = {
    menstrual: '🌊',
    follicular: '🌱',
    ovulatory: '🌸',
    luteal: '🌙',
  };
  return emojis[phase];
}

/**
 * Get phase description (friendly, not clinical)
 *
 * ─── THE VOICE (rule 1) ─────────────────────────────────────────────
 *
 *  These are the ONE description of each phase in the app — the dated list
 *  under the calendar reads them (`markDetail`), so whatever is said here is
 *  said everywhere a phase is explained.
 *
 *  Which is why "your body is renewing itself" and "your body is gearing up"
 *  are gone. Both told the reader what her body was DOING, from a date and an
 *  average — the exact claim rule 1 exists to prevent, and it read as more
 *  authoritative next to a date range than it ever did as a caption. What is
 *  left says what many people report and leaves her body to her.
 */
export function getPhaseDescription(phase: Phase): string {
  const descriptions: Record<Phase, string> = {
    menstrual: 'Rest & restore. Many people report lower energy on these days.',
    follicular: 'Many people report energy climbing through this stretch.',
    ovulatory: 'Many people report feeling their most social and confident here.',
    luteal: 'Winding down. Many people report wanting more rest towards the end.',
  };
  return descriptions[phase];
}

/**
 * Calculate days until next period
 */
export function daysUntilNextPeriod(
  lastPeriodStart: Date,
  avgCycleLength: number = DEFAULTS.CYCLE_LENGTH,
  today: Date = new Date()
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayInCycle = Math.floor((today.getTime() - lastPeriodStart.getTime()) / msPerDay) + 1;
  return Math.max(0, avgCycleLength - dayInCycle);
}
