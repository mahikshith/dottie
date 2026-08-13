/**
 * Dottie — Cycle Types
 *
 * Core type definitions for cycle tracking, phases, and predictions.
 */

/** The four menstrual cycle phases */
export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

/** User mode selection */
export type UserMode = 'teen' | 'adult' | 'endocrine';

/** Cycle length categories (for onboarding) */
export type CycleLengthCategory = 'short' | 'average' | 'long' | 'irregular' | 'unknown';

/** Health conditions that affect predictions */
export type HealthCondition = 'pcos' | 'thyroid' | 'endometriosis' | 'none';

/** A single cycle entry (one day of data) */
export interface CycleEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  phase: Phase | null;
  flowLevel: number | null; // 0-5
  isPeriodDay: boolean;
  confidenceScore: number; // 0.0 - 1.0
}

/** User's health profile (affects predictions) */
export interface HealthProfile {
  age: number | null;
  mode: UserMode;
  conditions: HealthCondition[];
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: 'sedentary' | 'moderate' | 'active' | null;
  averageCycleLength: number | null; // days
  averagePeriodLength: number | null; // days
  onMedications: boolean;
}

/** Prediction output from the engine */
export interface CyclePrediction {
  predictedNextPeriod: string; // ISO date
  confidence: number; // 0.0 - 1.0
  windowDays: number; // ± days of uncertainty
  currentPhase: Phase;
  dayInPhase: number;
  dayInCycle: number;
  predictedOvulation: string | null; // ISO date
  factorsUsed: string[];
  createdAt: string; // ISO timestamp
}

/** Historical cycle record (one complete cycle) */
export interface CycleRecord {
  startDate: string; // ISO date
  endDate: string; // ISO date (period end)
  cycleLength: number; // total days (start to next start)
  periodLength: number; // days of bleeding
  averageFlow: number; // 1-5
}

/** Phase metadata for display */
export interface PhaseInfo {
  phase: Phase;
  name: string;
  emoji: string;
  description: string;
  typicalDuration: string;
  primaryColor: string;
  lightColor: string;
}
