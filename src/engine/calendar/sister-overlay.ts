/**
 * Dottie — Sister Calendar Overlay (device-test-6)
 *
 * Puts the people you care for onto YOUR cycle calendar instead of making you
 * keep a second one.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Sisterhood used to own a separate date-slider screen for logging a sister's
 *  period, and the main calendar showed nothing about her at all — so opening
 *  the Cycle tab told you nothing about the people you're tracking, and there
 *  was no way to see a sister's period coming. The owner's call was simply:
 *  reuse the one calendar, and paint a sister's days in her own colour, exactly
 *  the way menstrual/follicular/luteal already are.
 *
 *  This module is the PURE core of that: given each sister's logged period days
 *  and her predicted next start, it returns
 *    • which dates carry a sister marker (and whether it's logged or predicted)
 *    • which sisters have a period approaching, with warm, non-diagnostic copy
 *  No React, no SQLite, no Date.now() — every input is passed in, so the whole
 *  thing is deterministic and unit-testable (scripts/sister-overlay-harness.ts).
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  Callers must only pass sisters whose privacy level actually exposes cycle
 *  data. This module trusts its input and does no filtering of its own — that
 *  decision belongs at the store/UI boundary where the privacy level lives.
 */

const DAY_MS = 86400000;

/** One sister's cycle facts for the visible range. */
export interface SisterCycleInput {
  memberId: string;
  displayName: string;
  emoji: string;
  /** Her logged period days (ISO yyyy-mm-dd). May include dates outside the range. */
  periodDays: readonly string[];
  /** Her predicted next period start (ISO), or null when unknown. */
  predictedNextPeriod: string | null;
  /** Her typical period length in days. Defaults to the population median (5). */
  periodLengthDays?: number;
}

export type SisterMarkKind = 'logged' | 'predicted';

export interface SisterDayMark {
  memberId: string;
  displayName: string;
  emoji: string;
  kind: SisterMarkKind;
}

export interface SisterHeadsUp {
  memberId: string;
  displayName: string;
  emoji: string;
  /** Whole days from today to her predicted start (0 = today). */
  daysUntil: number;
  /** Warm, non-diagnostic one-liner for the calendar. */
  message: string;
}

export interface SisterOverlay {
  /** ISO date → every sister marker on that date (a day can hold several). */
  marksByDate: Map<string, SisterDayMark[]>;
  /** Sisters with a period approaching, soonest first. */
  headsUp: SisterHeadsUp[];
}

export interface BuildSisterOverlayInput {
  sisters: readonly SisterCycleInput[];
  /** Visible range, inclusive (ISO). */
  rangeStart: string;
  rangeEnd: string;
  /** Today (ISO) — injected so this stays pure and testable. */
  today: string;
  /** How many days ahead still counts as "approaching". Default 5. */
  headsUpWindowDays?: number;
}

const DEFAULT_PERIOD_LENGTH = 5;
const DEFAULT_HEADS_UP_WINDOW = 5;

/**
 * Build the sister overlay for one visible month.
 *
 * A LOGGED day always wins over a PREDICTED one for the same sister — once she
 * has actually bled on a date, showing a guess on top of it would be noise.
 */
export function buildSisterOverlay(input: BuildSisterOverlayInput): SisterOverlay {
  const headsUpWindow = input.headsUpWindowDays ?? DEFAULT_HEADS_UP_WINDOW;
  const marksByDate = new Map<string, SisterDayMark[]>();
  const headsUp: SisterHeadsUp[] = [];

  const push = (iso: string, mark: SisterDayMark): void => {
    const existing = marksByDate.get(iso);
    if (existing) existing.push(mark);
    else marksByDate.set(iso, [mark]);
  };

  for (const sister of input.sisters) {
    const identity = {
      memberId: sister.memberId,
      displayName: sister.displayName,
      emoji: sister.emoji,
    };

    // ── Logged days (authoritative) ──────────────────────────────
    const loggedInRange = new Set<string>();
    for (const iso of sister.periodDays) {
      if (!inRange(iso, input.rangeStart, input.rangeEnd)) continue;
      if (loggedInRange.has(iso)) continue; // de-dupe repeated rows
      loggedInRange.add(iso);
      push(iso, { ...identity, kind: 'logged' });
    }

    // ── Predicted band ───────────────────────────────────────────
    if (sister.predictedNextPeriod) {
      const len = clampInt(sister.periodLengthDays ?? DEFAULT_PERIOD_LENGTH, 1, 10);
      for (let i = 0; i < len; i++) {
        const iso = addDays(sister.predictedNextPeriod, i);
        if (!inRange(iso, input.rangeStart, input.rangeEnd)) continue;
        if (loggedInRange.has(iso)) continue; // never guess over a real log
        push(iso, { ...identity, kind: 'predicted' });
      }

      // ── Heads-up ───────────────────────────────────────────────
      const daysUntil = diffDays(sister.predictedNextPeriod, input.today);
      if (daysUntil >= 0 && daysUntil <= headsUpWindow) {
        headsUp.push({
          ...identity,
          daysUntil,
          message: headsUpMessage(sister.displayName, daysUntil),
        });
      }
    }
  }

  headsUp.sort((a, b) => a.daysUntil - b.daysUntil || a.displayName.localeCompare(b.displayName));
  return { marksByDate, headsUp };
}

/** Warm, non-diagnostic copy. Never instructs, never diagnoses. */
function headsUpMessage(name: string, daysUntil: number): string {
  if (daysUntil === 0) return `${name}'s period is likely to start today — a good day to check in.`;
  if (daysUntil === 1) return `${name}'s period is likely to start tomorrow.`;
  return `${name}'s period is likely to start in ${daysUntil} days.`;
}

// ─── DATE HELPERS (string-in, string-out; local-midnight safe) ───────

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from `from` to `iso` (positive = in the future). */
export function diffDays(iso: string, from: string): number {
  return Math.round((toDate(iso).getTime() - toDate(from).getTime()) / DAY_MS);
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end; // ISO dates sort lexicographically
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
