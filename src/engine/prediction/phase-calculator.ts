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

  // Handle case where we're past the expected cycle length
  // (period might be late — don't panic, just extend luteal)
  const effectiveCycleDay = dayInCycle > avgCycleLength
    ? dayInCycle // Allow going past expected — no alarming messages
    : dayInCycle;

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
  };
}

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
 */
export function getPhaseDescription(phase: Phase): string {
  const descriptions: Record<Phase, string> = {
    menstrual: 'Rest & restore. Your body is renewing itself.',
    follicular: 'Energy rising! Your body is gearing up.',
    ovulatory: 'Peak energy! You might feel extra social & confident.',
    luteal: 'Winding down. Be gentle with yourself.',
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
