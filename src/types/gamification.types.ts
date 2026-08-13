/**
 * Dottie — Gamification Types
 *
 * Types for streaks, XP, gems, badges, and levels.
 */

/** Badge categories */
export type BadgeCategory = 'streak' | 'learning' | 'community' | 'tracking' | 'milestone';

/** Badge definition */
export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: BadgeCategory;
  requirement: string; // Human-readable unlock condition
  xpReward: number;
  gemReward: number;
}

/** Badge earned by user */
export interface BadgeEarned {
  id: string;
  badgeId: string;
  earnedAt: string; // ISO timestamp
  metadata: Record<string, unknown>;
}

/** Streak state */
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null; // ISO date
  crampFreezeAvailable: number;
  crampFreezeUsedToday: boolean;
}

/** XP transaction record */
export interface XPTransaction {
  amount: number;
  source: XPSource;
  timestamp: string; // ISO timestamp
}

/** Sources of XP */
export type XPSource =
  | 'daily_checkin'
  | 'lesson_complete'
  | 'quiz_perfect'
  | 'quiz_pass'
  | 'symptom_log'
  | 'badge_unlock'
  | 'streak_milestone';

/** Gem transaction record */
export interface GemTransaction {
  amount: number; // positive = earn, negative = spend
  source: GemSource;
  timestamp: string; // ISO timestamp
  description: string;
}

/** Sources of gems */
export type GemSource =
  | 'daily_checkin'
  | 'streak_milestone_7'
  | 'streak_milestone_30'
  | 'streak_milestone_100'
  | 'quiz_complete'
  | 'badge_unlock'
  | 'purchase' // real money purchase
  | 'spend_cramp_freeze'
  | 'spend_outfit'
  | 'spend_theme';

/** Level definition */
export interface LevelDefinition {
  level: number;
  name: string;
  xpRequired: number;
  emoji: string;
}

/** Current gamification state (for store) */
export interface GamificationState {
  streak: StreakState;
  xpTotal: number;
  currentLevel: number;
  gemsBalance: number;
  badgesEarned: string[]; // badge IDs
}
