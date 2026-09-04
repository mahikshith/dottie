/**
 * Dottie — Beta Feedback Store
 *
 * Holds the in-flight feedback draft + the list of past entries.
 * Coordinates the create → deliver → mark-sent lifecycle.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - The DRAFT is the form state the user is composing right now.
 *    Lives only in memory — never persisted. When they tap Cancel
 *    or close the modal, the draft is forgotten.
 *
 *  - The HISTORY is the list of past feedback records, hydrated from
 *    SQLite on first read. Components can subscribe to it for the
 *    "Beta Feedback Log" screen.
 *
 *  - Sending = three steps in sequence:
 *      1. Validate draft
 *      2. Persist to SQLite (so it survives a crash mid-send)
 *      3. Hand off to transport (email composer / share sheet)
 *      4. Mark sent / failed based on transport result
 *
 *  Each step is awaited; the UI shows a spinner during the whole
 *  flow. On success, the draft resets and the modal closes itself.
 *
 * ─── WHAT THIS STORE DOES NOT DO ────────────────────────────────────
 *
 *  We deliberately do NOT manage the modal's open/close state here —
 *  that's the modal component's local concern. We also don't manage
 *  the floating feedback button's visibility — that's read from a
 *  build constant (Batch C).
 */

import { create } from 'zustand';
import {
  BetaFeedbackRecord,
  EMPTY_FEEDBACK_DRAFT,
  FeedbackDeliveryResult,
  FeedbackDraft,
  FeedbackMood,
  validateDraft,
} from '../types/beta-feedback.types';
import { betaFeedbackRepository } from '../database/repositories/beta-feedback.repo';
import { deliverFeedback } from '../services/feedback-transport';
import { Storage } from '../database/storage';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface BetaFeedbackStoreState {
  // ─── Draft (current in-flight composition) ──────────────────────
  draft: FeedbackDraft;

  // ─── History ────────────────────────────────────────────────────
  history: BetaFeedbackRecord[];
  historyHydrated: boolean;

  // ─── Send lifecycle ─────────────────────────────────────────────
  isSending: boolean;
  /** Last validation error, if any (for inline form messaging). */
  validationError: string | null;
  /** Last delivery result — UI uses it to show a tasteful confirmation. */
  lastDelivery: FeedbackDeliveryResult | null;

  // ─── Actions ────────────────────────────────────────────────────

  /** Patch the draft (called as the user types / picks mood). */
  setDraft: (patch: Partial<FeedbackDraft>) => void;

  /** Reset the draft to empty (called on modal close + after send). */
  resetDraft: () => void;

  /**
   * Save + deliver the current draft. Returns the persisted record on
   * success, or null if the draft was invalid (validationError is set).
   *
   * `context` is provided by the caller so this store doesn't have to
   * subscribe to user / cycle / companion stores directly — keeps the
   * dependency graph clean and easy to reason about.
   */
  send: (context: SendContext) => Promise<BetaFeedbackRecord | null>;

  /** Hydrate the history list from SQLite. Called by the log screen. */
  loadHistory: () => Promise<void>;

  /** Remove one entry from history (locally only — already in user's inbox). */
  deleteEntry: (id: string) => Promise<void>;

  /** Clear all history (privacy nuclear option). */
  clearAllHistory: () => Promise<void>;

  /** Manually retry a previously failed entry. */
  retryEntry: (id: string) => Promise<FeedbackDeliveryResult>;

  /** Reset everything (called by deleteAccount). */
  reset: () => void;
}

/**
 * Context the UI gives us when sending. Keeps the store free of
 * direct dependencies on user/cycle stores.
 */
export interface SendContext {
  appVersion: string;
  buildNumber: string;
  companion: string | null;
  phase: string | null;
  dayInCycle: number | null;
  userMode: string | null;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  draft: EMPTY_FEEDBACK_DRAFT,
  history: [] as BetaFeedbackRecord[],
  historyHydrated: false,
  isSending: false,
  validationError: null as string | null,
  lastDelivery: null as FeedbackDeliveryResult | null,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useBetaFeedbackStore = create<BetaFeedbackStoreState>((set, get) => ({
  ...initialState,

  // ─── setDraft ───────────────────────────────────────────────────

  setDraft: (patch) => {
    set((s) => ({
      draft: { ...s.draft, ...patch },
      // Clearing the validation error as soon as the user starts typing
      // again feels less punishing than holding onto stale red text.
      validationError: null,
    }));
  },

  // ─── resetDraft ─────────────────────────────────────────────────

  resetDraft: () => {
    set({ draft: EMPTY_FEEDBACK_DRAFT, validationError: null });
  },

  // ─── send ───────────────────────────────────────────────────────

  send: async (context) => {
    const draft = get().draft;

    // 1. Validate
    const validity = validateDraft(draft);
    if (!validity.ok) {
      set({ validationError: validity.reason });
      return null;
    }

    set({ isSending: true, validationError: null });

    try {
      // 2. Persist to SQLite
      const record = await betaFeedbackRepository.create({
        mood: draft.mood as FeedbackMood,
        message: draft.message.trim(),
        email: draft.email?.trim() || null,
        appVersion: context.appVersion,
        buildNumber: context.buildNumber,
        companion: context.companion,
        phase: context.phase,
        dayInCycle: context.dayInCycle,
        userMode: context.userMode,
      });

      // 3. Hand off to transport
      const result = await deliverFeedback(record);

      // 4. Update record status based on result
      let finalRecord = record;
      if (result.kind === 'opened_composer') {
        await betaFeedbackRepository.markSent(record.id);
        finalRecord = (await betaFeedbackRepository.getById(record.id)) ?? record;
      } else {
        await betaFeedbackRepository.markFailed(record.id);
        finalRecord = (await betaFeedbackRepository.getById(record.id)) ?? record;
      }

      // 5. Update store: prepend to history, reset draft, store result
      set((s) => ({
        history: [finalRecord, ...s.history.filter((h) => h.id !== finalRecord.id)],
        draft: EMPTY_FEEDBACK_DRAFT,
        lastDelivery: result,
        isSending: false,
      }));

      // Track the last time feedback was sent — useful for the
      // "thank you, please send more!" gentle nudge if a user hasn't
      // submitted in a while (future feature).
      try {
        Storage.lastOpenedAt.set(new Date().toISOString());
      } catch {
        // Storage write failure shouldn't fail the send flow
      }

      return finalRecord;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      logSilentFailure('betaFeedback.send', err);
      set({
        isSending: false,
        validationError: `Couldn't save your feedback. ${message}`,
        lastDelivery: { kind: 'error', message },
      });
      return null;
    }
  },

  // ─── loadHistory ────────────────────────────────────────────────

  loadHistory: async () => {
    try {
      const history = await betaFeedbackRepository.listAll();
      set({ history, historyHydrated: true });
    } catch (err) {
      logSilentFailure('betaFeedback.loadHistory', err);
      set({ historyHydrated: true });
    }
  },

  // ─── deleteEntry ────────────────────────────────────────────────

  deleteEntry: async (id) => {
    await betaFeedbackRepository.delete(id);
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },

  // ─── clearAllHistory ────────────────────────────────────────────

  clearAllHistory: async () => {
    await betaFeedbackRepository.deleteAll();
    set({ history: [] });
  },

  // ─── retryEntry ─────────────────────────────────────────────────

  retryEntry: async (id) => {
    const record = await betaFeedbackRepository.getById(id);
    if (!record) {
      return { kind: 'error', message: 'Feedback not found' };
    }
    set({ isSending: true });
    try {
      const result = await deliverFeedback(record);
      if (result.kind === 'opened_composer') {
        await betaFeedbackRepository.markSent(id);
      }
      const updated = await betaFeedbackRepository.getById(id);
      set((s) => ({
        history: updated
          ? s.history.map((h) => (h.id === id ? updated : h))
          : s.history,
        lastDelivery: result,
        isSending: false,
      }));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      set({ isSending: false, lastDelivery: { kind: 'error', message } });
      return { kind: 'error', message };
    }
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => set(initialState),
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectFeedbackDraft = (s: BetaFeedbackStoreState): FeedbackDraft =>
  s.draft;

export const selectFeedbackHistory = (s: BetaFeedbackStoreState): BetaFeedbackRecord[] =>
  s.history;

export const selectIsSendingFeedback = (s: BetaFeedbackStoreState): boolean =>
  s.isSending;

export const selectFeedbackValidationError = (s: BetaFeedbackStoreState): string | null =>
  s.validationError;

export const selectLastDelivery = (s: BetaFeedbackStoreState): FeedbackDeliveryResult | null =>
  s.lastDelivery;

export const selectFeedbackHistoryCount = (s: BetaFeedbackStoreState): number =>
  s.history.length;
