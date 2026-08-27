/**
 * Dottie — Discrete Notification Copy
 *
 * Central library of every push / local notification string the app
 * will send. Each notification has TWO variants:
 *
 *   1. `discrete` (DEFAULT) — never mentions periods, cycles, or
 *      anything sensitive. Reads like a wellness app reminder.
 *      Used when `Storage.discreteNotifications.get() === true`.
 *
 *   2. `explicit` — warm, on-brand, mentions the actual topic.
 *      Used when the user opts INTO explicit notifications from
 *      settings (e.g., for users who don't share their phone).
 *
 * ─── WHY CENTRALIZE ─────────────────────────────────────────────────
 *
 *  - One place to audit "could a snooper figure out from a lock-screen
 *    preview that this is a period app?". Today: no.
 *  - One place for localization later (drop in a per-locale file).
 *  - One place for product copy reviews — no notification text lives
 *    in random feature files.
 *
 * ─── INTEGRATION ────────────────────────────────────────────────────
 *
 *  This module is intentionally PURE — no expo-notifications imports,
 *  no scheduling logic. The notification scheduler (future chunk) will
 *  import these strings and call expo-notifications itself.
 *
 *  For MVP we ship the COPY LIBRARY but defer the actual scheduling
 *  to a later chunk so we don't pull in another permission prompt
 *  during beta testing. The copy is in place so when scheduling lands,
 *  it's a one-import wire-up.
 *
 *  Example usage (future):
 *      import { getNotificationCopy } from '@/notifications/copy';
 *      const copy = getNotificationCopy('period_window_approaching');
 *      Notifications.scheduleNotificationAsync({
 *        content: { title: copy.title, body: copy.body },
 *        trigger: { ... },
 *      });
 */

import { Storage } from '../database/storage';

// ─── NOTIFICATION KINDS ──────────────────────────────────────────────

/**
 * Every notification the app will ever send must be one of these
 * kinds. Adding a new kind = adding an entry to NOTIFICATION_COPY.
 *
 * Naming convention: snake_case describing the trigger, NOT the topic.
 *   GOOD: `period_window_approaching`, `check_in_streak_reminder`
 *   BAD:  `cramps_alert`, `bleeding_reminder` (too on-the-nose)
 */
export type NotificationKind =
  | 'check_in_reminder'             // daily nudge to log
  | 'check_in_streak_at_risk'       // 24h since last log, streak in danger
  | 'hydration_nudge'               // gentle "sip some water" reminder
  | 'period_window_approaching'     // 2-3 days before predicted period
  | 'period_arrived_check'          // gentle ask: "did it start?"
  | 'phase_transition'              // entered new cycle phase
  | 'lesson_available'              // new content unlock
  | 'sisterhood_care_nudge'         // someone sent you a care nudge
  | 'sisterhood_phase_sync'         // you + a sister are in sync
  | 'badge_earned'                  // earned a badge in the background
  | 'level_up'                      // crossed XP threshold
  | 'weekly_recap'                  // Sunday wrap-up
  | 'app_anniversary';              // 1mo / 6mo / 1yr milestones

// ─── COPY SHAPE ──────────────────────────────────────────────────────

export interface NotificationCopy {
  /** Lock-screen title (≤ ~30 chars to avoid truncation). */
  title: string;
  /** Lock-screen body (≤ ~110 chars). */
  body: string;
}

export interface NotificationCopyPair {
  /** The disguised version — safe for any lock screen. */
  discrete: NotificationCopy;
  /** The on-brand warm version. */
  explicit: NotificationCopy;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Get the correct copy variant based on the user's discrete-notification
 * preference (read live from MMKV).
 *
 * Pass `forceMode` to override the preference (useful for previews in
 * the settings screen).
 */
export function getNotificationCopy(
  kind: NotificationKind,
  forceMode?: 'discrete' | 'explicit'
): NotificationCopy {
  const pair = NOTIFICATION_COPY[kind];
  const mode = forceMode ?? (Storage.discreteNotifications.get() ? 'discrete' : 'explicit');
  return mode === 'discrete' ? pair.discrete : pair.explicit;
}

/**
 * For settings preview UI: show the user what their notifications will
 * look like in their current mode side-by-side.
 */
export function previewBothVariants(kind: NotificationKind): NotificationCopyPair {
  return NOTIFICATION_COPY[kind];
}

// ─── THE COPY LIBRARY ────────────────────────────────────────────────

/**
 * Every word a user might see on their lock screen lives here.
 *
 * Discrete copy guidelines:
 *  - Generic "wellness app" voice
 *  - Emoji are okay if they're ambiguous (🌱 🌸 ☀️) — NOT 🩸 🌹 (rose)
 *  - Avoid: "period", "cycle", "ovulation", "luteal", "phase", "PMS"
 *  - Avoid: specific dates ("April 5") — use "this week"
 *  - Body should feel like a calendar/notes app reminder
 *
 * Explicit copy guidelines:
 *  - Warm, friendly, second-person
 *  - Companion name optional — keep it generic so all companions work
 *  - One emoji per line max
 */
const NOTIFICATION_COPY: Record<NotificationKind, NotificationCopyPair> = {
  check_in_reminder: {
    discrete: {
      title: 'A gentle reminder',
      body: 'A small check-in waiting in your app when you have a moment.',
    },
    explicit: {
      title: 'Time for a check-in 🌸',
      body: 'How are you feeling today? Dottie\'s ready when you are.',
    },
  },

  check_in_streak_at_risk: {
    discrete: {
      title: 'Your streak is waiting',
      body: 'You\'ve been on a roll. A quick visit keeps it going.',
    },
    explicit: {
      title: 'Your streak is calling 🔥',
      body: 'One tiny tap protects your streak. We\'ll keep it warm.',
    },
  },

  hydration_nudge: {
    discrete: {
      title: 'A little reminder 💧',
      body: 'A glass of water sounds nice about now. Small kindnesses count.',
    },
    explicit: {
      title: 'Sip some water 💧',
      body: 'A gentle hydration nudge from Dottie — your body will thank you.',
    },
  },

  period_window_approaching: {
    discrete: {
      title: 'A heads-up for this week',
      body: 'Just a friendly note — something may be on the horizon. Tap to see.',
    },
    explicit: {
      title: 'Your window is approaching 🌸',
      body: 'Cozy supplies, a soft plan — Dottie\'s got some gentle ideas.',
    },
  },

  period_arrived_check: {
    discrete: {
      title: 'A small check-in',
      body: 'Whenever you have a moment, your journal\'s here for you.',
    },
    explicit: {
      title: 'Anything to log today? 💛',
      body: 'No pressure — Dottie\'s here when you want to update her.',
    },
  },

  phase_transition: {
    discrete: {
      title: 'Something new today',
      body: 'A fresh chapter starts. Tap to see what\'s in store.',
    },
    explicit: {
      title: 'A new phase begins 🌱',
      body: 'Your body shifted gears today. Here\'s what to expect.',
    },
  },

  lesson_available: {
    discrete: {
      title: 'New reading for you',
      body: 'A short article is waiting in your library.',
    },
    explicit: {
      title: 'New lesson unlocked 📚',
      body: 'Something short and lovely is ready when you are.',
    },
  },

  sisterhood_care_nudge: {
    discrete: {
      title: 'A friend says hi',
      body: 'Someone you care about is thinking of you. Tap to see.',
    },
    explicit: {
      title: 'A care nudge for you 🤗',
      body: 'Someone in your Sisterhood Circle sent you warmth today.',
    },
  },

  sisterhood_phase_sync: {
    discrete: {
      title: 'A small connection',
      body: 'You and someone you care about are in sync this week.',
    },
    explicit: {
      title: 'You\'re in sync 🌸',
      body: 'You and a sister are in the same phase right now. Lovely.',
    },
  },

  badge_earned: {
    discrete: {
      title: 'You earned something',
      body: 'A small badge is yours. Tap to see what you unlocked.',
    },
    explicit: {
      title: 'New badge earned 🏅',
      body: 'You did the thing! Tap to see your new badge.',
    },
  },

  level_up: {
    discrete: {
      title: 'You leveled up',
      body: 'You\'ve unlocked a new chapter. Open to see what\'s next.',
    },
    explicit: {
      title: 'Level up! ✨',
      body: 'You crossed a milestone. Dottie\'s proud of you.',
    },
  },

  weekly_recap: {
    discrete: {
      title: 'Your week, gently',
      body: 'A small recap is ready when you want to look back.',
    },
    explicit: {
      title: 'Your week in review 🌷',
      body: 'A warm look back at how the week treated you.',
    },
  },

  app_anniversary: {
    discrete: {
      title: 'A small milestone',
      body: 'You\'ve been showing up for yourself. Open to celebrate.',
    },
    explicit: {
      title: 'A Dottie milestone 🎉',
      body: 'Look how far you\'ve come. Thank you for trusting Dottie.',
    },
  },
};

// ─── HELPERS FOR TESTING / PREVIEW ──────────────────────────────────

/**
 * Listing of every kind. Useful for the settings preview screen that
 * shows the user "here's what every reminder looks like."
 */
export const ALL_NOTIFICATION_KINDS: NotificationKind[] = Object.keys(
  NOTIFICATION_COPY
) as NotificationKind[];
