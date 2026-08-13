/**
 * Dottie — Phase Weather Store
 *
 * Caches today's PhaseWeatherSnapshot so the home card renders instantly
 * on every app open. Re-generates only when the cached date is stale.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Snapshot is deterministic per date, so caching is safe and cheap.
 *  - Daily rollover (handled by hydrate.ts) invalidates the snapshot
 *    when the user crosses midnight.
 *  - Read-only orchestration: no writes to repos, no writes to backend.
 *  - When real backend lands, this store adds a `fetchRemote()` path —
 *    UI stays exactly the same.
 *
 * ─── MVP MODE ───────────────────────────────────────────────────────
 *
 *  Always uses the local aggregator. snapshot.isLocalPreview = true.
 *  No network calls. Zero risk of latency or failure modes.
 */

import { create } from 'zustand';
import { PhaseWeatherSnapshot } from '../types/phase-weather.types';
import { buildLocalSnapshot } from '../engine/phase-weather/aggregator';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface PhaseWeatherStoreState {
  /** The cached snapshot, or null if not generated yet. */
  snapshot: PhaseWeatherSnapshot | null;
  /** ISO date the cached snapshot covers (YYYY-MM-DD). */
  cachedDate: string | null;
  /** True once initial generation has run at least once. */
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Ensure today's snapshot is loaded. Cheap to call on every screen
   * mount — if the cached date matches today, this is a no-op.
   */
  ensureToday: () => PhaseWeatherSnapshot;

  /**
   * Force a regeneration for a specific date (defaults to today).
   * Useful for testing the daily rollover.
   */
  regenerate: (date?: string) => PhaseWeatherSnapshot;

  /** Clear the cached snapshot (called by daily rollover). */
  invalidate: () => void;

  /** Reset store — called by user.deleteAccount(). */
  reset: () => void;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  snapshot: null as PhaseWeatherSnapshot | null,
  cachedDate: null as string | null,
  hydrated: false,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const usePhaseWeatherStore = create<PhaseWeatherStoreState>((set, get) => ({
  ...initialState,

  // ─── ensureToday ────────────────────────────────────────────────

  ensureToday: () => {
    const today = todayISO();
    const cached = get().snapshot;
    const cachedDate = get().cachedDate;

    if (cached && cachedDate === today) {
      return cached;
    }

    const snapshot = buildLocalSnapshot({ date: today });
    set({ snapshot, cachedDate: today, hydrated: true });
    return snapshot;
  },

  // ─── regenerate ─────────────────────────────────────────────────

  regenerate: (date) => {
    const target = date ?? todayISO();
    const snapshot = buildLocalSnapshot({ date: target });
    set({ snapshot, cachedDate: target, hydrated: true });
    return snapshot;
  },

  // ─── invalidate ─────────────────────────────────────────────────

  invalidate: () => {
    set({ snapshot: null, cachedDate: null });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectWeatherSnapshot = (
  s: PhaseWeatherStoreState
): PhaseWeatherSnapshot | null => s.snapshot;

export const selectIsWeatherHydrated = (
  s: PhaseWeatherStoreState
): boolean => s.hydrated;

// ─── HELPERS ─────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}
