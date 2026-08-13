/**
 * Dottie — Sisterhood Engine
 *
 * Pure functions for sisterhood-specific computations. No I/O.
 *
 * ─── WHAT LIVES HERE ────────────────────────────────────────────────
 *
 *   buildMemberView           Project a raw member + shadow data down to
 *                             a privacy-filtered MemberView.
 *
 *   deriveShadowPhase         Compute current phase + day in cycle for
 *                             a shadow member, given their cycle history.
 *
 *   detectPhaseSync           Compare the primary's phase to a member's
 *                             phase and return true if synced today.
 *
 *   pickCareNudgeSituation    Given a member's current state, pick the
 *                             situation that best fits a care nudge.
 *
 *   generateTransferCode      Random human-friendly code for shadow handoff.
 *
 *   isTransferCodeValid       Check expiry + redemption status.
 */

import {
  MemberView,
  SisterhoodMember,
  ShadowContext,
  ShadowCycleEntry,
  ShadowCheckIn,
  CareNudgeSituation,
  deriveMoodSignal,
  ACTIVITY_FRESH_DAYS,
  TRANSFER_CODE_LENGTH,
  TRANSFER_CODE_TTL_HOURS,
  ProfileTransferCode,
} from '../../types/sisterhood.types';
import { Phase } from '../../types/cycle.types';

// ─── BUILD MEMBER VIEW ───────────────────────────────────────────────

/**
 * Inputs the view-builder needs. The caller assembles this from
 * whichever data sources are available (shadow tables for shadow
 * members, future sync layer for linked members).
 *
 * Most fields are optional — the view-builder copes with missing data
 * by returning null in the corresponding view field.
 */
export interface MemberViewInputs {
  member: SisterhoodMember;
  /** True when primary's current phase === member's current phase today */
  inPhaseSync: boolean;
  /** Member's current phase if computable, else null */
  currentPhase?: Phase | null;
  /** Day in cycle (1 = first day of period) */
  dayInCycle?: number | null;
  /** Predicted next period start date (ISO) */
  predictedNextPeriod?: string | null;
  /** Mood score 1-5 from most recent shadow check-in (or future linked sync) */
  moodScore?: number | null;
  /** Energy level 1-5 from most recent shadow check-in */
  energyLevel?: number | null;
  /** Flow level 0-5 if today is a period day */
  flowLevel?: number | null;
  /** Recent symptoms (free-text labels) */
  recentSymptoms?: string[];
  /** Member's current streak (linked members only, else null) */
  streak?: number | null;
}

/**
 * Build the privacy-filtered MemberView. Every privacy level is
 * enumerated explicitly so the rules are auditable in one place.
 */
export function buildMemberView(inputs: MemberViewInputs): MemberView {
  const base: MemberView = {
    memberId: inputs.member.id,
    displayName: inputs.member.displayName,
    emoji: inputs.member.emoji,
    relationship: inputs.member.relationship,
    kind: inputs.member.kind,
    privacyLevel: inputs.member.privacyLevel,
    streak: inputs.streak ?? null,
    lastActiveAt: inputs.member.lastActiveAt,
    currentPhase: null,
    dayInCycle: null,
    predictedNextPeriod: null,
    moodScore: null,
    energyLevel: null,
    moodSignal: null,
    flowLevel: null,
    recentSymptoms: [],
    inPhaseSync: false,
  };

  switch (inputs.member.privacyLevel) {
    case 'full':
      return {
        ...base,
        currentPhase: inputs.currentPhase ?? null,
        dayInCycle: inputs.dayInCycle ?? null,
        predictedNextPeriod: inputs.predictedNextPeriod ?? null,
        moodScore: inputs.moodScore ?? null,
        energyLevel: inputs.energyLevel ?? null,
        moodSignal: deriveMoodSignal(inputs.moodScore ?? null),
        flowLevel: inputs.flowLevel ?? null,
        recentSymptoms: inputs.recentSymptoms ?? [],
        inPhaseSync: inputs.inPhaseSync,
      };

    case 'summary':
      return {
        ...base,
        currentPhase: inputs.currentPhase ?? null,
        dayInCycle: inputs.dayInCycle ?? null,
        predictedNextPeriod: inputs.predictedNextPeriod ?? null,
        moodScore: inputs.moodScore ?? null,
        energyLevel: inputs.energyLevel ?? null,
        moodSignal: deriveMoodSignal(inputs.moodScore ?? null),
        // NO flow, NO symptoms — summary stops at mood/energy
        inPhaseSync: inputs.inPhaseSync,
      };

    case 'mood':
      return {
        ...base,
        moodScore: null, // mood-only HIDES the exact score
        moodSignal: deriveMoodSignal(inputs.moodScore ?? null),
        // NO phase, NO day, NO cycle prediction, NO flow, NO symptoms
      };

    case 'connected':
      return {
        ...base,
        // streak + lastActiveAt only (already in base)
      };
  }
}

// ─── DERIVE SHADOW PHASE ─────────────────────────────────────────────

/**
 * Compute the current phase + day in cycle for a shadow member from
 * their period history. Uses the same canonical "luteal phase is
 * fixed at 14 days" model the main prediction engine uses, with a
 * simpler heuristic (no Bayesian) because shadow data is typically
 * sparse.
 *
 * Returns null fields when there's not enough data to confidently
 * say anything.
 */
export function deriveShadowPhase(
  shadowContext: ShadowContext | null,
  cycleEntries: ShadowCycleEntry[],
  today: string = todayISO()
): {
  currentPhase: Phase | null;
  dayInCycle: number | null;
  predictedNextPeriod: string | null;
} {
  // Find the most recent period start
  const lastPeriodStart = findMostRecentPeriodStart(cycleEntries);
  if (!lastPeriodStart) {
    return {
      currentPhase: null,
      dayInCycle: null,
      predictedNextPeriod: null,
    };
  }

  // Average cycle length from context or sensible default
  const avgCycle =
    shadowContext?.averageCycleLength ??
    estimateCycleLengthFromHistory(cycleEntries) ??
    28;

  const lutealLen = 14;
  const periodLen = 5;

  const daysSinceStart = daysBetween(lastPeriodStart, today);
  const dayInCycle = daysSinceStart + 1;

  let currentPhase: Phase;
  if (dayInCycle <= periodLen) {
    currentPhase = 'menstrual';
  } else if (dayInCycle < avgCycle - lutealLen - 2) {
    currentPhase = 'follicular';
  } else if (dayInCycle <= avgCycle - lutealLen + 2) {
    currentPhase = 'ovulatory';
  } else {
    currentPhase = 'luteal';
  }

  const predictedNextPeriod = addDays(lastPeriodStart, avgCycle);

  return {
    currentPhase,
    dayInCycle,
    predictedNextPeriod,
  };
}

// ─── PHASE SYNC DETECTION ────────────────────────────────────────────

/**
 * Returns true when both phases are equal AND both are defined.
 * The "both defined" check matters because null === null shouldn't
 * count as "in sync" — they're just both unknown.
 */
export function detectPhaseSync(
  primaryPhase: Phase | null,
  memberPhase: Phase | null
): boolean {
  if (!primaryPhase || !memberPhase) return false;
  return primaryPhase === memberPhase;
}

// ─── CARE NUDGE SITUATION PICKER ─────────────────────────────────────

/**
 * Given a member's current state, pick the best-fitting situation for
 * a care nudge. Order matters — earlier checks take precedence.
 *
 * The UI then asks the care-nudges content module for templates
 * matching this situation.
 */
export function pickCareNudgeSituation(view: MemberView): CareNudgeSituation {
  // 1. Acute: tough day signals win
  if (view.moodSignal === 'tough_day') {
    if (view.currentPhase === 'luteal') return 'tough_pms';
    return 'low_mood';
  }

  // 2. Period day signals
  if (
    view.currentPhase === 'menstrual' &&
    view.dayInCycle !== null &&
    view.dayInCycle <= 3
  ) {
    return 'period_day';
  }

  // 3. Inactivity nudge
  if (isInactiveFor(view.lastActiveAt, 3)) {
    return 'inactive_3_days';
  }

  // 4. Phase sync moment
  if (view.inPhaseSync) {
    return 'phase_sync';
  }

  // 5. Default warmth
  return 'general_warmth';
}

/**
 * Has the member been inactive for at least N days?
 * Returns false if lastActiveAt is null (never active vs inactive
 * are different states — we don't want to nudge a brand-new member
 * with "where have you been?").
 */
export function isInactiveFor(
  lastActiveAt: string | null,
  days: number
): boolean {
  if (!lastActiveAt) return false;
  const last = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return now - last >= days * dayMs;
}

/** Has the member been seen recently enough to consider them active? */
export function isMemberActive(lastActiveAt: string | null): boolean {
  if (!lastActiveAt) return false;
  return !isInactiveFor(lastActiveAt, ACTIVITY_FRESH_DAYS);
}

// ─── TRANSFER CODE GENERATION ────────────────────────────────────────

/**
 * Generate a human-friendly transfer code. We avoid ambiguous
 * characters (0/O, 1/I/L) so the code can be read aloud without
 * confusion.
 */
export function generateTransferCode(): {
  code: string;
  expiresAt: string;
} {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < TRANSFER_CODE_LENGTH; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  const expiresAt = new Date(
    Date.now() + TRANSFER_CODE_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  return { code, expiresAt };
}

/** Check whether a transfer code is currently valid (not expired, not redeemed). */
export function isTransferCodeValid(
  code: ProfileTransferCode,
  now: Date = new Date()
): boolean {
  if (code.redeemedAt) return false;
  return new Date(code.expiresAt).getTime() > now.getTime();
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function findMostRecentPeriodStart(
  entries: ShadowCycleEntry[]
): string | null {
  const periodDates = entries
    .filter(e => e.isPeriodDay)
    .map(e => e.date)
    .sort((a, b) => b.localeCompare(a));

  if (periodDates.length === 0) return null;

  const set = new Set(periodDates);
  for (const d of periodDates) {
    if (!set.has(subtractDay(d))) return d;
  }
  return periodDates[periodDates.length - 1] ?? null;
}

function estimateCycleLengthFromHistory(
  entries: ShadowCycleEntry[]
): number | null {
  // Build period-start list
  const periodDates = entries
    .filter(e => e.isPeriodDay)
    .map(e => e.date)
    .sort((a, b) => a.localeCompare(b));

  if (periodDates.length < 2) return null;

  // Pick out starts (first day of each block)
  const set = new Set(periodDates);
  const starts: string[] = [];
  for (const d of periodDates) {
    if (!set.has(subtractDay(d))) starts.push(d);
  }

  if (starts.length < 2) return null;

  const diffs: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    diffs.push(daysBetween(starts[i - 1]!, starts[i]!));
  }
  const sum = diffs.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / diffs.length);
  if (avg < 15 || avg > 60) return null;
  return avg;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

function subtractDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]!;
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(`${a}T00:00:00`).getTime();
  const t2 = new Date(`${b}T00:00:00`).getTime();
  return Math.round(Math.abs(t2 - t1) / (24 * 60 * 60 * 1000));
}

// Unused-import suppressor for ShadowCheckIn (re-exported for future use)
void ShadowCheckIn;