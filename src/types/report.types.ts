/**
 * Dottie — Report Types (Canonical)
 *
 * Type definitions for the Doctor Report system.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  The Doctor Report is a read-only aggregation of existing user data.
 *  It never modifies the source — it just shapes cycle records, symptom
 *  logs, and check-ins into a clinician-friendly summary.
 *
 *  This file is the SINGLE SOURCE OF TRUTH for report shapes. The
 *  engine, store, and UI all import from here.
 *
 *  Naming convention:
 *    - `DoctorReportData`  — top-level aggregated result
 *    - `Report*Section`    — one block of the report (cycle, symptoms, etc.)
 *    - `ReportDateRange`   — start/end inclusive date pair
 *    - `ReportTemplate`    — preset that controls which sections render
 *
 *  v1 ships `standard` template only. PCOS + fertility land in Batch 2.
 *
 * ─── SHARED CONTEXT ─────────────────────────────────────────────────
 *
 *  The report is computed once on user request and cached in the store
 *  until any underlying data changes. Generation runs entirely on-device
 *  using the same repositories the rest of the app already trusts.
 */

import { Phase } from './cycle.types';

// ─── DATE RANGE ──────────────────────────────────────────────────────

/** Inclusive date range (ISO YYYY-MM-DD). */
export interface ReportDateRange {
  startDate: string;
  endDate: string;
  /** Friendly label like "Last 90 days" — purely for display. */
  label: string;
}

/** Preset day-window picks the UI offers. */
export type ReportRangePreset = 30 | 90 | 180 | 365;

// ─── TEMPLATE ────────────────────────────────────────────────────────

/**
 * Template controls which sections are emitted. v1 ships `standard`.
 * `pcos` and `fertility` are reserved — they'll land in Batch 2 with
 * extra sections (insulin patterns, ovulation windows, etc.).
 */
export type ReportTemplate = 'standard' | 'pcos' | 'fertility';

// ─── SECTION SHAPES ──────────────────────────────────────────────────

/** Cycle Summary — the headline of every report. */
export interface ReportCycleSummary {
  /** Number of complete cycles inside the range. */
  cyclesTracked: number;
  /** Mean cycle length in days, rounded to 1 decimal. */
  averageCycleLength: number | null;
  /** [shortest, longest] cycle length. Null when no cycles tracked. */
  cycleLengthRange: [number, number] | null;
  /** Mean period (bleeding) length in days. */
  averagePeriodLength: number | null;
  /** [shortest, longest] period length. */
  periodLengthRange: [number, number] | null;
  /**
   * Regularity classification — driven by the standard deviation of
   * cycle lengths. We deliberately use warm, non-clinical language.
   */
  regularity: 'regular' | 'mostly_regular' | 'irregular' | 'insufficient_data';
  /** Human-readable explanation of the regularity score. */
  regularityNote: string;
}

/** Top Symptoms — most frequent symptom_type values in the range. */
export interface ReportSymptomEntry {
  symptomType: string;
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  occurrences: number;
  averageSeverity: number; // 1-10
  /** Most common phase this symptom was logged in, if any. */
  mostCommonPhase: Phase | null;
}

export interface ReportSymptomSection {
  entries: ReportSymptomEntry[];
  /** Total symptom logs in the range across all types. */
  totalLogged: number;
}

/** Wellbeing Trends — averages over the range. */
export interface ReportWellbeingSection {
  averageMood: number | null;     // 1-5
  averageEnergy: number | null;   // 1-5
  averageSleep: number | null;    // 1-5
  averageStress: number | null;   // 1-5
  /** Number of days the user actually checked in (denominator). */
  daysWithCheckIn: number;
  /** Total days in the range (denominator for engagement rate). */
  totalDaysInRange: number;
}

/** Most Recent Cycles — the last few complete cycles, newest first. */
export interface ReportRecentCycleRow {
  startDate: string;
  endDate: string;
  cycleLength: number;
  periodLength: number;
}

export interface ReportRecentCyclesSection {
  rows: ReportRecentCycleRow[];
  /** True when more cycles exist beyond what's shown. */
  hasMore: boolean;
}

/**
 * Medication Section — stubbed in v1 (gracefully shows "none logged").
 * Full medication tracker lands as its own feature; this slot is reserved
 * so the report shape stays stable when that ships.
 */
export interface ReportMedicationSection {
  hasMedicationsLogged: boolean;
  /** When false, UI shows a friendly "no medications logged yet" hint. */
  note: string;
}

/**
 * A single gentle, NON-diagnostic "pattern worth mentioning to a clinician"
 * derived from the user's own aggregated data (see engine/condition-signals).
 * Never a diagnosis — an observation + an open door to care.
 */
export interface ReportPatternObservation {
  id: string;
  /** short label, e.g. "Your cycles run on the longer side" */
  title: string;
  /** the observation + why it may be worth discussing (non-diagnostic) */
  detail: string;
  /** 'discuss' = worth raising; 'note' = lower-key FYI */
  severity: 'discuss' | 'note';
}

/**
 * Patterns-to-discuss section. Usually EMPTY (the healthy, common case) —
 * the UI shows it only when there's something gentle worth surfacing.
 */
export interface ReportPatternsSection {
  observations: ReportPatternObservation[];
}

// ─── TOP-LEVEL REPORT DATA ───────────────────────────────────────────

/**
 * The complete aggregated doctor report. Pure data — UI renders it,
 * Share serializes it, but neither mutates it.
 */
export interface DoctorReportData {
  /** Template used to generate this report. */
  template: ReportTemplate;
  /** Date range covered. */
  range: ReportDateRange;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** App version that produced this report (helpful for clinicians). */
  appVersion: string;

  // Sections — all required so UI can render deterministically.
  cycleSummary: ReportCycleSummary;
  symptoms: ReportSymptomSection;
  wellbeing: ReportWellbeingSection;
  recentCycles: ReportRecentCyclesSection;
  medications: ReportMedicationSection;
  /** Gentle, non-diagnostic "worth mentioning" observations (often empty). */
  patternsToDiscuss: ReportPatternsSection;

  /**
   * True when the underlying data is too sparse for meaningful insight.
   * UI uses this to switch to an encouraging empty-state instead of
   * showing misleading "0 cycles, 0 symptoms" tables.
   */
  isSparse: boolean;
}
