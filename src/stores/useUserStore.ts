/**
 * Dottie — User Store
 *
 * Holds the local user identity, mode, health profile, and companion
 * configuration. Backed by `users` + `companion_state` tables.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Synchronous READS via Zustand selectors (zero await for the UI)
 *  - ASYNC writes (actions) that mirror to SQLite + update store state
 *  - Single instance per app (Dottie is single-user on device)
 *  - Onboarding builds up MMKV's onboarding draft, then calls
 *    `completeOnboarding()` here which writes the durable user row
 *
 * ─── ONBOARDING FLOW ────────────────────────────────────────────────
 *
 *  Onboarding screens write into Storage.onboardingDraft (MMKV) as the
 *  user fills out each step. When the user taps "Done" on the final
 *  ready screen, we call `useUserStore.getState().completeOnboarding()`
 *  which:
 *    1. Reads the draft from MMKV
 *    2. Creates the SQLite user row
 *    3. Creates the companion_state row
 *    4. Initializes the gamification state
 *    5. Clears the draft
 *    6. Sets MMKV's hasOnboarded flag
 *    7. Mirrors currentUserId into MMKV
 *    8. Populates this store
 *
 *  Other stores (cycle, gamification, content) read the new userId via
 *  selectors and reactively load their state.
 */

import { create } from 'zustand';
import { Storage, OnboardingDraft } from '../database/storage';
import {
  userRepository,
  UserRecord,
} from '../database/repositories/user.repo';
import { gamificationRepository } from '../database/repositories/gamification.repo';
import {
  HealthCondition,
  HealthProfile,
  UserMode,
} from '../types/cycle.types';
import {
  CompanionType,
  CompanionConfig,
  OutfitSlot,
} from '../types/companion.types';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface UserStoreState {
  /** The active user's ID. Null until onboarding completes. */
  userId: string | null;
  /** Full user record. Null until loaded from DB. */
  user: UserRecord | null;
  /** Companion configuration. Null until onboarding completes. */
  companionConfig: CompanionConfig | null;
  /** True once initial DB load has completed. */
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Finalize onboarding — create the user, companion, and gamification
   * rows in SQLite, then mirror critical fields into MMKV.
   */
  completeOnboarding: () => Promise<UserRecord>;

  /** Update the user's mode (e.g., switching from Teen to Adult). */
  updateMode: (mode: UserMode) => Promise<void>;

  /** Patch the health profile fields. */
  updateHealthProfile: (patch: Partial<HealthProfile>) => Promise<void>;

  /** Add or remove a health condition. */
  toggleCondition: (condition: HealthCondition) => Promise<void>;

  /** Change which spirit companion the user has chosen. */
  setCompanion: (type: CompanionType) => Promise<void>;

  /** Equip an outfit in a slot (pass null to unequip). */
  equipOutfit: (slot: OutfitSlot, outfitId: string | null) => Promise<void>;

  /** Add an outfit to the user's unlocked list (called by gem store). */
  unlockOutfit: (outfitId: string) => Promise<void>;

  /** Update the display name. */
  setDisplayName: (name: string | null) => Promise<void>;

  /**
   * Nuclear: delete the user's row and ALL their data, clear MMKV.
   * Used by the "delete my account" privacy action.
   *
   * Also resets every other store (cycle, gamification, content,
   * community, sisterhood) so we don't leave stale data hanging
   * around in memory after deletion. New onboarding starts truly
   * fresh.
   */
  deleteAccount: () => Promise<void>;

  /**
   * Reload the user + companion from the DB (used after major mutations
   * triggered outside this store, like a Sisterhood data import).
   */
  refresh: () => Promise<void>;
}

// ─── STORE ──────────────────────────────────────────────────────────

export const useUserStore = create<UserStoreState>((set, get) => ({
  // Starts null and is populated by hydrateAppState() (populateStoresForUser
  // → setState({ userId })). It must NOT read Storage here: this initializer
  // runs at module import, before initEncryptedStorage() has unlocked MMKV
  // with the hardware key (B2). Reading Storage now would throw.
  userId: null,
  user: null,
  companionConfig: null,
  hydrated: false,

  // ─── completeOnboarding ─────────────────────────────────────────

  completeOnboarding: async () => {
    const draft = (Storage.onboardingDraft.get<OnboardingDraft>() ?? {}) as OnboardingDraft;

    // Defensive defaults — onboarding UI SHOULD set these but we don't
    // want to crash if a screen forgot.
    const mode: UserMode = draft.mode ?? 'adult';
    const companionType: CompanionType = draft.companionType ?? 'blossom';

    // Convert health conditions safely
    const conditions = (draft.healthConditions ?? []) as HealthCondition[];

    // Create the user row
    const user = await userRepository.createUser({
      mode,
      age: draft.age ?? null,
      healthConditions: conditions,
      averageCycleLength: draft.averageCycleLength ?? null,
      averagePeriodLength: draft.averagePeriodLength ?? null,
    });

    // Companion + gamification state
    const companion = await userRepository.setCompanionType(user.id, companionType);
    await gamificationRepository.initializeState(user.id);

    // If they entered a last period start, seed the cycle entries with it.
    // We import lazily to avoid pulling cycleRepository into the user store
    // dependency graph (it's only needed for this specific path).
    if (draft.lastPeriodStart) {
      try {
        const { cycleRepository } = await import('../database/repositories/cycle.repo');
        await cycleRepository.logPeriodDay({
          userId: user.id,
          date: draft.lastPeriodStart,
          flowLevel: 3,
        });
      } catch (err) {
        logSilentFailure('onboarding:seedPeriodFailed', err);
      }
    }

    // Mirror into MMKV
    Storage.currentUserId.set(user.id);
    Storage.companionType.set(companionType);
    Storage.hasOnboarded.set(true);
    Storage.onboardedAt.set(new Date().toISOString());

    // If the onboarding funnel captured a reminder-prefs choice, persist it
    // and kick off the scheduler so notifications start firing without a
    // second trip to Profile → Reminders. Errors here are non-fatal — the
    // user can always toggle reminders from Profile later.
    if (draft.reminderPrefs) {
      try {
        Storage.reminderPrefs.set({ ...draft.reminderPrefs });
        // Dynamic import — the scheduler pulls in expo-notifications, which
        // we don't want to load during the general user-store path.
        const { syncAllReminders } = await import('../notifications/scheduler');
        await syncAllReminders({
          discrete: Storage.discreteNotifications.get() ?? false,
          predictedNextPeriod: null, // first-run: no prediction yet
        });
      } catch (err) {
        logSilentFailure('onboarding:reminderSyncFailed', err);
      }
    }

    Storage.onboardingDraft.clear();

    // Populate store
    set({
      userId: user.id,
      user,
      companionConfig: companion,
      hydrated: true,
    });

    return user;
  },

  // ─── updateMode ─────────────────────────────────────────────────

  updateMode: async (mode) => {
    const userId = get().userId;
    if (!userId) return;
    const updated = await userRepository.updateUser(userId, { mode });
    if (updated) set({ user: updated });
  },

  // ─── updateHealthProfile ────────────────────────────────────────

  updateHealthProfile: async (patch) => {
    const userId = get().userId;
    if (!userId) return;

    const updated = await userRepository.updateUser(userId, {
      age: patch.age,
      weightKg: patch.weightKg,
      heightCm: patch.heightCm,
      activityLevel: patch.activityLevel,
      healthConditions: patch.conditions,
      averageCycleLength: patch.averageCycleLength,
      averagePeriodLength: patch.averagePeriodLength,
      onMedications: patch.onMedications,
    });
    if (updated) set({ user: updated });
  },

  // ─── toggleCondition ────────────────────────────────────────────

  toggleCondition: async (condition) => {
    const user = get().user;
    if (!user) return;

    const current = new Set(user.healthProfile.conditions);
    if (current.has(condition)) {
      current.delete(condition);
    } else {
      current.add(condition);
    }
    await get().updateHealthProfile({ conditions: Array.from(current) });
  },

  // ─── setCompanion ───────────────────────────────────────────────

  setCompanion: async (type) => {
    const userId = get().userId;
    if (!userId) return;
    const companion = await userRepository.setCompanionType(userId, type);
    Storage.companionType.set(type);
    set({ companionConfig: companion });
  },

  // ─── equipOutfit ────────────────────────────────────────────────

  equipOutfit: async (slot, outfitId) => {
    const userId = get().userId;
    if (!userId) return;
    const companion = await userRepository.equipOutfit(userId, slot, outfitId);
    if (companion) set({ companionConfig: companion });
  },

  // ─── unlockOutfit ───────────────────────────────────────────────

  unlockOutfit: async (outfitId) => {
    const userId = get().userId;
    if (!userId) return;
    const companion = await userRepository.unlockOutfit(userId, outfitId);
    if (companion) set({ companionConfig: companion });
  },

  // ─── setDisplayName ─────────────────────────────────────────────

  setDisplayName: async (name) => {
    const userId = get().userId;
    if (!userId) return;
    const updated = await userRepository.updateUser(userId, { displayName: name });
    if (updated) set({ user: updated });
  },

  // ─── deleteAccount ──────────────────────────────────────────────

  deleteAccount: async () => {
    const userId = get().userId;
    if (userId) {
      await userRepository.deleteUser(userId);
    }
    Storage.clearAll();

    // Reset all stores — import lazily to avoid circular dependency.
    // Sisterhood store joined this list in Chunk 8 so cached members
    // and care nudges don't survive into a fresh onboarding.
    set({ userId: null, user: null, companionConfig: null });

    const { useCycleStore } = await import('./useCycleStore');
    const { useGamificationStore } = await import('./useGamificationStore');
    const { useContentStore } = await import('./useContentStore');
    const { useCommunityStore } = await import('./useCommunityStore');
    const { useSisterhoodStore } = await import('./useSisterhoodStore');

    useCycleStore.getState().reset();
    useGamificationStore.getState().reset();
    useContentStore.getState().reset();
    useCommunityStore.getState().reset();
    useSisterhoodStore.getState().reset();
  },

  // ─── refresh ────────────────────────────────────────────────────

  refresh: async () => {
    const userId = get().userId;
    if (!userId) return;
    const [user, companion] = await Promise.all([
      userRepository.getUser(userId),
      userRepository.getCompanionConfig(userId),
    ]);
    set({ user, companionConfig: companion });
  },
}));

// ─── SELECTORS (pure read access for components) ─────────────────────

/**
 * Selectors avoid unnecessary re-renders by extracting only the slice
 * a component cares about. Always prefer a selector over `useUserStore()`
 * in components.
 *
 *   const userId = useUserStore(selectUserId);
 */

export const selectUserId = (s: UserStoreState): string | null => s.userId;

export const selectUserMode = (s: UserStoreState): UserMode =>
  s.user?.mode ?? 'adult';

export const selectCompanionType = (s: UserStoreState): CompanionType =>
  s.companionConfig?.type ?? 'blossom';

export const selectHealthProfile = (s: UserStoreState): HealthProfile | null =>
  s.user?.healthProfile ?? null;

export const selectIsOnboarded = (s: UserStoreState): boolean =>
  s.hydrated && s.userId !== null;