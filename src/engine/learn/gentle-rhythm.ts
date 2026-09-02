/**
 * Dottie — Gentle Rhythm (Learn Redesign Phase 4)
 *
 * A soft "kind cadence" signal for the Learn tab. Deliberately NOT a streak.
 *
 * ─── PRINCIPLES ─────────────────────────────────────────────────────
 *
 *   P1  No separate Learn streak. The app already ships a check-in streak
 *       (`src/engine/gamification/streak.ts`) with milestones + cramp-freeze.
 *       Adding a second streak would turn learning into a chore. Instead we
 *       count VISITED DAYS in a rolling window and surface a warm summary.
 *
 *   P2  Rest days count. A day the user showed up counts, whether or not
 *       they finished a lesson. A user who reads the spotlight card, notes
 *       today's hormone story, and moves on has still cared for themselves.
 *
 *   P3  Never punish absence. There is no "streak broken" state, no red X,
 *       no negative language. Missing a day is silent. A month of rest lands
 *       you at 0 of 7 with `warmLabel = "A quiet week — welcome back"`.
 *
 *   P4  A rolling window, not a lifetime score. We keep at most 30 days of
 *       visited-date entries; anything older is pruned. Data footprint stays
 *       small; the UI can render "N of last 7" AND "N of last 14" bands.
 *
 *   P5  Idempotent. Two visits on the same day count as one. A double-write
 *       from tab focus + a rehydration must be safe.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *   The warm label is a state-of-cadence description ("Every visit counts"),
 *   never a wellness claim about the user. It never says "you're doing great"
 *   or "you should study more."
 *
 * ─── PURE ────────────────────────────────────────────────────────────
 *
 *   No React Native imports, no storage reads. All state flows in and out
 *   through the caller. The storage layer (`Storage.learnRhythm`) is a thin
 *   wrapper that persists this state; the engine itself is runnable in the
 *   Node harness (`scripts/gentle-rhythm-harness.ts`).
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

// ─── PUBLIC TYPES ────────────────────────────────────────────────────

/** Persisted state. `visitedDays` is sorted asc; each entry is `YYYY-MM-DD`. */
export interface GentleRhythmState {
  visitedDays: string[];
}

export interface GentleRhythmSummary {
  /** Visited days within the last 7 calendar days INCLUDING today. 0..7. */
  daysLast7: number;
  /** Visited days within the last 14 calendar days INCLUDING today. 0..14. */
  daysLast14: number;
  /** Most recent visited day (YYYY-MM-DD), or null if never visited. */
  mostRecent: string | null;
  /** Total visited days retained in the rolling window (<= 30). */
  windowTotal: number;
  /** A short, warm, non-diagnostic label the UI can render. */
  warmLabel: string;
  /** Small emoji hint (🌱 first visit, 🌿 low, 🌤️ mid, ✨ strong). */
  emoji: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** Maximum days kept in the rolling window; older entries are pruned. */
export const RHYTHM_WINDOW_DAYS = 30;

// ─── STATE OPS ───────────────────────────────────────────────────────

export function createInitialRhythmState(): GentleRhythmState {
  return { visitedDays: [] };
}

/**
 * Record a visit on `todayIso`. Idempotent (a second visit today is a no-op)
 * and prunes anything older than `RHYTHM_WINDOW_DAYS` in the same pass.
 * Returns a NEW state (never mutates the input).
 */
export function recordVisit(state: GentleRhythmState, todayIso: string): GentleRhythmState {
  const iso = normaliseIsoDate(todayIso);
  const kept = pruneOldEntries([...state.visitedDays, iso], iso);
  return { visitedDays: kept };
}

/**
 * Produce the warm summary for the UI. Pure — the same (state, todayIso)
 * always returns the same summary.
 */
export function summarizeRhythm(state: GentleRhythmState, todayIso: string): GentleRhythmSummary {
  const iso = normaliseIsoDate(todayIso);
  const inWindow = state.visitedDays.filter((d) => daysBetween(d, iso) <= RHYTHM_WINDOW_DAYS);

  const daysLast7 = countWithin(inWindow, iso, 7);
  const daysLast14 = countWithin(inWindow, iso, 14);
  const mostRecent = inWindow.length === 0 ? null : inWindow[inWindow.length - 1] ?? null;

  const isFirstEverVisit = state.visitedDays.length === 0;
  const label = warmLabelFor(daysLast7, isFirstEverVisit, mostRecent, iso);
  const emoji = emojiFor(daysLast7, isFirstEverVisit);

  return {
    daysLast7,
    daysLast14,
    mostRecent,
    windowTotal: inWindow.length,
    warmLabel: label,
    emoji,
  };
}

// ─── INTERNAL ────────────────────────────────────────────────────────

function warmLabelFor(
  daysLast7: number,
  isFirstEverVisit: boolean,
  mostRecent: string | null,
  todayIso: string
): string {
  if (isFirstEverVisit) return 'A gentle start. Welcome in.';
  // Distinguish "today counted" from "still to visit today" so the copy fits
  // the actual state of the day.
  const visitedToday = mostRecent === todayIso;
  if (daysLast7 === 0) return 'A quiet week — welcome back.';
  if (daysLast7 === 1) {
    return visitedToday ? 'A visit today. Every one counts.' : 'One visit this week.';
  }
  if (daysLast7 <= 3) return `${daysLast7} kind moments in the last 7 days.`;
  if (daysLast7 <= 5) return `${daysLast7} of the last 7 days — a nice cadence.`;
  if (daysLast7 === 6) return "6 of 7 — you're keeping a warm rhythm.";
  return "Every day this week. Beautifully consistent.";
}

function emojiFor(daysLast7: number, isFirstEverVisit: boolean): string {
  if (isFirstEverVisit) return '🌱';
  if (daysLast7 === 0) return '🌙';
  if (daysLast7 <= 3) return '🌿';
  if (daysLast7 <= 5) return '🌤️';
  return '✨';
}

function countWithin(sortedDates: string[], todayIso: string, days: number): number {
  let n = 0;
  for (const d of sortedDates) {
    const delta = daysBetween(d, todayIso);
    if (delta >= 0 && delta < days) n++;
  }
  return n;
}

function pruneOldEntries(all: string[], todayIso: string): string[] {
  const set = new Set<string>();
  for (const raw of all) {
    const d = normaliseIsoDate(raw);
    // Drop malformed strings that produced a NaN date.
    if (Number.isNaN(new Date(d).getTime())) continue;
    // Drop entries older than the rolling window.
    if (daysBetween(d, todayIso) >= RHYTHM_WINDOW_DAYS) continue;
    // Drop entries somehow in the future — the clock changed, a bad write,
    // whatever. Silently ignore rather than crash.
    if (daysBetween(d, todayIso) < 0) continue;
    set.add(d);
  }
  return Array.from(set).sort();
}

function normaliseIsoDate(s: string): string {
  // Accept a full ISO timestamp OR a YYYY-MM-DD; return YYYY-MM-DD.
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Whole-day difference between two `YYYY-MM-DD` strings (a - never negative shifted). */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    parseInt(from.slice(0, 4), 10),
    parseInt(from.slice(5, 7), 10) - 1,
    parseInt(from.slice(8, 10), 10)
  );
  const b = Date.UTC(
    parseInt(to.slice(0, 4), 10),
    parseInt(to.slice(5, 7), 10) - 1,
    parseInt(to.slice(8, 10), 10)
  );
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
