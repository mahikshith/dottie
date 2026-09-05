/**
 * Dottie — Reminder de-duplication (device-test-6)
 *
 * The medications screen appended blindly, so tapping "Add" twice — or coming
 * back a week later and re-adding something you'd forgotten was already there —
 * silently created a second identical daily reminder. The user then got the same
 * notification twice a day with no obvious cause, and the list showed two rows
 * that looked identical.
 *
 * This is the pure decision layer: given what's already saved and what the user
 * is about to add, is it the same reminder? Kept out of the screen so it can be
 * unit-tested (scripts/reminder-dedupe-harness.ts).
 *
 * "The same" means: same name (case- and whitespace-insensitive — "vitamin d",
 * "Vitamin D " and "VITAMIN D" are one thing to a human), same kind, and the
 * same time the notification actually FIRES. That last part matters: a preset
 * bucket and an explicit hour can describe the same moment, so we compare the
 * resolved hour/minute rather than the bucket label.
 */

/** Preset buckets → the hour they fire at. Mirrors the scheduler's TIME_HOUR. */
export const PRESET_HOUR: Record<string, number> = {
  morning: 9,
  midday: 13,
  evening: 20,
};

/** The minimum shape needed to compare two reminders. */
export interface ReminderLike {
  name: string;
  kind: string;
  /** Preset bucket ('morning' | 'midday' | 'evening'). */
  time: string;
  /** Optional exact overrides. When present they win over the bucket. */
  hour?: number;
  minute?: number;
}

/** Normalised name: trimmed, collapsed whitespace, lower-cased. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The minute-of-day a reminder actually fires at. */
export function firingMinutes(r: ReminderLike): number {
  const hour = r.hour ?? PRESET_HOUR[r.time] ?? 9;
  const minute = r.minute ?? 0;
  return hour * 60 + minute;
}

/** True when two reminders would fire for the same thing at the same moment. */
export function isSameReminder(a: ReminderLike, b: ReminderLike): boolean {
  return (
    normaliseName(a.name) === normaliseName(b.name) &&
    a.kind === b.kind &&
    firingMinutes(a) === firingMinutes(b)
  );
}

/**
 * The already-saved reminder that `candidate` duplicates, or null.
 * Returns the EXISTING one so the UI can point at it ("you already have this").
 */
export function findDuplicateReminder<T extends ReminderLike>(
  existing: readonly T[],
  candidate: ReminderLike
): T | null {
  return existing.find((r) => isSameReminder(r, candidate)) ?? null;
}

/**
 * A gentle, specific nudge. Never scolds — the user probably just forgot.
 */
export function duplicateReminderMessage(existing: ReminderLike): string {
  const at = formatFiringTime(existing);
  return `You already have a reminder for “${existing.name.trim()}” at ${at}. Adding it again would ping you twice.`;
}

/** "9:00 am" — for the nudge copy. */
export function formatFiringTime(r: ReminderLike): string {
  const total = firingMinutes(r);
  return formatClockTime(Math.floor(total / 60), total % 60);
}

/** "9:00 am" from a plain hour/minute. Used by any time stepper in the UI. */
export function formatClockTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}
