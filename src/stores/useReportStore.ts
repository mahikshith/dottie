/**
 * Dottie — Report Store
 *
 * Lightweight orchestrator that:
 *   1. Fetches the inputs the doctor-report engine needs
 *      (from cycleRepository + checkinRepository)
 *   2. Calls the pure engine
 *   3. Caches the resulting DoctorReportData so re-opening the
 *      preview screen is instant
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Read-only orchestration: never writes back to the repos.
 *  - Cache is invalidated by clearReport() or by re-calling
 *    generateReport() with a different range/template.
 *  - The store deliberately stays SMALL — no per-row state, no
 *    chart configuration. Those are derived in the UI from the
 *    cached DoctorReportData.
 *
 * ─── EXPO VERSION GUARD ─────────────────────────────────────────────
 *
 *  expo-constants is already in package.json (~17.0.0) so we can read
 *  the app version without adding a new dependency. We import it
 *  defensively so SSR / test runs that don't have it don't crash.
 */

import { create } from 'zustand';
import Constants from 'expo-constants';
import {
  DoctorReportData,
  ReportDateRange,
  ReportRangePreset,
  ReportTemplate,
} from '../types/report.types';
import {
  generateDoctorReport,
  DoctorReportInput,
} from '../engine/reports/doctor-report';
import { cycleRepository } from '../database/repositories/cycle.repo';
import { checkinRepository } from '../database/repositories/checkin.repo';
import { useUserStore } from './useUserStore';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface ReportStoreState {
  /** The most recently generated report, or null if not generated yet. */
  cachedReport: DoctorReportData | null;
  /** True while the engine is producing a fresh report. */
  isGenerating: boolean;
  /** Most recent generation error message, surfaced to the UI. */
  lastError: string | null;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Generate a fresh doctor report and cache it. Returns the data.
   * Throws (and sets `lastError`) when there's no active user.
   */
  generateReport: (
    rangePreset: ReportRangePreset,
    template?: ReportTemplate
  ) => Promise<DoctorReportData>;

  /** Clear the cached report. */
  clearReport: () => void;

  /** Reset store — called by user.deleteAccount(). */
  reset: () => void;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  cachedReport: null as DoctorReportData | null,
  isGenerating: false,
  lastError: null as string | null,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useReportStore = create<ReportStoreState>((set) => ({
  ...initialState,

  // ─── generateReport ─────────────────────────────────────────────

  generateReport: async (rangePreset, template = 'standard') => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      const message = 'No active user — finish onboarding first.';
      set({ lastError: message });
      throw new Error(message);
    }

    set({ isGenerating: true, lastError: null });

    try {
      const range = buildDateRange(rangePreset);

      // Fetch all inputs in parallel — the engine doesn't care which
      // arrives first, and these are independent repo reads.
      const [cycleRecords, symptoms, checkIns] = await Promise.all([
        cycleRepository.getCycleHistory(userId, /* limit */ 24),
        checkinRepository.getSymptomsInRange(userId, range.startDate, range.endDate),
        checkinRepository.getCheckInsInRange(userId, range.startDate, range.endDate),
      ]);

      // The cycle history limit is intentionally generous (24); the
      // engine filters down to the range by checking startDate.
      const cyclesInRange = cycleRecords.filter(
        c => c.startDate >= range.startDate && c.startDate <= range.endDate
      );

      const input: DoctorReportInput = {
        template,
        range,
        cycleRecords: cyclesInRange,
        symptoms,
        checkIns,
        appVersion: getAppVersion(),
      };

      const data = generateDoctorReport(input);

      set({ cachedReport: data, isGenerating: false });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (__DEV__) console.warn('[ReportStore] generateReport failed:', message);
      set({ isGenerating: false, lastError: message });
      throw err;
    }
  },

  // ─── clearReport ────────────────────────────────────────────────

  clearReport: () => {
    set({ cachedReport: null, lastError: null });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectCachedReport = (s: ReportStoreState): DoctorReportData | null =>
  s.cachedReport;

export const selectIsGeneratingReport = (s: ReportStoreState): boolean =>
  s.isGenerating;

export const selectReportError = (s: ReportStoreState): string | null =>
  s.lastError;

// ─── HELPERS ─────────────────────────────────────────────────────────

function buildDateRange(rangePreset: ReportRangePreset): ReportDateRange {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0]!;

  const start = new Date(today);
  start.setDate(start.getDate() - (rangePreset - 1));
  const startDate = start.toISOString().split('T')[0]!;

  const label = rangeLabel(rangePreset);

  return { startDate, endDate, label };
}

function rangeLabel(preset: ReportRangePreset): string {
  switch (preset) {
    case 30:  return 'Last 30 days';
    case 90:  return 'Last 90 days';
    case 180: return 'Last 6 months';
    case 365: return 'Last 12 months';
  }
}

function getAppVersion(): string {
  // expoConfig is the modern shape, manifest is the legacy fallback.
  try {
    const ver =
      Constants?.expoConfig?.version ??
      (Constants as unknown as { manifest?: { version?: string } })?.manifest?.version;
    return ver ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}
