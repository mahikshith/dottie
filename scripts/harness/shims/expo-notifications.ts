/**
 * Dottie — expo-notifications shim (harness only).
 *
 * Records what WOULD have been scheduled so the harness can assert on reminder
 * behaviour (dedupe, exact times, permission discipline) without a device.
 * Permission is denied by default: the app's rule is that
 * `checkNotificationPermission()` must stay silent, and a shim that always
 * granted would hide a regression where something prompts on its own.
 */

export interface ScheduledCall {
  identifier: string;
  title: string;
  body: string;
  trigger: unknown;
}

export const __scheduled: ScheduledCall[] = [];
export const __calls: string[] = [];
let permission: 'granted' | 'denied' | 'undetermined' = 'undetermined';

export function __setPermission(p: typeof permission): void {
  permission = p;
}
export function __reset(): void {
  __scheduled.length = 0;
  __calls.length = 0;
  permission = 'undetermined';
}

export const AndroidImportance = { DEFAULT: 3, HIGH: 4, MAX: 5 };
export const SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  CALENDAR: 'calendar',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
} as const;

export async function getPermissionsAsync() {
  __calls.push('getPermissionsAsync');
  return { status: permission, granted: permission === 'granted', canAskAgain: true };
}
export async function requestPermissionsAsync() {
  __calls.push('requestPermissionsAsync');
  permission = 'granted';
  return { status: permission, granted: true, canAskAgain: false };
}
export async function scheduleNotificationAsync(req: {
  identifier?: string;
  content: { title?: string; body?: string };
  trigger: unknown;
}): Promise<string> {
  const id = req.identifier ?? `n_${__scheduled.length}`;
  __scheduled.push({
    identifier: id,
    title: req.content.title ?? '',
    body: req.content.body ?? '',
    trigger: req.trigger,
  });
  __calls.push(`schedule:${id}`);
  return id;
}
export async function cancelScheduledNotificationAsync(id: string): Promise<void> {
  const i = __scheduled.findIndex((s) => s.identifier === id);
  if (i >= 0) __scheduled.splice(i, 1);
  __calls.push(`cancel:${id}`);
}
export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  __scheduled.length = 0;
  __calls.push('cancelAll');
}
export async function getAllScheduledNotificationsAsync() {
  return __scheduled.map((s) => ({ identifier: s.identifier, content: { title: s.title, body: s.body }, trigger: s.trigger }));
}
export async function setNotificationChannelAsync(): Promise<void> {
  __calls.push('setChannel');
}
export function setNotificationHandler(): void {}
export function addNotificationResponseReceivedListener() {
  return { remove: () => {} };
}
