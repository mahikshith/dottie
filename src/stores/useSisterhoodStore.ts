/**
 * Dottie — Sisterhood Store
 *
 * The orchestration layer for the Sisterhood Circle. Wraps the
 * sisterhood repository with:
 *
 *   - In-memory caches of circle + members (instant tab switches)
 *   - Async actions for every mutation (add/remove member, log shadow
 *     data, send nudge, generate transfer code)
 *   - Selectors for UI components (one-shot reads with minimal
 *     re-renders)
 *
 * The store is intentionally separate from useCycleStore — the
 * primary's own cycle data and the Sisterhood plane are logically
 * different concerns, and entangling them would make either one
 * harder to evolve.
 *
 * ─── PRIVACY DISCIPLINE ─────────────────────────────────────────────
 *
 *  The store ONLY calls buildMemberView() from the engine to project
 *  raw data into what the UI sees. UI components MUST consume
 *  MemberView objects, never raw member + shadow data, so the privacy
 *  contract is enforced in one place. Linting rule (future): forbid
 *  importing sisterhood.repo from UI files.
 */

import { create } from 'zustand';
import {
  sisterhoodRepository,
} from '../database/repositories/sisterhood.repo';
import {
  SisterhoodCircle,
  SisterhoodMember,
  MemberView,
  AddMemberInput,
  UpdateMemberInput,
  LogShadowPeriodInput,
  LogShadowCheckInInput,
  SendCareNudgeInput,
  CareNudge,
  PhaseSyncEvent,
  ProfileTransferCode,
  CareNudgeSituation,
} from '../types/sisterhood.types';
import {
  buildMemberView,
  deriveShadowPhase,
  detectPhaseSync,
  pickCareNudgeSituation,
  generateTransferCode,
} from '../engine/sisterhood';
import { getNudgeTemplate, pickNudges } from '../content/care-nudges';
import { Phase } from '../types/cycle.types';
import { CareNudgeTemplate } from '../types/sisterhood.types';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface SisterhoodStoreState {
  /** The active user's circle, null until loaded */
  circle: SisterhoodCircle | null;
  /** Raw member records keyed by ID for O(1) lookup */
  membersById: Record<string, SisterhoodMember>;
  /** Member IDs in display order (oldest first) */
  memberOrder: string[];
  /** Cached privacy-filtered views, keyed by member ID */
  viewsById: Record<string, MemberView>;
  /** Care nudges sent — keyed by member ID, recent-first */
  nudgesByMember: Record<string, CareNudge[]>;
  /** Unacknowledged phase-sync events */
  pendingPhaseSyncs: PhaseSyncEvent[];
  /** True while initial circle + members load is in flight */
  isLoading: boolean;
  /** Last refresh timestamp (for cache-staleness checks) */
  lastRefreshedAt: number | null;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Load (or refresh) the user's circle and members. Idempotent.
   * Re-derives all MemberViews using the primary's current phase
   * for phase-sync detection.
   */
  refresh: (primaryUserId: string, primaryCurrentPhase: Phase | null) => Promise<void>;

  /** Reset to empty state (called by account deletion). */
  reset: () => void;

  /** Add a new member to the circle. */
  addMember: (
    primaryUserId: string,
    primaryCurrentPhase: Phase | null,
    input: AddMemberInput
  ) => Promise<SisterhoodMember>;

  /** Update a member's display info or privacy level. */
  updateMember: (
    memberId: string,
    primaryCurrentPhase: Phase | null,
    patch: UpdateMemberInput
  ) => Promise<void>;

  /** Remove a member from the circle. */
  removeMember: (memberId: string) => Promise<void>;

  /** Rename the circle. */
  renameCircle: (newName: string) => Promise<void>;

  /** Log a period day on behalf of a shadow member, then refresh the view. */
  logShadowPeriod: (
    primaryCurrentPhase: Phase | null,
    input: LogShadowPeriodInput
  ) => Promise<void>;

  /** Un-mark a shadow member's period day, then refresh her view. */
  unlogShadowPeriod: (
    primaryCurrentPhase: Phase | null,
    input: { memberId: string; date: string }
  ) => Promise<void>;

  /** Log a mood/energy check-in on behalf of a shadow member. */
  logShadowCheckIn: (
    primaryCurrentPhase: Phase | null,
    input: LogShadowCheckInInput
  ) => Promise<void>;

  /**
   * Send a care nudge. Caller passes templateId (looked up from
   * content/care-nudges). The store snapshots the message/emoji
   * so future template edits don't rewrite history.
   */
  sendCareNudge: (
    fromUserId: string,
    input: SendCareNudgeInput
  ) => Promise<{ ok: true; nudge: CareNudge } | { ok: false; message: string }>;

  /**
   * Suggest care nudges to show the primary for a member.
   * Pure read — no I/O.
   */
  suggestNudgesForMember: (
    memberId: string
  ) => { situation: CareNudgeSituation; templates: CareNudgeTemplate[] };

  /** Issue a new transfer code for a shadow member. */
  issueTransferCode: (memberId: string) => Promise<ProfileTransferCode>;

  /** Mark a phase-sync event as acknowledged (primary tapped the magic indicator). */
  acknowledgePhaseSync: (eventId: string) => Promise<void>;
}

// ─── STORE ──────────────────────────────────────────────────────────

export const useSisterhoodStore = create<SisterhoodStoreState>((set, get) => ({
  circle: null,
  membersById: {},
  memberOrder: [],
  viewsById: {},
  nudgesByMember: {},
  pendingPhaseSyncs: [],
  isLoading: false,
  lastRefreshedAt: null,

  // ─── refresh ────────────────────────────────────────────────────

  refresh: async (primaryUserId, primaryCurrentPhase) => {
    if (!primaryUserId) return;
    set({ isLoading: true });

    try {
      const circle = await sisterhoodRepository.getOrCreateCircle(primaryUserId);
      const members = await sisterhoodRepository.listMembers(circle.id);

      const membersById: Record<string, SisterhoodMember> = {};
      const memberOrder: string[] = [];
      const viewsById: Record<string, MemberView> = {};

      // Build views for each member. For shadow members we pull their
      // cycle entries + latest check-in to compute phase/mood. Linked
      // members are stubbed for now — the future sync layer will fill
      // their data via repository pulls.
      for (const member of members) {
        membersById[member.id] = member;
        memberOrder.push(member.id);

        const view = await buildViewForMember(member, primaryCurrentPhase);
        viewsById[member.id] = view;

        // Record phase-sync events as we discover them (idempotent at DB level)
        if (view.inPhaseSync && view.currentPhase) {
          await sisterhoodRepository.recordPhaseSync(
            primaryUserId,
            member.id,
            view.currentPhase,
            todayISO()
          );
        }
      }

      const pending = await sisterhoodRepository.getUnacknowledgedPhaseSyncs(primaryUserId);

      set({
        circle,
        membersById,
        memberOrder,
        viewsById,
        pendingPhaseSyncs: pending,
        isLoading: false,
        lastRefreshedAt: Date.now(),
      });
    } catch (err) {
      logSilentFailure('sisterhood:refreshFailed', err);
      set({ isLoading: false });
    }
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set({
      circle: null,
      membersById: {},
      memberOrder: [],
      viewsById: {},
      nudgesByMember: {},
      pendingPhaseSyncs: [],
      isLoading: false,
      lastRefreshedAt: null,
    });
  },

  // ─── addMember ──────────────────────────────────────────────────

  addMember: async (primaryUserId, primaryCurrentPhase, input) => {
    const circle = await sisterhoodRepository.getOrCreateCircle(primaryUserId);
    const member = await sisterhoodRepository.addMember(circle.id, input);

    const view = await buildViewForMember(member, primaryCurrentPhase);

    set(state => ({
      circle,
      membersById: { ...state.membersById, [member.id]: member },
      memberOrder: [...state.memberOrder, member.id],
      viewsById: { ...state.viewsById, [member.id]: view },
    }));

    return member;
  },

  // ─── updateMember ───────────────────────────────────────────────

  updateMember: async (memberId, primaryCurrentPhase, patch) => {
    const updated = await sisterhoodRepository.updateMember(memberId, patch);
    if (!updated) return;

    const view = await buildViewForMember(updated, primaryCurrentPhase);

    set(state => ({
      membersById: { ...state.membersById, [memberId]: updated },
      viewsById: { ...state.viewsById, [memberId]: view },
    }));
  },

  // ─── removeMember ───────────────────────────────────────────────

  removeMember: async (memberId) => {
    await sisterhoodRepository.removeMember(memberId);

    set(state => {
      const { [memberId]: _removedMember, ...remainingMembers } = state.membersById;
      const { [memberId]: _removedView, ...remainingViews } = state.viewsById;
      const { [memberId]: _removedNudges, ...remainingNudges } = state.nudgesByMember;
      return {
        membersById: remainingMembers,
        viewsById: remainingViews,
        nudgesByMember: remainingNudges,
        memberOrder: state.memberOrder.filter(id => id !== memberId),
      };
    });
  },

  // ─── renameCircle ───────────────────────────────────────────────

  renameCircle: async (newName) => {
    const circle = get().circle;
    if (!circle) return;
    await sisterhoodRepository.renameCircle(circle.id, newName);
    set({ circle: { ...circle, name: newName } });
  },

  // ─── logShadowPeriod ────────────────────────────────────────────

  logShadowPeriod: async (primaryCurrentPhase, input) => {
    await sisterhoodRepository.logShadowPeriodDay(input);
    await rebuildMemberView(input.memberId, primaryCurrentPhase, set);
  },

  // ─── unlogShadowPeriod ──────────────────────────────────────────

  unlogShadowPeriod: async (primaryCurrentPhase, input) => {
    await sisterhoodRepository.unlogShadowPeriodDay(input.memberId, input.date);
    // Same view rebuild as logging — removing a day can move her predicted
    // date and her day-in-cycle, so the card must not keep the old numbers.
    await rebuildMemberView(input.memberId, primaryCurrentPhase, set);
  },

  // ─── logShadowCheckIn ───────────────────────────────────────────

  logShadowCheckIn: async (primaryCurrentPhase, input) => {
    await sisterhoodRepository.logShadowCheckIn(input);
    await rebuildMemberView(input.memberId, primaryCurrentPhase, set);
  },

  // ─── sendCareNudge ──────────────────────────────────────────────

  sendCareNudge: async (fromUserId, input) => {
    const template = getNudgeTemplate(input.templateId);
    if (!template) {
      return { ok: false, message: 'That care nudge is no longer available.' };
    }

    const nudge = await sisterhoodRepository.saveCareNudge(
      fromUserId,
      input.memberId,
      template.id,
      template.message,
      template.emoji,
      template.situation
    );

    set(state => {
      const existing = state.nudgesByMember[input.memberId] ?? [];
      return {
        nudgesByMember: {
          ...state.nudgesByMember,
          [input.memberId]: [nudge, ...existing].slice(0, 20),
        },
      };
    });

    return { ok: true, nudge };
  },

  // ─── suggestNudgesForMember ─────────────────────────────────────

  suggestNudgesForMember: (memberId) => {
    const view = get().viewsById[memberId];
    if (!view) {
      return {
        situation: 'general_warmth' as CareNudgeSituation,
        templates: pickNudges('general_warmth', memberId, 3),
      };
    }
    const situation = pickCareNudgeSituation(view);
    const templates = pickNudges(situation, memberId, 3);
    return { situation, templates };
  },

  // ─── issueTransferCode ──────────────────────────────────────────

  issueTransferCode: async (memberId) => {
    const { code, expiresAt } = generateTransferCode();
    return sisterhoodRepository.issueTransferCode(memberId, code, expiresAt);
  },

  // ─── acknowledgePhaseSync ───────────────────────────────────────

  acknowledgePhaseSync: async (eventId) => {
    await sisterhoodRepository.acknowledgePhaseSync(eventId);
    set(state => ({
      pendingPhaseSyncs: state.pendingPhaseSyncs.filter(e => e.id !== eventId),
    }));
  },
}));

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

/**
 * Build a MemberView for a member by pulling whatever shadow data
 * exists (or, for linked members, returning a stub until sync ships).
 */
async function buildViewForMember(
  member: SisterhoodMember,
  primaryCurrentPhase: Phase | null
): Promise<MemberView> {
  // Linked members: stub for MVP (future: pull from synced snapshot)
  if (member.kind === 'linked') {
    return buildMemberView({
      member,
      inPhaseSync: false,
      currentPhase: null,
      dayInCycle: null,
      predictedNextPeriod: null,
      moodScore: null,
      energyLevel: null,
      flowLevel: null,
      recentSymptoms: [],
      streak: null,
    });
  }

  // Shadow members: derive everything from local tables
  const [cycleEntries, latestCheckIn] = await Promise.all([
    sisterhoodRepository.getShadowCycleEntries(member.id, 90),
    sisterhoodRepository.getShadowLatestCheckIn(member.id),
  ]);

  const { currentPhase, dayInCycle, predictedNextPeriod } = deriveShadowPhase(
    member.shadowContext,
    cycleEntries
  );

  // Today's flow if it's a period day
  const today = todayISO();
  const todayEntry = cycleEntries.find(e => e.date === today);
  const flowLevel = todayEntry?.isPeriodDay ? todayEntry.flowLevel : null;

  return buildMemberView({
    member,
    inPhaseSync: detectPhaseSync(primaryCurrentPhase, currentPhase),
    currentPhase,
    dayInCycle,
    predictedNextPeriod,
    moodScore: latestCheckIn?.moodScore ?? null,
    energyLevel: latestCheckIn?.energyLevel ?? null,
    flowLevel,
    recentSymptoms: [],
    streak: null,
  });
}

/**
 * Re-derive a single member's view after a data mutation, leaving
 * other members untouched.
 */
async function rebuildMemberView(
  memberId: string,
  primaryCurrentPhase: Phase | null,
  set: (
    partial:
      | Partial<SisterhoodStoreState>
      | ((state: SisterhoodStoreState) => Partial<SisterhoodStoreState>)
  ) => void
): Promise<void> {
  const member = await sisterhoodRepository.getMember(memberId);
  if (!member) return;

  const view = await buildViewForMember(member, primaryCurrentPhase);

  set(state => ({
    membersById: { ...state.membersById, [memberId]: member },
    viewsById: { ...state.viewsById, [memberId]: view },
  }));
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectCircle = (s: SisterhoodStoreState) => s.circle;

export const selectMemberCount = (s: SisterhoodStoreState) =>
  s.memberOrder.length;

// Zustand v5 subscribes via useSyncExternalStore, which requires the selector
// to return referentially-stable snapshots. `.map(...).filter(...)` produces
// a fresh array on every call → React thinks the snapshot changed each render
// → "Maximum update depth exceeded". Cache per input-triple so callers see a
// stable reference until the underlying maps or order actually change.
let _mOrder: string[] | null = null;
let _mById: Record<string, SisterhoodMember> | null = null;
let _mCache: SisterhoodMember[] = [];
export const selectMembersOrdered = (s: SisterhoodStoreState): SisterhoodMember[] => {
  if (s.memberOrder !== _mOrder || s.membersById !== _mById) {
    _mOrder = s.memberOrder;
    _mById = s.membersById;
    _mCache = s.memberOrder
      .map(id => s.membersById[id])
      .filter(Boolean) as SisterhoodMember[];
  }
  return _mCache;
};

let _vOrder: string[] | null = null;
let _vById: Record<string, MemberView> | null = null;
let _vCache: MemberView[] = [];
export const selectMemberViewsOrdered = (s: SisterhoodStoreState): MemberView[] => {
  if (s.memberOrder !== _vOrder || s.viewsById !== _vById) {
    _vOrder = s.memberOrder;
    _vById = s.viewsById;
    _vCache = s.memberOrder
      .map(id => s.viewsById[id])
      .filter(Boolean) as MemberView[];
  }
  return _vCache;
};

export const selectMemberById =
  (memberId: string) =>
  (s: SisterhoodStoreState): SisterhoodMember | null =>
    s.membersById[memberId] ?? null;

export const selectMemberViewById =
  (memberId: string) =>
  (s: SisterhoodStoreState): MemberView | null =>
    s.viewsById[memberId] ?? null;

// Stable empty fallback (see note in useCommunityStore — a fresh [] per render
// loops Zustand into "Maximum update depth exceeded").
const EMPTY_NUDGES: CareNudge[] = [];

export const selectNudgesForMember =
  (memberId: string) =>
  (s: SisterhoodStoreState): CareNudge[] =>
    s.nudgesByMember[memberId] ?? EMPTY_NUDGES;

export const selectPendingPhaseSyncs = (s: SisterhoodStoreState) =>
  s.pendingPhaseSyncs;

export const selectIsLoadingSisterhood = (s: SisterhoodStoreState) =>
  s.isLoading;

export const selectHasAnyMembers = (s: SisterhoodStoreState) =>
  s.memberOrder.length > 0;