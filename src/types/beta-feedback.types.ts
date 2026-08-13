/**
 * Dottie — Beta Feedback Types
 *
 * Data shapes for the in-app feedback collection system that ships
 * with Chunk 12 (Beta Tester Pack).
 *
 * ─── PRIVACY MODEL ──────────────────────────────────────────────────
 *
 *  Feedback is collected LOCALLY first (SQLite), then forwarded to the
 *  dev team via the user's own email client (expo-mail-composer). At
 *  no point does feedback touch a third-party server.
 *
 *  Each feedback entry records:
 *    - User's mood rating (1-5 scale, emoji-based)
 *    - Free-text message (what's on their mind)
 *    - Optional email (so the dev can reply)
 *    - Lightweight context (app version, companion, current phase)
 *      so we can correlate feedback with what the user was actually
 *      experiencing — NO health data, NO PII beyond their email.
 *
 *  The user can review and delete their feedback history at any time
 *  from the Profile → Beta Feedback Log screen.
 *
 * ─── DELIVERY LIFECYCLE ─────────────────────────────────────────────
 *
 *  draft         → user is composing (in-memory only, not persisted)
 *  queued        → saved to SQLite, not yet sent
 *  sent          → handed off to email composer / share sheet
 *                  (we don't know if the user actually tapped Send in
 *                   their mail app — that's outside our process)
 *  failed        → composer wasn't available, user can retry
 *
 *  We deliberately don't try to track "user actually tapped Send in
 *  their email app" — that's a separate process and we can't observe
 *  it. The user's own Sent folder is the source of truth.
 */

// ─── CORE TYPES ──────────────────────────────────────────────────────

/**
 * The mood rating attached to every feedback. Five emoji-based steps,
 * mirroring the daily check-in's mood scale so testers feel at home.
 */
export type FeedbackMood = 1 | 2 | 3 | 4 | 5;

/**
 * Display data for each mood option in the picker UI. Single source
 * of truth — picker imports from here instead of duplicating strings.
 */
export interface FeedbackMoodOption {
  value: FeedbackMood;
  emoji: string;
  /** Short user-facing label for accessibility / VoiceOver. */
  label: string;
}

export const FEEDBACK_MOOD_OPTIONS: FeedbackMoodOption[] = [
  { value: 1, emoji: '😞', label: 'Frustrated' },
  { value: 2, emoji: '😐', label: 'Meh' },
  { value: 3, emoji: '🙂', label: 'Decent' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '🥰', label: 'Loving it' },
];

/**
 * Lifecycle state of a single feedback entry. See file header.
 */
export type FeedbackStatus = 'queued' | 'sent' | 'failed';

/**
 * Outcome of attempting to deliver feedback. The transport layer
 * returns one of these so the store + UI can react accordingly.
 */
export type FeedbackDeliveryResult =
  | { kind: 'opened_composer'; via: 'mail' | 'share' }
  | { kind: 'no_transport_available' }
  | { kind: 'error'; message: string };

// ─── DRAFT (composing) ───────────────────────────────────────────────

/**
 * The shape of feedback being composed. Lives in component state /
 * the store's `draft` slice — NOT in SQLite.
 *
 * Every field is optional because the user fills them in gradually.
 * The store enforces the minimum send-time invariants (mood is set,
 * message is not blank).
 */
export interface FeedbackDraft {
  mood: FeedbackMood | null;
  message: string;
  /** Optional — only sent if the user wants a reply. */
  email: string | null;
}

/** What an empty draft looks like (used to reset after send). */
export const EMPTY_FEEDBACK_DRAFT: FeedbackDraft = {
  mood: null,
  message: '',
  email: null,
};

// ─── PERSISTED RECORD ────────────────────────────────────────────────

/**
 * A single feedback entry as stored in SQLite. Repositories read +
 * write this shape; stores expose it directly to the UI.
 */
export interface BetaFeedbackRecord {
  /** UUID — generated client-side. */
  id: string;

  /** ISO timestamp when the entry was created. */
  createdAt: string;

  /** ISO timestamp when the user attempted to send (composer opened). */
  sentAt: string | null;

  /** Current lifecycle state. */
  status: FeedbackStatus;

  /** Mood rating 1-5. */
  mood: FeedbackMood;

  /** The user's free-text message. */
  message: string;

  /** Optional reply-to email. Null if user skipped this field. */
  email: string | null;

  // ─── Context fields ─────────────────────────────────────────────
  //
  // We record a small snapshot of "what was the app like when they
  // gave feedback?" so we can correlate complaints with state. NO
  // health data ends up here — just app + companion + phase label.

  /** App version (e.g. "0.11.0"). */
  appVersion: string;

  /** Build number (e.g. 47). */
  buildNumber: string;

  /** Companion type at time of feedback. */
  companion: string | null;

  /** Current cycle phase (e.g. "follicular"). Null if unknown. */
  phase: string | null;

  /** Day in cycle (e.g. 14). Null if unknown. */
  dayInCycle: number | null;

  /** User mode (teen / adult / endocrine). */
  userMode: string | null;
}

/**
 * Input shape for creating a new feedback record. The repo fills in
 * id + createdAt + status + sentAt itself.
 */
export interface BetaFeedbackCreateInput {
  mood: FeedbackMood;
  message: string;
  email: string | null;
  appVersion: string;
  buildNumber: string;
  companion: string | null;
  phase: string | null;
  dayInCycle: number | null;
  userMode: string | null;
}

// ─── VALIDATION ──────────────────────────────────────────────────────

/** Maximum message length (so we don't fill the email with novels). */
export const FEEDBACK_MESSAGE_MAX = 2000;

/** Minimum message length (anti-spam — no empty submissions). */
export const FEEDBACK_MESSAGE_MIN = 1;

/**
 * Cheap email shape check. NOT a full RFC validator — just enough to
 * catch obvious typos like missing @ or extra spaces. Real validation
 * happens when the user receives a reply (or doesn't).
 */
export function isLikelyValidEmail(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 3) return false;
  if (trimmed.includes(' ')) return false;
  if (!trimmed.includes('@')) return false;
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false;
  return true;
}

/**
 * Decide whether a draft is sendable. Returns either ok or a friendly
 * reason for the UI to show.
 */
export function validateDraft(draft: FeedbackDraft):
  | { ok: true }
  | { ok: false; reason: string } {
  if (draft.mood === null) {
    return { ok: false, reason: 'Pick how you\'re feeling first 💛' };
  }
  const trimmed = draft.message.trim();
  if (trimmed.length < FEEDBACK_MESSAGE_MIN) {
    return { ok: false, reason: 'Add a few words so we know what you mean 🌱' };
  }
  if (trimmed.length > FEEDBACK_MESSAGE_MAX) {
    return {
      ok: false,
      reason: `That's a lovely amount of thought — try ${FEEDBACK_MESSAGE_MAX} characters or fewer.`,
    };
  }
  if (draft.email !== null && draft.email.trim().length > 0 && !isLikelyValidEmail(draft.email)) {
    return { ok: false, reason: 'Hmm, that email doesn\'t look right' };
  }
  return { ok: true };
}
