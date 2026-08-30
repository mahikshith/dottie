/**
 * Dottie — Gamification Store
 *
 * Holds streak, XP, gems, level, and badge state. Wires the pure
 * gamification engines (streak, xp, gems) to the repository so screens
 * can call simple actions and get persistence + state updates for free.
 *
 * ─── HOW ACTIONS WORK ───────────────────────────────────────────────
 *
 *  1. Screen calls e.g. `recordCheckIn(date)`
 *  2. Store reads current streak state
 *  3. Store calls pure `processCheckIn(state, date)` from the engine
 *  4. Store persists the result via `gamificationRepository.applyStreakResult`
 *  5. Store updates its own state with the new values
 *  6. UI re-renders via selectors
 *
 *  Engines stay pure. Repo handles persistence. Store coordinates.
 *
 * ─── XP/GEM AWARDING ────────────────────────────────────────────────
 *
 *  The check-in action awards BOTH XP and gems automatically using the
 *  engine's rate tables. Lesson and quiz completions also call here
 *  via dedicated actions.
 *
 *  Each award returns metadata (leveledUp, milestone) so the screen
 *  can trigger appropriate celebration animations.
 */

import { create } from 'zustand';
import {
  StreakState,
  XPSource,
  GemSource,
} from '../types/gamification.types';
import {
  gamificationRepository,
  XpMutationInput,
  GemMutationInput,
} from '../database/repositories/gamification.repo';
import {
  processCheckIn,
  useCrampFreeze as engineUseCrampFreeze,
  purchaseCrampFreeze as enginePurchaseCrampFreeze,
  createInitialStreakState,
} from '../engine/gamification/streak';
import {
  awardXP as engineAwardXP,
  getLevelProgress,
  XP_RATES,
  LevelProgress,
} from '../engine/gamification/xp';
import {
  earnGems as engineEarnGems,
  spendGems as engineSpendGems,
  GEM_EARN_RATES,
  GEM_BONUSES,
  GemStoreItem,
} from '../engine/gamification/gems';
import { useUserStore } from './useUserStore';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface GamificationStoreState {
  streak: StreakState;
  xpTotal: number;
  currentLevel: number;
  gemsBalance: number;
  badgesEarned: string[];
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Process a daily check-in — increments streak, awards XP/gems if
   * milestone hit. Returns metadata for celebration UI.
   */
  recordCheckIn: (today?: string) => Promise<CheckInResult>;

  /**
   * Award XP from any source. Auto-bumps level if threshold crossed.
   */
  awardXp: (source: XPSource, options?: AwardXpOptions) => Promise<AwardXpResult>;

  /**
   * Earn gems from any source. Returns the new balance.
   */
  earnGems: (
    source: GemSource,
    bonusType?: keyof typeof GEM_BONUSES
  ) => Promise<EarnGemsResult>;

  /**
   * Spend gems on a gem-store item. Returns SpendResult so the UI can
   * differentiate between "purchased", "already owned", "not enough".
   */
  spendGemsOnItem: (
    itemId: string,
    ownedItemIds: string[]
  ) => Promise<SpendResult>;

  /**
   * Activate a Cramp Freeze on today (free if available, otherwise UI
   * should redirect to gem purchase first).
   */
  useCrampFreeze: (today?: string) => Promise<CrampFreezeResult>;

  /**
   * Purchase a Cramp Freeze with gems.
   */
  purchaseCrampFreeze: () => Promise<CrampFreezeResult>;

  /**
   * Unlock a badge. Idempotent — re-unlocking returns success=false.
   */
  unlockBadge: (
    badgeId: string,
    metadata?: Record<string, unknown>
  ) => Promise<boolean>;

  /** Reload all gamification data from SQLite. */
  refresh: () => Promise<void>;

  /** Reset state (called by user.deleteAccount()). */
  reset: () => void;
}

// ─── RESULT TYPES ────────────────────────────────────────────────────

export interface CheckInResult {
  streakIncremented: boolean;
  streakBroken: boolean;
  milestone: number | null;
  newStreakCount: number;
  xpAwarded: number;
  gemsAwarded: number;
  leveledUp: boolean;
  newLevel: number;
  message: string;
}

export interface AwardXpOptions {
  /** Override the default rate (for streak-milestone XP, etc.) */
  overrideAmount?: number;
}

export interface AwardXpResult {
  xpAwarded: number;
  newTotal: number;
  leveledUp: boolean;
  newLevel: number;
}

export interface EarnGemsResult {
  gemsAwarded: number;
  newBalance: number;
}

export interface SpendResult {
  success: boolean;
  reason: 'purchased' | 'already_owned' | 'insufficient_gems' | 'unknown_item';
  newBalance: number;
  message: string;
  item: GemStoreItem | null;
}

export interface CrampFreezeResult {
  success: boolean;
  message: string;
  gemsNeeded: number | null;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  streak: createInitialStreakState(),
  xpTotal: 0,
  currentLevel: 1,
  gemsBalance: 0,
  badgesEarned: [] as string[],
  hydrated: false,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useGamificationStore = create<GamificationStoreState>((set, get) => ({
  ...initialState,

  // ─── recordCheckIn ──────────────────────────────────────────────

  recordCheckIn: async (today) => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      return emptyCheckInResult();
    }

    const date = today ?? new Date().toISOString().split('T')[0]!;
    const { streak } = get();

    // 1. Run the pure streak engine
    const streakResult = processCheckIn(streak, date);

    // 2. Persist the streak update + milestone rewards atomically
    const newState = await gamificationRepository.applyStreakResult(userId, {
      state: streakResult.state,
      rewards: streakResult.rewards,
      milestone: streakResult.milestone,
    });

    // 3. Award the base daily_checkin XP separately (engine doesn't
    // do this — it only handles streak rewards). Use awardXp action
    // so level recomputes happen in one place.
    let baseXp = 0;
    let baseLeveledUp = false;
    let baseNewLevel = newState?.currentLevel ?? get().currentLevel;
    if (streakResult.streakIncremented) {
      const xpResult = await get().awardXp('daily_checkin');
      baseXp = xpResult.xpAwarded;
      baseLeveledUp = xpResult.leveledUp;
      baseNewLevel = xpResult.newLevel;
    }

    // Also award the base daily_checkin gem drip
    let baseGems = 0;
    if (streakResult.streakIncremented) {
      const gemResult = await get().earnGems('daily_checkin');
      baseGems = gemResult.gemsAwarded;
    }

    // Refresh state from DB (in case awardXp/earnGems mutated)
    const finalState = await gamificationRepository.getState(userId);
    if (finalState) {
      set({
        streak: finalState.streak,
        xpTotal: finalState.xpTotal,
        currentLevel: finalState.currentLevel,
        gemsBalance: finalState.gemsBalance,
        badgesEarned: finalState.badgesEarned,
      });
    }

    // Combine the rewards from streak milestone + base check-in
    const totalXp = (streakResult.rewards?.xp ?? 0) + baseXp;
    const totalGems = (streakResult.rewards?.gems ?? 0) + baseGems;

    return {
      streakIncremented: streakResult.streakIncremented,
      streakBroken: streakResult.streakBroken,
      milestone: streakResult.milestone,
      newStreakCount: streakResult.state.currentStreak,
      xpAwarded: totalXp,
      gemsAwarded: totalGems,
      leveledUp: baseLeveledUp,
      newLevel: baseNewLevel,
      message: streakResult.message,
    };
  },

  // ─── awardXp ────────────────────────────────────────────────────

  awardXp: async (source, options) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return { xpAwarded: 0, newTotal: get().xpTotal, leveledUp: false, newLevel: get().currentLevel };

    const amount = options?.overrideAmount ?? XP_RATES[source] ?? 0;
    if (amount <= 0) {
      return { xpAwarded: 0, newTotal: get().xpTotal, leveledUp: false, newLevel: get().currentLevel };
    }

    const mutation: XpMutationInput = { amount, source };
    const result = await gamificationRepository.awardXp(userId, mutation);

    set({
      xpTotal: result.newTotal,
      currentLevel: result.newLevel,
    });

    // Touch engine function to keep dependency explicit
    void engineAwardXP;

    return {
      xpAwarded: amount,
      newTotal: result.newTotal,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
    };
  },

  // ─── earnGems ───────────────────────────────────────────────────

  earnGems: async (source, bonusType) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return { gemsAwarded: 0, newBalance: get().gemsBalance };

    // Use the pure engine to compute amounts (handles bonus stacking)
    const engineResult = engineEarnGems(source, get().gemsBalance, bonusType);
    if (!engineResult.success || engineResult.amountEarned === 0) {
      return { gemsAwarded: 0, newBalance: get().gemsBalance };
    }

    const mutation: GemMutationInput = {
      amount: engineResult.amountEarned,
      source,
      description: engineResult.transaction?.description ?? `Earned from ${source}`,
    };

    const newBalance = await gamificationRepository.applyGemMutation(userId, mutation);
    set({ gemsBalance: newBalance });

    // Touch base rate to keep dependency graph visible
    void GEM_EARN_RATES;

    return {
      gemsAwarded: engineResult.amountEarned,
      newBalance,
    };
  },

  // ─── spendGemsOnItem ────────────────────────────────────────────

  spendGemsOnItem: async (itemId, ownedItemIds) => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      return {
        success: false,
        reason: 'unknown_item',
        newBalance: get().gemsBalance,
        message: 'No active user',
        item: null,
      };
    }

    const engineResult = engineSpendGems(itemId, get().gemsBalance, ownedItemIds);

    // Surface engine failures to the UI with a structured reason
    if (!engineResult.success || !engineResult.item) {
      return {
        success: false,
        reason: engineResult.item
          ? ownedItemIds.includes(itemId)
            ? 'already_owned'
            : 'insufficient_gems'
          : 'unknown_item',
        newBalance: get().gemsBalance,
        message: engineResult.message,
        item: engineResult.item,
      };
    }

    // Persist the spend
    const mutation: GemMutationInput = {
      amount: -engineResult.item.cost,
      source: engineResult.transaction!.source,
      description: engineResult.transaction!.description,
    };
    const newBalance = await gamificationRepository.applyGemMutation(userId, mutation);

    // For non-consumables, persist ownership
    if (!engineResult.item.isConsumable) {
      await gamificationRepository.addOwnedItem(
        userId,
        engineResult.item.id,
        engineResult.item.category
      );
    }

    set({ gemsBalance: newBalance });

    return {
      success: true,
      reason: 'purchased',
      newBalance,
      message: engineResult.message,
      item: engineResult.item,
    };
  },

  // ─── useCrampFreeze ─────────────────────────────────────────────

  useCrampFreeze: async (today) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return { success: false, message: 'No active user', gemsNeeded: null };

    const date = today ?? new Date().toISOString().split('T')[0]!;
    const result = engineUseCrampFreeze(get().streak, date, false);

    if (result.success) {
      const newState = await gamificationRepository.applyCrampFreezeResult(
        userId,
        result.state
      );
      if (newState) {
        set({
          streak: newState.streak,
          gemsBalance: newState.gemsBalance,
        });
      }
    }

    return {
      success: result.success,
      message: result.message,
      gemsNeeded: result.gemsNeeded,
    };
  },

  // ─── purchaseCrampFreeze ────────────────────────────────────────

  purchaseCrampFreeze: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) return { success: false, message: 'No active user', gemsNeeded: null };

    const result = enginePurchaseCrampFreeze(get().streak, get().gemsBalance);
    if (!result.success) {
      return { success: false, message: result.message, gemsNeeded: 50 };
    }

    // Two mutations: gem spend + streak state update (cramp_freeze_available)
    const mutation: GemMutationInput = {
      amount: -(get().gemsBalance - result.newGemBalance),
      source: 'spend_cramp_freeze',
      description: 'Purchased extra Cramp Freeze',
    };
    await gamificationRepository.applyGemMutation(userId, mutation);
    const newState = await gamificationRepository.applyCrampFreezeResult(userId, result.state);

    if (newState) {
      set({
        streak: newState.streak,
        gemsBalance: newState.gemsBalance,
      });
    }

    return { success: true, message: result.message, gemsNeeded: null };
  },

  // ─── unlockBadge ────────────────────────────────────────────────

  unlockBadge: async (badgeId, metadata) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return false;

    const wasNew = await gamificationRepository.unlockBadge(userId, badgeId, metadata);
    if (wasNew) {
      // Refresh badge list
      const ids = await gamificationRepository.getEarnedBadgeIds(userId);
      set({ badgesEarned: ids });

      // Auto-award the badge_unlock XP and gems
      await get().awardXp('badge_unlock');
      await get().earnGems('badge_unlock');
    }
    return wasNew;
  },

  // ─── refresh ────────────────────────────────────────────────────

  refresh: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) return;
    const state = await gamificationRepository.getState(userId);
    if (state) {
      set({
        streak: state.streak,
        xpTotal: state.xpTotal,
        currentLevel: state.currentLevel,
        gemsBalance: state.gemsBalance,
        badgesEarned: state.badgesEarned,
      });
    }
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectStreak = (s: GamificationStoreState): StreakState => s.streak;
export const selectGemsBalance = (s: GamificationStoreState): number => s.gemsBalance;
export const selectXpTotal = (s: GamificationStoreState): number => s.xpTotal;
export const selectCurrentLevel = (s: GamificationStoreState): number => s.currentLevel;

/**
 * Level progress, memoized by xpTotal. getLevelProgress builds a NEW object each
 * call; returning that straight from a selector makes Zustand re-render forever
 * ("Maximum update depth exceeded"). Cache by xpTotal so the reference is stable
 * between renders when XP hasn't changed.
 */
let _lpXp = Number.NaN;
let _lpCache: LevelProgress | null = null;
export const selectLevelProgress = (s: GamificationStoreState): LevelProgress => {
  if (_lpCache === null || s.xpTotal !== _lpXp) {
    _lpXp = s.xpTotal;
    _lpCache = getLevelProgress(s.xpTotal);
  }
  return _lpCache;
};

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function emptyCheckInResult(): CheckInResult {
  return {
    streakIncremented: false,
    streakBroken: false,
    milestone: null,
    newStreakCount: 0,
    xpAwarded: 0,
    gemsAwarded: 0,
    leveledUp: false,
    newLevel: 1,
    message: 'No active user — check-in skipped',
  };
}