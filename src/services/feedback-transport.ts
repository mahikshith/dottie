/**
 * Dottie — Feedback Transport Layer
 *
 * Hands off a saved feedback record to the user's OS so it can
 * actually reach the dev team. Two transports, tried in order:
 *
 *   1. expo-mail-composer  → opens the user's email app with To:,
 *                            Subject:, and Body: pre-filled. The user
 *                            taps Send themselves. Lands in the dev's
 *                            inbox with the user's email in the From:
 *                            header so a reply is one tap away.
 *
 *   2. Share sheet (Share)  → fallback when no email client is set up
 *                            (rare on Android, more common on iPad).
 *                            User picks a delivery channel — Mail,
 *                            WhatsApp, Telegram, etc.
 *
 * ─── WHY EMAIL FIRST ────────────────────────────────────────────────
 *
 *  Email is universal, asynchronous, and threads well for follow-up.
 *  Tapping a beta tester's email reply lets the dev start a real
 *  conversation. Share-sheet → WhatsApp works but doesn't compose
 *  as cleanly when there are 100 testers all reaching out.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  We NEVER send to a third-party server. We only:
 *    1. Save locally (durability)
 *    2. Hand the pre-formatted text to the user's OS
 *
 *  The user has full visibility into what's being sent — they
 *  literally see the email body in their mail app before tapping Send.
 *
 * ─── LAZY IMPORT ────────────────────────────────────────────────────
 *
 *  expo-mail-composer is imported dynamically so:
 *    - The app still builds if the dep isn't installed yet (during
 *      transition between Batch A and Batch B install)
 *    - Cold-start cost is paid only when the user actually taps
 *      the feedback button, not on app launch
 *    - The mail composer module never touches the bundle for users
 *      who never give feedback
 */

import { Share } from 'react-native';
import {
  BetaFeedbackRecord,
  FeedbackDeliveryResult,
  FEEDBACK_MOOD_OPTIONS,
} from '../types/beta-feedback.types';
import { logSilentFailure } from '../diagnostics/silent-failure';

/**
 * Where feedback should be sent. Hardcoded so testers can't accidentally
 * misroute it. Updated in src/constants/build-info.ts in Batch C.
 *
 * Importing as a lazy getter means we don't crash at module load time
 * if build-info.ts is missing (it's added in Batch C).
 */
function getFeedbackToEmail(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const buildInfo = require('../constants/build-info');
    return buildInfo.FEEDBACK_TO_EMAIL ?? 'mahikshith97@gmail.com';
  } catch {
    // Batch A may run before Batch C ships build-info. Fall back to
    // the canonical address so feedback never silently disappears.
    return 'mahikshith97@gmail.com';
  }
}

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Deliver a feedback record via the best available channel.
 * Returns a result describing what happened — the store decides how
 * to update the record's status based on it.
 */
export async function deliverFeedback(
  record: BetaFeedbackRecord
): Promise<FeedbackDeliveryResult> {
  // Try email composer first
  const mailResult = await tryMailComposer(record);
  if (mailResult.kind !== 'no_transport_available') {
    return mailResult;
  }

  // Fall back to the OS share sheet
  return tryShareSheet(record);
}

// ─── EMAIL COMPOSER ──────────────────────────────────────────────────

/**
 * Open the user's mail app pre-filled with their feedback.
 *
 * Returns 'no_transport_available' if the device has no email client
 * configured (we then try the share sheet). Returns 'opened_composer'
 * if the composer surface launched successfully — note we DON'T know
 * if the user actually tapped Send afterwards. That's outside our
 * process.
 */
async function tryMailComposer(
  record: BetaFeedbackRecord
): Promise<FeedbackDeliveryResult> {
  try {
    // Dynamic import — the module won't be in the bundle for users
    // who never trigger feedback. Also tolerant of the module being
    // un-installed (returns a graceful failure).
    const MailComposer = await import('expo-mail-composer' as string).catch(() => null);
    if (!MailComposer) {
      return { kind: 'no_transport_available' };
    }

    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      return { kind: 'no_transport_available' };
    }

    const composed = await MailComposer.composeAsync({
      recipients: [getFeedbackToEmail()],
      subject: buildSubject(record),
      body: buildEmailBody(record),
      isHtml: false,
    });

    // composed.status: 'sent' | 'saved' | 'cancelled' | 'undetermined'
    // We treat anything except 'cancelled' as a successful handoff —
    // the user opened the composer and decided their own outcome.
    if (composed.status === 'cancelled') {
      // User opened the composer and tapped Cancel. We still consider
      // this "opened" because the record served its purpose: showing
      // them what they were about to send. We don't want to bug them
      // by marking it 'failed' and retrying behind their back.
      return { kind: 'opened_composer', via: 'mail' };
    }

    return { kind: 'opened_composer', via: 'mail' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSilentFailure('feedback.mailComposer', message);
    return { kind: 'no_transport_available' };
  }
}

// ─── SHARE SHEET FALLBACK ────────────────────────────────────────────

/**
 * Open the OS share sheet so the user picks a channel (Mail, WhatsApp,
 * Telegram, Discord, etc.). Pre-fills the message body.
 *
 * Note: share sheet doesn't support a separate "To:" — the channel
 * the user picks decides who receives it. We DO include the dev email
 * in the message body so the user can copy it if needed.
 */
async function tryShareSheet(
  record: BetaFeedbackRecord
): Promise<FeedbackDeliveryResult> {
  try {
    await Share.share({
      message: buildShareMessage(record),
      title: buildSubject(record),
    });
    return { kind: 'opened_composer', via: 'share' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSilentFailure('feedback.shareSheet', message);
    return { kind: 'error', message };
  }
}

// ─── MESSAGE FORMATTING ──────────────────────────────────────────────

/**
 * Subject line. Designed to be scannable in a dev's inbox:
 *
 *   [Dottie Beta] 🙂 feedback from priya@gmail.com
 *
 * The mood emoji at the start lets the dev triage at a glance —
 * frowny faces deserve faster attention than hearts.
 */
function buildSubject(record: BetaFeedbackRecord): string {
  const moodEmoji = moodToEmoji(record.mood);
  const from = record.email?.trim() || 'anonymous tester';
  return `[Dottie Beta] ${moodEmoji} feedback from ${from}`;
}

/**
 * Email body. Plain text, hand-formatted so it threads well across
 * email clients without HTML weirdness.
 */
function buildEmailBody(record: BetaFeedbackRecord): string {
  const moodLabel = moodToLabel(record.mood);
  const moodEmoji = moodToEmoji(record.mood);

  const lines: string[] = [
    `Hi Dottie team,`,
    ``,
    `Mood: ${moodEmoji} ${moodLabel}`,
    ``,
    `Message:`,
    record.message.trim(),
    ``,
    `———`,
    `Context (auto-attached so you can help me):`,
    `App: Dottie ${record.appVersion} (build ${record.buildNumber})`,
  ];

  if (record.companion) lines.push(`Companion: ${record.companion}`);
  if (record.userMode) lines.push(`Mode: ${record.userMode}`);
  if (record.phase) {
    const dayPart = record.dayInCycle ? ` day ${record.dayInCycle}` : '';
    lines.push(`Phase: ${record.phase}${dayPart}`);
  }
  lines.push(`Sent: ${formatTimestamp(record.createdAt)}`);

  if (record.email) {
    lines.push(``);
    lines.push(`Feel free to reply at ${record.email} 🌸`);
  } else {
    lines.push(``);
    lines.push(`(I didn't share my email — that's ok, this is just to help!)`);
  }

  return lines.join('\n');
}

/**
 * Share-sheet text — same data as the email body but prefixed with
 * the destination email so users sharing via WhatsApp / Telegram can
 * still route the message manually.
 */
function buildShareMessage(record: BetaFeedbackRecord): string {
  return [
    `To: ${getFeedbackToEmail()}`,
    `Subject: ${buildSubject(record)}`,
    ``,
    buildEmailBody(record),
  ].join('\n');
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function moodToEmoji(mood: number): string {
  const opt = FEEDBACK_MOOD_OPTIONS.find((m) => m.value === mood);
  return opt?.emoji ?? '🙂';
}

function moodToLabel(mood: number): string {
  const opt = FEEDBACK_MOOD_OPTIONS.find((m) => m.value === mood);
  return opt?.label ?? 'Decent';
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
