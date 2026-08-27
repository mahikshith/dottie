/**
 * Dottie — Notification Scheduler (design-v2)
 *
 * The local-notification engine. Turns the user's reminder preferences +
 * discrete/explicit copy (`./copy`) into scheduled OS notifications via
 * `expo-notifications`. Everything is LOCAL and opt-in — no server, no push, no
 * data leaves the device (the app's privacy stance).
 *
 * ─── WHAT IT SCHEDULES ──────────────────────────────────────────────
 *
 *   • check-in reminder   → DAILY at a preset time (morning/midday/evening)
 *   • hydration nudge      → DAILY at midday
 *   • period heads-up      → one-shot DATE, ~3 days before the predicted period
 *
 * ─── PLATFORM NOTES (from docs/NEXT-FEATURES-RESEARCH.md) ────────────
 *
 *   • iOS needs explicit permission; we only ask once the user turns a reminder ON.
 *   • Android needs a channel; exact alarms aren't required for these (day-level
 *     reminders are fine).
 *   • DAILY / DATE triggers are cross-platform.
 *   • Rescheduling = cancel-all-ours + re-add (we're the only scheduler).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). `expo-notifications` needs a dev build
 *  (`npx expo install expo-notifications` + prebuild) — consistent with the app
 *  already requiring one (MMKV). Verify permission + delivery on a real device.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getNotificationCopy, type NotificationKind } from './copy';
import type { ReminderPrefs, ReminderTime } from '../database/storage';

// Foreground behaviour: show the reminder even if the app is open (gentle).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL = 'dottie-reminders';

/** Map a preset to the hour it fires at (local time). */
const TIME_HOUR: Record<ReminderTime, number> = { morning: 9, midday: 13, evening: 20 };

export interface ScheduleContext {
  /** Discrete copy (safe lock screen) vs explicit — mirror `Storage.discreteNotifications`. */
  discrete: boolean;
  /** ISO date of the predicted next period, for the heads-up (null = skip it). */
  predictedNextPeriod: string | null;
}

export interface ScheduleResult {
  granted: boolean;
  scheduled: number;
}

/**
 * Ensure we can post notifications. Only called when the user turns a reminder
 * ON, so we never prompt unprompted. Returns whether permission is granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch (err) {
    if (__DEV__) console.warn('[Notifications] permission check failed:', err);
    return false;
  }
}

/**
 * Apply the user's reminder preferences: cancels our existing schedule and
 * re-adds whatever is enabled. Call this whenever prefs OR the prediction change
 * (e.g. from the Reminders screen, and after a check-in re-runs prediction).
 */
export async function applyReminderPrefs(
  prefs: ReminderPrefs,
  ctx: ScheduleContext
): Promise<ScheduleResult> {
  const anyOn = prefs.checkIn || prefs.hydration || prefs.periodHeadsUp;

  // Nothing on → make sure we've torn down any prior schedule and stop.
  if (!anyOn) {
    await cancelAll();
    return { granted: true, scheduled: 0 };
  }

  const granted = await ensureNotificationPermission();
  if (!granted) return { granted: false, scheduled: 0 };

  await cancelAll();
  let scheduled = 0;

  if (prefs.checkIn) {
    await scheduleDaily('check_in_reminder', TIME_HOUR[prefs.checkInTime], 0, ctx.discrete);
    scheduled++;
  }
  if (prefs.hydration) {
    await scheduleDaily('hydration_nudge', TIME_HOUR.midday, 0, ctx.discrete);
    scheduled++;
  }
  if (prefs.periodHeadsUp && ctx.predictedNextPeriod) {
    const when = headsUpDate(ctx.predictedNextPeriod);
    if (when) {
      await scheduleAt('period_window_approaching', when, ctx.discrete);
      scheduled++;
    }
  }

  return { granted: true, scheduled };
}

/** Cancel every reminder Dottie scheduled (we're the app's only scheduler). */
export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    if (__DEV__) console.warn('[Notifications] cancelAll failed:', err);
  }
}

// ─── INTERNAL ────────────────────────────────────────────────────────

async function scheduleDaily(kind: NotificationKind, hour: number, minute: number, discrete: boolean): Promise<void> {
  const copy = getNotificationCopy(kind, discrete ? 'discrete' : 'explicit');
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  } catch (err) {
    if (__DEV__) console.warn(`[Notifications] schedule ${kind} failed:`, err);
  }
}

async function scheduleAt(kind: NotificationKind, date: Date, discrete: boolean): Promise<void> {
  const copy = getNotificationCopy(kind, discrete ? 'discrete' : 'explicit');
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  } catch (err) {
    if (__DEV__) console.warn(`[Notifications] schedule ${kind} failed:`, err);
  }
}

/** ~3 days before the predicted period, at 10am local. Null if that's in the past. */
function headsUpDate(predictedISO: string): Date | null {
  const predicted = new Date(`${predictedISO}T00:00:00`);
  const when = new Date(predicted);
  when.setDate(when.getDate() - 3);
  when.setHours(10, 0, 0, 0);
  return when.getTime() > Date.now() ? when : null;
}
