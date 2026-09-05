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
 *   • check-in reminder    → DAILY at a preset time, or an exact time the user set
 *   • hydration nudge      → DAILY at midday, or an exact time the user set
 *   • period heads-up      → one-shot DATE, 1–5 days before the predicted period
 *   • period-arrived check → one-shot DATE, on the predicted day itself (DT21)
 *   • phase change         → one-shot DATE, on the predicted ovulation day (DT21)
 *   • weekly recap         → WEEKLY, Sunday evening (DT21)
 *   • custom reminders     → DAILY, the user's own words at the user's own time
 *   • medications          → DAILY, per saved plan
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
import {
  Storage,
  type ReminderPrefs,
  type ReminderTime,
  type MedicationPlan,
  type CustomReminder,
} from '../database/storage';
import { logSilentFailure } from '../diagnostics/silent-failure';

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

/** expo-notifications weekdays are 1-indexed from Sunday. */
const SUNDAY = 1;

export interface ScheduleContext {
  /** Discrete copy (safe lock screen) vs explicit — mirror `Storage.discreteNotifications`. */
  discrete: boolean;
  /** ISO date of the predicted next period, for the heads-up (null = skip it). */
  predictedNextPeriod: string | null;
  /**
   * ISO date of the predicted ovulation, for the phase-change note (DT21).
   * OPTIONAL so the call sites that only know about the period keep working —
   * a missing date simply means that one reminder isn't scheduled, never a
   * reminder fired on a date we made up.
   */
  predictedOvulation?: string | null;
}

export interface ScheduleResult {
  granted: boolean;
  scheduled: number;
}

/**
 * Read-only permission check + channel setup. NEVER prompts. Used by the
 * background sync path so a Save/Done tap never fires the native OS dialog
 * as a side effect. Device-test #5: MIUI renders the permission dialog as
 * a floating white circle at the top-left that blocks input until the user
 * hits the back button — the "screen hang" the owner reported.
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  } catch (err) {
    logSilentFailure('notifications.permissionCheck', err);
    return false;
  }
}

/**
 * Explicitly prompt for notification permission. Ok to fire the native
 * dialog — MUST only be called from a UI element the user tapped
 * (e.g., an "Enable notifications" button on the Reminders screen).
 * Never call from a Save/Done handler or a background sync — see
 * checkNotificationPermission for that path.
 */
export async function requestNotificationPermission(): Promise<boolean> {
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
    logSilentFailure('notifications.permissionRequest', err);
    return false;
  }
}

/** @deprecated Use checkNotificationPermission (silent) or
 * requestNotificationPermission (explicit) instead. Kept as an alias so
 * older imports don't break, but points at the SILENT check to avoid
 * the MIUI hang. */
export const ensureNotificationPermission = checkNotificationPermission;

/**
 * Reschedule EVERYTHING (reminders + medications) from what's persisted in
 * Storage. This is the single source of truth: because we cancel-all then
 * re-add, any screen that changes prefs/meds should persist first, then call
 * this. Also re-run it after a check-in updates the prediction.
 */
export async function syncAllReminders(ctx: ScheduleContext): Promise<ScheduleResult> {
  const prefs = Storage.reminderPrefs.get();
  const meds = Storage.medications.get();
  const activeMeds = meds.filter((m) => m.active);

  const activeCustom = prefs.custom.filter((c) => c.active && c.label.trim().length > 0);
  const anyOn =
    prefs.checkIn ||
    prefs.hydration ||
    prefs.periodHeadsUp ||
    prefs.periodArrivedCheck ||
    prefs.phaseChange ||
    prefs.weeklyRecap ||
    activeCustom.length > 0 ||
    activeMeds.length > 0;

  // Nothing on → make sure we've torn down any prior schedule and stop.
  if (!anyOn) {
    await cancelAll();
    return { granted: true, scheduled: 0 };
  }

  // Never prompt from the sync path — that's the MIUI white-circle hang.
  // If permission isn't already granted, bail silently; the UI can show
  // an "Enable notifications" affordance that calls
  // requestNotificationPermission from an explicit user tap.
  const granted = await checkNotificationPermission();
  if (!granted) return { granted: false, scheduled: 0 };

  await cancelAll();
  let scheduled = 0;

  if (prefs.checkIn) {
    // An exact time the user set wins over the preset bucket.
    await scheduleDaily(
      'check_in_reminder',
      prefs.checkInHour ?? TIME_HOUR[prefs.checkInTime],
      prefs.checkInMinute ?? 0,
      ctx.discrete
    );
    scheduled++;
  }
  if (prefs.hydration) {
    await scheduleDaily(
      'hydration_nudge',
      prefs.hydrationHour ?? TIME_HOUR.midday,
      prefs.hydrationMinute ?? 0,
      ctx.discrete
    );
    scheduled++;
  }
  if (prefs.periodHeadsUp && ctx.predictedNextPeriod) {
    const when = dateAt(ctx.predictedNextPeriod, -clampLeadDays(prefs.periodHeadsUpLeadDays), 10);
    if (when) {
      await scheduleAt('period_window_approaching', when, ctx.discrete);
      scheduled++;
    }
  }
  // The predicted day itself: "did it start?" This is the one that keeps the
  // prediction honest — an unlogged period is what makes the next estimate
  // drift, and it is the day people are least likely to open the app.
  if (prefs.periodArrivedCheck && ctx.predictedNextPeriod) {
    const when = dateAt(ctx.predictedNextPeriod, 0, 19);
    if (when) {
      await scheduleAt('period_arrived_check', when, ctx.discrete);
      scheduled++;
    }
  }
  // Phase change. Only ovulation is scheduled, and only when the predictor
  // actually produced a date — a phase note on a guessed day would be the
  // app asserting something about the user's body that it does not know.
  if (prefs.phaseChange && ctx.predictedOvulation) {
    const when = dateAt(ctx.predictedOvulation, 0, 9);
    if (when) {
      await scheduleAt('phase_transition', when, ctx.discrete);
      scheduled++;
    }
  }
  if (prefs.weeklyRecap) {
    await scheduleWeekly('weekly_recap', SUNDAY, 18, 0, ctx.discrete);
    scheduled++;
  }
  for (const custom of prefs.custom) {
    if (!custom.active || custom.label.trim().length === 0) continue;
    await scheduleCustom(custom);
    scheduled++;
  }
  for (const med of activeMeds) {
    await scheduleMedication(med, ctx.discrete);
    scheduled++;
  }

  return { granted: true, scheduled };
}

/**
 * Persist the given reminder prefs, then reschedule everything. Kept for the
 * Reminders screen's call site; medications are picked up from Storage.
 */
export async function applyReminderPrefs(
  prefs: ReminderPrefs,
  ctx: ScheduleContext
): Promise<ScheduleResult> {
  Storage.reminderPrefs.set(prefs);
  return syncAllReminders(ctx);
}

/** Cancel every reminder Dottie scheduled (we're the app's only scheduler). */
export async function cancelAll(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    logSilentFailure('notifications.cancelAll', err);
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
    logSilentFailure(`notifications.schedule.${kind}`, err);
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
    logSilentFailure(`notifications.schedule.${kind}`, err);
  }
}

async function scheduleMedication(plan: MedicationPlan, discrete: boolean): Promise<void> {
  const copy = getNotificationCopy('medication_reminder', discrete ? 'discrete' : 'explicit');
  // The med NAME only appears in the explicit copy — the discrete title stays
  // generic so a lock-screen glance never reveals it's birth control.
  const title = discrete ? copy.title : copy.title.replace('{name}', plan.name);
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body: copy.body },
      // An exact time set by the user wins over the preset bucket.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: plan.hour ?? TIME_HOUR[plan.time], minute: plan.minute ?? 0 },
    });
  } catch (err) {
    logSilentFailure('notifications.scheduleMedication', err);
  }
}

async function scheduleWeekly(
  kind: NotificationKind,
  weekday: number,
  hour: number,
  minute: number,
  discrete: boolean
): Promise<void> {
  const copy = getNotificationCopy(kind, discrete ? 'discrete' : 'explicit');
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute },
    });
  } catch (err) {
    logSilentFailure(`notifications.schedule.${kind}`, err);
  }
}

/**
 * A reminder the user wrote. Their words are the title, verbatim.
 *
 * Discreet mode deliberately does NOT rewrite this: the copy library can
 * disguise Dottie's own sentences because Dottie wrote them, but silently
 * replacing what the user typed would leave them with a reminder that doesn't
 * say what they asked it to say. The Reminders screen says so in as many words
 * next to the field, so the choice is theirs and it is an informed one.
 */
async function scheduleCustom(reminder: CustomReminder): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.label.trim(), body: 'A reminder you set.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
  } catch (err) {
    logSilentFailure('notifications.scheduleCustom', err);
  }
}

/** Keep the heads-up lead inside the range the UI offers. */
function clampLeadDays(days: number): number {
  if (!Number.isFinite(days)) return 3;
  return Math.min(5, Math.max(1, Math.round(days)));
}

/**
 * `offsetDays` from an ISO date, at `hour` local time. Null when that moment
 * has already passed — scheduling into the past would fire immediately.
 *
 * NOTE this deliberately builds a LOCAL Date from the civil date rather than
 * parsing it as UTC: a notification is a wall-clock event in the user's own
 * timezone. (See CLAUDE.md rule 3 — all civil-date ARITHMETIC goes through
 * civil-date.ts; this is the one place we cross from a civil date into a real
 * instant, and `T00:00:00` with no Z is what makes it local.)
 */
function dateAt(iso: string, offsetDays: number, hour: number): Date | null {
  const when = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(when.getTime())) return null;
  when.setDate(when.getDate() + offsetDays);
  when.setHours(hour, 0, 0, 0);
  return when.getTime() > Date.now() ? when : null;
}
