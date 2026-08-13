/**
 * Dottie — Sisterhood Circle Types
 *
 * The Sisterhood Circle lets a primary user (elder sister / friend /
 * caregiver) connect with people in their life — younger siblings,
 * cousins, best friends, partners — to support them through their
 * cycle journey.
 *
 * ─── TWO KINDS OF MEMBERS ───────────────────────────────────────────
 *
 *  LINKED  — The member has their own Dottie account on their own
 *            device. They were invited via a transfer code and chose
 *            their own privacy level. Sync happens via the future
 *            social plane (Supabase). For MVP, linked members are
 *            represented as a placeholder until sync ships.
 *
 *  SHADOW  — The member does NOT have a phone / Dottie account yet.
 *            The primary user logs cycle data ON THEIR BEHALF inside
 *            their own device. The shadow profile lives entirely on
 *            the primary's device until the member gets their own
 *            phone and "claims" the data via a one-time transfer code.
 *
 * ─── PRIVACY LEVELS (set per-member) ────────────────────────────────
 *
 *  full         The primary sees EVERYTHING (period dates, flow,
 *               symptoms, mood, energy). Default for shadow profiles
 *               since the primary is logging on their behalf anyway.
 *
 *  summary      The primary sees the current phase + day, mood score,
 *               energy level, and predicted next period date. Does
 *               NOT see flow level, individual symptom entries, notes,
 *               or detailed history.
 *
 *  mood         The primary sees ONLY mood score + a "having a tough
 *               day" / "feeling great" signal. No cycle data at all.
 *               Used for friends-of-friends who want a gentle channel
 *               of care without exposure.
 *
 *  connected    The primary sees that the member is active (streak,
 *               last check-in date). NOTHING about cycle, mood, or
 *               symptoms. This is "just connected" — the relationship
 *               exists, but the data is opaque.
 *
 * ─── CARE NUDGES ────────────────────────────────────────────────────
 *
 *  Pre-written supportive messages the primary can send. The pool is
 *  filtered by the receiver's current situation (phase, mood, streak
 *  state) so the primary doesn't have to think about WHAT to send —
 *  Dottie suggests the right warmth for the moment.
 *
 * ─── PHASE SYNC ─────────────────────────────────────────────────────
 *
 *  When two members of the same circle are in the same phase on the
 *  same day, Dottie surfaces a "you're in sync 🤝" indicator on the
 *  dashboard. Magical UX with zero compute cost — it's just a derived
 *  comparison of cached phase values.
 */

import { Phase, HealthCondition, UserMode } from './cycle.types';

// ─── CIRCLE & MEMBERS ────────────────────────────────────────────────

/** A user's Sisterhood Circle (one per primary user) */
export interface SisterhoodCircle {
  id: string;
  /** The primary user who owns this circle */
  primaryUserId: string;
  /** Display name for the circle (e.g., "My Sisters", "The Squad") */
  name: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp of last activity (any member action) */
  lastActivityAt: string;
}

/** Kind of member relationship */
export type MemberKind = 'linked' | 'shadow';

/** Privacy level chosen by (or on behalf of) the member */
export type PrivacyLevel = 'full' | 'summary' | 'mood' | 'connected';

/** A member in the Sisterhood Circle */
export interface SisterhoodMember {
  id: string;
  circleId: string;
  /** Linked member's Dottie user ID, OR null for shadow members */
  linkedUserId: string | null;
  /** Display name shown in the circle UI */
  displayName: string;
  /** Optional emoji shown next to the name (defaults derived per kind) */
  emoji: string;
  /** Relationship label ("Little Sister", "Cousin", "Best Friend", etc.) */
  relationship: string;
  /** Linked vs shadow */
  kind: MemberKind;
  /** Privacy level for what the primary sees */
  privacyLevel: PrivacyLevel;
  /**
   * Shadow profiles store a tiny local health context the primary
   * tracks. Linked members carry null here — their data lives on
   * their own device.
   */
  shadowContext: ShadowContext | null;
  /** ISO timestamp */
  addedAt: string;
  /** ISO timestamp — when the member last had any data activity */
  lastActiveAt: string | null;
}

/**
 * Lightweight health context the primary tracks for a shadow member.
 * Mirrors a subset of the primary's own HealthProfile but is intentionally
 * minimal — shadow profiles are about LOG-ON-BEHALF, not full tracking.
 */
export interface ShadowContext {
  /** Optional age (helps pick age-appropriate tips for the primary to share) */
  age: number | null;
  /** What mode best fits this person */
  mode: UserMode;
  /** Known conditions, if any */
  conditions: HealthCondition[];
  /** Typical cycle length if known (otherwise null) */
  averageCycleLength: number | null;
  /** Last known period start (manual entry) */
  lastPeriodStart: string | null;
  /** Free-text notes the primary keeps for themselves */
  notes: string | null;
}

// ─── MEMBER VIEW (privacy-filtered snapshot) ─────────────────────────

/**
 * What the primary actually SEES for a member, after privacy filtering.
 *
 * The store builds this from the member record + shadow data (or, for
 * linked members in the future, from the synced snapshot). Every field
 * is nullable because privacy levels gate visibility:
 *
 *   FULL       → all fields populated where data exists
 *   SUMMARY    → phase + dayInCycle + mood + energy + nextPeriod
 *   MOOD       → mood + moodSignal only
 *   CONNECTED  → streak + lastActiveAt only
 *
 * UI never makes its own filtering decisions — it just renders what
 * the engine handed it. That keeps the privacy contract auditable in
 * exactly one place: the engine.
 */
export interface MemberView {
  memberId: string;
  displayName: string;
  emoji: string;
  relationship: string;
  kind: MemberKind;
  privacyLevel: PrivacyLevel;
  /** Always populated */
  streak: number | null;
  lastActiveAt: string | null;
  /** Populated for FULL + SUMMARY */
  currentPhase: Phase | null;
  dayInCycle: number | null;
  predictedNextPeriod: string | null;
  /** Populated for FULL + SUMMARY + MOOD */
  moodScore: number | null;
  energyLevel: number | null;
  /** Computed for MOOD level: "tough_day" | "ok" | "great" */
  moodSignal: MoodSignal | null;
  /** Populated for FULL only */
  flowLevel: number | null;
  recentSymptoms: string[];
  /** True when the primary's CURRENT phase equals this member's CURRENT phase */
  inPhaseSync: boolean;
}

/** Lightweight mood signal for the MOOD privacy level */
export type MoodSignal = 'tough_day' | 'ok' | 'great';

// ─── SHADOW PROFILE DATA ─────────────────────────────────────────────

/** A cycle entry logged BY THE PRIMARY for a shadow member */
export interface ShadowCycleEntry {
  id: string;
  memberId: string;
  date: string;
  isPeriodDay: boolean;
  flowLevel: number | null;
  phase: Phase | null;
  createdAt: string;
}

/** A daily check-in logged BY THE PRIMARY for a shadow member */
export interface ShadowCheckIn {
  id: string;
  memberId: string;
  date: string;
  moodScore: number | null;
  energyLevel: number | null;
  notes: string | null;
  createdAt: string;
}

// ─── CARE NUDGES ─────────────────────────────────────────────────────

/** Situational categories that drive nudge selection */
export type CareNudgeSituation =
  | 'period_day'              // Member is on day 1-3 of their period
  | 'low_mood'                // Member logged low mood (score 1-2)
  | 'streak_broken'           // Member's streak was just broken
  | 'phase_sync'              // Primary and member are in same phase
  | 'inactive_3_days'         // Member hasn't checked in for 3+ days
  | 'celebration'             // Member hit a milestone (streak, badge)
  | 'tough_pms'               // Member is in luteal phase with low mood
  | 'general_warmth';         // Default — just-because warmth

/** A pre-written care nudge template */
export interface CareNudgeTemplate {
  id: string;
  situation: CareNudgeSituation;
  /** The message text (Dottie writes warmly so primary doesn't have to) */
  message: string;
  /** Emoji to prefix the nudge with */
  emoji: string;
}

/** A care nudge that's been sent (or queued for delivery) */
export interface CareNudge {
  id: string;
  fromUserId: string;
  toMemberId: string;
  templateId: string;
  /** Snapshot of the message text (templates may change over time) */
  message: string;
  /** Snapshot of the emoji */
  emoji: string;
  /** The situation that triggered this nudge */
  situation: CareNudgeSituation;
  /** ISO timestamp */
  sentAt: string;
  /** Whether the receiver has seen this nudge (linked members only) */
  seenAt: string | null;
}

// ─── PHASE SYNC ──────────────────────────────────────────────────────

/**
 * A detected phase-sync event — when the primary and a member entered
 * the same phase on the same date. Stored so the dashboard can show
 * "in sync since X" subtly without re-detecting on every render.
 */
export interface PhaseSyncEvent {
  id: string;
  primaryUserId: string;
  memberId: string;
  phase: Phase;
  /** ISO date when the sync was detected */
  detectedAt: string;
  /** True once the primary has acknowledged the magic moment */
  acknowledged: boolean;
}

// ─── PROFILE TRANSFER ────────────────────────────────────────────────

/**
 * A one-time code that lets a shadow profile be "claimed" by its
 * subject when they get their own phone.
 *
 * Flow:
 *   1. Primary opens the shadow member → "Hand off to {name}"
 *   2. Repository generates a 6-character human-friendly code + expiry
 *   3. Primary shares the code verbally / via text with the subject
 *   4. Subject installs Dottie, picks "Claim profile" during onboarding,
 *      types the code → their app downloads + claims the shadow data
 *      → primary's app is notified and the shadow profile converts to
 *      a linked member with privacy level the new owner picks
 *
 * For MVP this lives entirely local — the code is shown for verification
 * UX, but the actual cross-device handoff ships with the social plane.
 */
export interface ProfileTransferCode {
  id: string;
  memberId: string;
  /** 6-character human-friendly code (e.g., "BLOOM4") */
  code: string;
  /** ISO timestamp — when this code becomes invalid */
  expiresAt: string;
  /** ISO timestamp — when the code was redeemed (null if still pending) */
  redeemedAt: string | null;
  createdAt: string;
}

// ─── INPUT TYPES ─────────────────────────────────────────────────────

/** What the "add member" flow sends to the store */
export interface AddMemberInput {
  displayName: string;
  emoji?: string;
  relationship: string;
  kind: MemberKind;
  privacyLevel: PrivacyLevel;
  shadowContext?: ShadowContext;
}

/** Patch shape for editing a member's privacy / display fields */
export interface UpdateMemberInput {
  displayName?: string;
  emoji?: string;
  relationship?: string;
  privacyLevel?: PrivacyLevel;
  shadowContext?: Partial<ShadowContext>;
}

/** Input for logging on behalf of a shadow member */
export interface LogShadowPeriodInput {
  memberId: string;
  date: string;
  flowLevel?: number;
}

export interface LogShadowCheckInInput {
  memberId: string;
  date: string;
  moodScore?: number | null;
  energyLevel?: number | null;
  notes?: string | null;
}

/** Input for sending a care nudge */
export interface SendCareNudgeInput {
  memberId: string;
  templateId: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** Default circle name shown until the user renames it */
export const DEFAULT_CIRCLE_NAME = 'My Sisterhood';

/** Max members per circle in MVP (gentle soft cap — UI nudges to upgrade later) */
export const MAX_FREE_MEMBERS = 1;
export const MAX_PREMIUM_MEMBERS = 5;
export const MAX_FAMILY_MEMBERS = 10;

/** Transfer code length (6 chars = 36^6 ≈ 2 billion combinations) */
export const TRANSFER_CODE_LENGTH = 6;
/** Transfer code lifespan (24 hours) */
export const TRANSFER_CODE_TTL_HOURS = 24;

/** How long to consider a member "active" for the connected-only view */
export const ACTIVITY_FRESH_DAYS = 7;

// ─── EMOJI DEFAULTS (per kind) ───────────────────────────────────────

/** Default emoji to show when the primary doesn't pick one */
export function defaultMemberEmoji(kind: MemberKind): string {
  return kind === 'shadow' ? '🌸' : '💛';
}

// ─── MOOD SIGNAL DERIVATION ──────────────────────────────────────────

/**
 * Derive the 3-bucket mood signal from a 1-5 score.
 * Used by the MOOD privacy level so the primary sees "tough day" / "ok" /
 * "great" without seeing the exact numeric score.
 */
export function deriveMoodSignal(score: number | null): MoodSignal | null {
  if (score === null || score === undefined) return null;
  if (score <= 2) return 'tough_day';
  if (score <= 3) return 'ok';
  return 'great';
}