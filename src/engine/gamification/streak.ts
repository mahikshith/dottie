/**
 * Dottie — Streak Engine
 *
 * Daily engagement mechanic inspired by Duolingo — but GENTLE.
 * We celebrate consistency without punishing life happening.
 *
 * KEY DIFFERENCES FROM DUOLINGO:
 * - Cramp Freeze: Automatic streak protection on period days (free!)
 * - Grace Period: Miss a day? You have until end of NEXT day to recover
 * - No guilt: Breaking a streak is met with encouragement, not disappointment
 * - Milestone celebrations: 7, 14, 30, 50, 100, 365 days
 *
 * CRAMP FREEZE PHILOSOPHY:
 * "Your body needs rest on tough days. Dottie protects your streak
 *  so you never have to choose between self-care and progress."
 *
 * Users get:
 * - 1 free Cramp Freeze per cycle (auto-granted)
 * - Additional Cramp Freezes purchasable with gems (50💎 each)
 * - Dottie+ users: Unlimited Cramp Freezes
 */

import { StreakState } from '../../types/gamification.types';

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** Streak milestone thresholds for celebrations */
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const;

/** Gem rewards per milestone */
export const MILESTONE_REWARDS: Record<number, { gems: number; xp: number }> = {
  3: { gems: 5, xp: 15 },
  7: { gems: 15, xp: 30 },
  14: { gems: 25, xp: 50 },
  21: { gems: 30, xp: 60 },
  30: { gems: 50, xp: 100 },
  50: { gems: 75, xp: 150 },
  75: { gems: 100, xp: 200 },
  100: { gems: 150, xp: 300 },
  150: { gems: 200, xp: 400 },
  200: { gems: 250, xp: 500 },
  365: { gems: 500, xp: 1000 },
};

/** Cost of a Cramp Freeze in gems */
export const CRAMP_FREEZE_GEM_COST = 50;

/** Free Cramp Freezes granted per cycle */
export const FREE_CRAMP_FREEZES_PER_CYCLE = 1;

/** Grace period: hours after midnight before streak is truly broken */
export const GRACE_PERIOD_HOURS = 36; // Until noon the NEXT day

// ─── STREAK STATE MANAGEMENT ─────────────────────────────────────────

/**
 * Create initial streak state for new users.
 */
export function createInitialStreakState(): StreakState {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastCheckInDate: null,
    crampFreezeAvailable: FREE_CRAMP_FREEZES_PER_CYCLE,
    crampFreezeUsedToday: false,
  };
}

/**
 * Process a daily check-in and update streak.
 *
 * @param currentState - Current streak state
 * @param checkInDate - Date of the check-in (ISO string YYYY-MM-DD)
 * @returns Updated streak state + any rewards earned
 */
export function processCheckIn(
  currentState: StreakState,
  checkInDate: string
): StreakUpdateResult {
  const today = checkInDate;
  const lastDate = currentState.lastCheckInDate;

  // First ever check-in
  if (!lastDate) {
    const newState: StreakState = {
      ...currentState,
      currentStreak: 1,
      longestStreak: 1,
      lastCheckInDate: today,
      crampFreezeUsedToday: false,
    };
    return {
      state: newState,
      streakIncremented: true,
      streakBroken: false,
      milestone: checkMilestone(1),
      rewards: null,
      message: "Your journey begins! Day 1 🌱",
    };
  }

  const daysDiff = daysBetweenDates(lastDate, today);

  // Same day check-in (already logged today)
  if (daysDiff === 0) {
    return {
      state: { ...currentState, crampFreezeUsedToday: false },
      streakIncremented: false,
      streakBroken: false,
      milestone: null,
      rewards: null,
      message: "Already checked in today! You're on it 💛",
    };
  }

  // Consecutive day (streak continues!)
  if (daysDiff === 1) {
    const newStreak = currentState.currentStreak + 1;
    const newLongest = Math.max(newStreak, currentState.longestStreak);
    const milestone = checkMilestone(newStreak);
    const rewards = milestone ? MILESTONE_REWARDS[milestone] || null : null;

    const newState: StreakState = {
      ...currentState,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastCheckInDate: today,
      crampFreezeUsedToday: false,
    };

    return {
      state: newState,
      streakIncremented: true,
      streakBroken: false,
      milestone,
      rewards,
      message: getStreakMessage(newStreak),
    };
  }

  // Missed days — streak is broken 💔 (but gently!)
  const newState: StreakState = {
    ...currentState,
    currentStreak: 1, // Reset to 1 (today counts)
    lastCheckInDate: today,
    crampFreezeUsedToday: false,
  };

  return {
    state: newState,
    streakIncremented: false,
    streakBroken: true,
    milestone: null,
    rewards: null,
    message: getStreakBrokenMessage(currentState.currentStreak),
  };
}

// ─── CRAMP FREEZE SYSTEM ─────────────────────────────────────────────

/**
 * Use a Cramp Freeze to protect streak on a tough day.
 * Streak is maintained without requiring a full check-in.
 *
 * @param currentState - Current streak state
 * @param today - Today's date (ISO string YYYY-MM-DD)
 * @param hasUnlimitedFreezes - Whether user has Dottie+ (unlimited)
 * @returns Updated state or error if no freezes available
 */
export function useCrampFreeze(
  currentState: StreakState,
  today: string,
  hasUnlimitedFreezes: boolean = false
): CrampFreezeResult {
  // Check availability
  if (!hasUnlimitedFreezes && currentState.crampFreezeAvailable <= 0) {
    return {
      success: false,
      state: currentState,
      message: "No Cramp Freezes available. You can get more from the gem store! 💎",
      gemsNeeded: CRAMP_FREEZE_GEM_COST,
    };
  }

  // Already used one today
  if (currentState.crampFreezeUsedToday) {
    return {
      success: false,
      state: currentState,
      message: "You've already used a Cramp Freeze today. Rest up! 🧣",
      gemsNeeded: null,
    };
  }

  // Apply the freeze — streak is protected!
  const newState: StreakState = {
    ...currentState,
    lastCheckInDate: today, // Count today as "checked in"
    crampFreezeUsedToday: true,
    crampFreezeAvailable: hasUnlimitedFreezes
      ? currentState.crampFreezeAvailable
      : currentState.crampFreezeAvailable - 1,
  };

  return {
    success: true,
    state: newState,
    message: "Cramp Freeze activated! 🧊 Your streak is safe. Rest well 💛",
    gemsNeeded: null,
  };
}

/**
 * Purchase a Cramp Freeze with gems.
 *
 * @param currentState - Current streak state
 * @param currentGems - User's gem balance
 * @returns Updated state and new gem balance, or error
 */
export function purchaseCrampFreeze(
  currentState: StreakState,
  currentGems: number
): CrampFreezePurchaseResult {
  if (currentGems < CRAMP_FREEZE_GEM_COST) {
    return {
      success: false,
      state: currentState,
      newGemBalance: currentGems,
      message: `Need ${CRAMP_FREEZE_GEM_COST}💎 for a Cramp Freeze. You have ${currentGems}💎`,
    };
  }

  const newState: StreakState = {
    ...currentState,
    crampFreezeAvailable: currentState.crampFreezeAvailable + 1,
  };

  return {
    success: true,
    state: newState,
    newGemBalance: currentGems - CRAMP_FREEZE_GEM_COST,
    message: "Cramp Freeze added! You now have one more safety net 🧊",
  };
}

/**
 * Grant free Cramp Freeze at the start of a new cycle.
 */
export function grantCycleCrampFreeze(currentState: StreakState): StreakState {
  return {
    ...currentState,
    crampFreezeAvailable: currentState.crampFreezeAvailable + FREE_CRAMP_FREEZES_PER_CYCLE,
  };
}

// ─── STREAK QUERIES ──────────────────────────────────────────────────

/**
 * Check if user's streak is at risk (didn't check in yesterday).
 * Used for gentle notification: "Your streak is waiting for you! 🔥"
 */
export function isStreakAtRisk(state: StreakState, today: string): boolean {
  if (!state.lastCheckInDate) return false;
  if (state.currentStreak === 0) return false;
  return daysBetweenDates(state.lastCheckInDate, today) >= 1;
}

/**
 * Check if streak is truly broken (past grace period).
 */
export function isStreakBroken(state: StreakState, today: string): boolean {
  if (!state.lastCheckInDate) return false;
  if (state.currentStreak === 0) return false;
  return daysBetweenDates(state.lastCheckInDate, today) >= 2;
}

/**
 * Get the next milestone the user is approaching.
 */
export function getNextMilestone(currentStreak: number): number | null {
  for (const milestone of STREAK_MILESTONES) {
    if (milestone > currentStreak) return milestone;
  }
  return null; // They've hit all milestones!
}

/**
 * Get days until next milestone.
 */
export function daysUntilNextMilestone(currentStreak: number): number | null {
  const next = getNextMilestone(currentStreak);
  if (!next) return null;
  return next - currentStreak;
}

// ─── HELPER TYPES ────────────────────────────────────────────────────

export interface StreakUpdateResult {
  state: StreakState;
  streakIncremented: boolean;
  streakBroken: boolean;
  milestone: number | null;
  rewards: { gems: number; xp: number } | null;
  message: string;
}

export interface CrampFreezeResult {
  success: boolean;
  state: StreakState;
  message: string;
  gemsNeeded: number | null;
}

export interface CrampFreezePurchaseResult {
  success: boolean;
  state: StreakState;
  newGemBalance: number;
  message: string;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function daysBetweenDates(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function checkMilestone(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak as any) ? streak : null;
}

function getStreakMessage(streak: number): string {
  if (streak <= 3) return `${streak} days! You're building a habit 🌱`;
  if (streak <= 7) return `${streak} days strong! A whole week is close 🔥`;
  if (streak <= 14) return `${streak} days! You're unstoppable 💪`;
  if (streak <= 30) return `${streak} days! This is amazing dedication ✨`;
  if (streak <= 50) return `${streak} DAYS! You're inspiring 🌟`;
  if (streak <= 100) return `${streak} days?! Legend status incoming 👑`;
  return `${streak} DAYS! You are absolutely incredible 🏆💛`;
}

function getStreakBrokenMessage(previousStreak: number): string {
  if (previousStreak <= 3) {
    return "No worries! Every day is a fresh start. You're back! 🌸";
  }
  if (previousStreak <= 14) {
    return `Your ${previousStreak}-day streak ended, but you showed up today — that's what matters! 💛`;
  }
  if (previousStreak <= 50) {
    return `${previousStreak} days was incredible! And now you're starting fresh. Your body remembers every check-in 🩷`;
  }
  return `${previousStreak} days of dedication doesn't disappear! You're still amazing. Let's go again 🌟`;
}
