/**
 * Dottie — XP (Experience Points) Engine
 *
 * XP represents overall engagement and learning progress.
 * Users earn XP from check-ins, lessons, quizzes, and achievements.
 * XP drives the LEVEL system — each level unlocks new content/features.
 *
 * DESIGN PRINCIPLES:
 * - XP is ALWAYS earned, never lost (positive reinforcement only)
 * - Small actions give small XP, big actions give big XP (proportional)
 * - Levels are achievable but meaningful (not too fast, not too slow)
 * - Every level-up is a celebration moment (confetti, companion dance)
 *
 * LEVEL CURVE:
 * - Early levels are quick (instant gratification for new users)
 * - Mid levels require consistent engagement (habit formation)
 * - High levels are aspirational (long-term users feel rewarded)
 */

import { XPSource, XPTransaction, LevelDefinition } from '../../types/gamification.types';

// ─── XP EARN RATES ───────────────────────────────────────────────────

/** XP awarded per action */
export const XP_RATES: Record<XPSource, number> = {
  daily_checkin: 10,       // Every day check-in
  lesson_complete: 25,     // Finishing a lesson
  quiz_perfect: 50,        // 100% quiz score
  quiz_pass: 30,           // Passing a quiz (≥70%)
  symptom_log: 5,          // Logging a symptom
  badge_unlock: 40,        // Earning any badge
  streak_milestone: 0,     // Variable — set per milestone
};

/** Bonus XP multipliers */
export const XP_MULTIPLIERS = {
  /** First check-in of the day (bonus on top of daily_checkin) */
  firstOfDay: 1.0,
  /** Streak bonus: every 7 consecutive days, check-in XP doubles */
  streakWeekBonus: 2.0,
  /** Completing all daily questions (bonus XP) */
  allQuestionsAnswered: 5,
  /** Logging during period (extra encouragement) */
  periodDayBonus: 3,
};

// ─── LEVEL DEFINITIONS ───────────────────────────────────────────────

/**
 * Level progression curve.
 * XP required follows a gentle exponential:
 * Level N requires ~N * 50 + (N-1)^1.5 * 20 total XP
 *
 * This means:
 * - Level 1→2: Quick (50 XP, ~3-5 days of check-ins)
 * - Level 5: ~1 week of active engagement
 * - Level 10: ~3-4 weeks of consistent use
 * - Level 20: ~2-3 months
 * - Level 30: ~6 months (dedicated user)
 * - Level 50: ~1 year+ (power user)
 */
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  { level: 1, name: 'Seedling', xpRequired: 0, emoji: '🌱' },
  { level: 2, name: 'Sprout', xpRequired: 50, emoji: '🌿' },
  { level: 3, name: 'Bud', xpRequired: 120, emoji: '🌷' },
  { level: 4, name: 'Bloom', xpRequired: 220, emoji: '🌸' },
  { level: 5, name: 'Petal', xpRequired: 350, emoji: '🌺' },
  { level: 6, name: 'Garden', xpRequired: 520, emoji: '🌻' },
  { level: 7, name: 'Meadow', xpRequired: 730, emoji: '🏵️' },
  { level: 8, name: 'Grove', xpRequired: 980, emoji: '🌳' },
  { level: 9, name: 'Forest', xpRequired: 1280, emoji: '🌲' },
  { level: 10, name: 'Sunrise', xpRequired: 1630, emoji: '🌅' },
  { level: 11, name: 'Radiance', xpRequired: 2030, emoji: '✨' },
  { level: 12, name: 'Glow', xpRequired: 2500, emoji: '💫' },
  { level: 13, name: 'Shimmer', xpRequired: 3030, emoji: '🌟' },
  { level: 14, name: 'Starlight', xpRequired: 3630, emoji: '⭐' },
  { level: 15, name: 'Constellation', xpRequired: 4300, emoji: '🌌' },
  { level: 16, name: 'Moon', xpRequired: 5050, emoji: '🌙' },
  { level: 17, name: 'Eclipse', xpRequired: 5900, emoji: '🌑' },
  { level: 18, name: 'Aurora', xpRequired: 6850, emoji: '🎆' },
  { level: 19, name: 'Cosmos', xpRequired: 7900, emoji: '🪐' },
  { level: 20, name: 'Nebula', xpRequired: 9100, emoji: '💜' },
  { level: 21, name: 'Supernova', xpRequired: 10500, emoji: '💥' },
  { level: 22, name: 'Galaxy', xpRequired: 12100, emoji: '🌀' },
  { level: 23, name: 'Universe', xpRequired: 13900, emoji: '🔮' },
  { level: 24, name: 'Infinity', xpRequired: 15900, emoji: '♾️' },
  { level: 25, name: 'Goddess', xpRequired: 18200, emoji: '👑' },
  { level: 30, name: 'Legend', xpRequired: 28000, emoji: '🏆' },
  { level: 35, name: 'Mythic', xpRequired: 40000, emoji: '🦋' },
  { level: 40, name: 'Eternal', xpRequired: 55000, emoji: '💎' },
  { level: 45, name: 'Transcendent', xpRequired: 75000, emoji: '🌈' },
  { level: 50, name: 'Dottie Master', xpRequired: 100000, emoji: '🩷' },
];

// ─── XP FUNCTIONS ────────────────────────────────────────────────────

/**
 * Award XP for an action.
 *
 * @param source - What action earned the XP
 * @param currentXP - User's current total XP
 * @param currentStreak - Current streak count (for multiplier)
 * @param isPeriodDay - Whether today is a period day (bonus)
 * @returns Transaction record + new total
 */
export function awardXP(
  source: XPSource,
  currentXP: number,
  currentStreak: number = 0,
  isPeriodDay: boolean = false
): XPAwardResult {
  let baseAmount = XP_RATES[source];

  // Apply streak week bonus (every 7 days, check-in XP doubles)
  if (source === 'daily_checkin' && currentStreak > 0 && currentStreak % 7 === 0) {
    baseAmount = Math.round(baseAmount * XP_MULTIPLIERS.streakWeekBonus);
  }

  // Period day bonus (extra encouragement for logging on tough days)
  if (isPeriodDay && (source === 'daily_checkin' || source === 'symptom_log')) {
    baseAmount += XP_MULTIPLIERS.periodDayBonus;
  }

  const newTotal = currentXP + baseAmount;
  const transaction: XPTransaction = {
    amount: baseAmount,
    source,
    timestamp: new Date().toISOString(),
  };

  // Check for level up
  const previousLevel = getLevelForXP(currentXP);
  const newLevel = getLevelForXP(newTotal);
  const leveledUp = newLevel.level > previousLevel.level;

  return {
    transaction,
    newTotal,
    amountAwarded: baseAmount,
    leveledUp,
    newLevel: leveledUp ? newLevel : null,
    message: getXPMessage(source, baseAmount, leveledUp, newLevel),
  };
}

/**
 * Get the user's current level based on total XP.
 */
export function getLevelForXP(totalXP: number): LevelDefinition {
  let currentLevel = LEVEL_DEFINITIONS[0];

  for (const level of LEVEL_DEFINITIONS) {
    if (totalXP >= level.xpRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }

  return currentLevel;
}

/**
 * Get XP progress toward next level.
 *
 * @returns Object with progress info for UI display
 */
export function getLevelProgress(totalXP: number): LevelProgress {
  const currentLevel = getLevelForXP(totalXP);
  const nextLevel = getNextLevel(currentLevel.level);

  if (!nextLevel) {
    // Max level reached!
    return {
      currentLevel,
      nextLevel: null,
      xpInCurrentLevel: 0,
      xpNeededForNext: 0,
      progressPercent: 1.0,
      isMaxLevel: true,
    };
  }

  const xpInCurrentLevel = totalXP - currentLevel.xpRequired;
  const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired;
  const progressPercent = Math.min(1.0, xpInCurrentLevel / xpNeededForNext);

  return {
    currentLevel,
    nextLevel,
    xpInCurrentLevel,
    xpNeededForNext,
    progressPercent,
    isMaxLevel: false,
  };
}

/**
 * Get the next level definition.
 */
export function getNextLevel(currentLevel: number): LevelDefinition | null {
  const index = LEVEL_DEFINITIONS.findIndex(l => l.level === currentLevel);
  if (index === -1 || index >= LEVEL_DEFINITIONS.length - 1) return null;
  return LEVEL_DEFINITIONS[index + 1];
}

/**
 * Calculate total XP earned today from transactions.
 */
export function getTodayXP(transactions: XPTransaction[], today: string): number {
  return transactions
    .filter(t => t.timestamp.startsWith(today))
    .reduce((sum, t) => sum + t.amount, 0);
}

// ─── HELPER TYPES ────────────────────────────────────────────────────

export interface XPAwardResult {
  transaction: XPTransaction;
  newTotal: number;
  amountAwarded: number;
  leveledUp: boolean;
  newLevel: LevelDefinition | null;
  message: string;
}

export interface LevelProgress {
  currentLevel: LevelDefinition;
  nextLevel: LevelDefinition | null;
  xpInCurrentLevel: number;
  xpNeededForNext: number;
  progressPercent: number; // 0.0 - 1.0
  isMaxLevel: boolean;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function getXPMessage(
  source: XPSource,
  amount: number,
  leveledUp: boolean,
  newLevel: LevelDefinition | null
): string {
  if (leveledUp && newLevel) {
    return `🎉 LEVEL UP! You're now ${newLevel.emoji} ${newLevel.name} (Level ${newLevel.level})!`;
  }

  switch (source) {
    case 'daily_checkin':
      return `+${amount} XP for checking in! 🌸`;
    case 'lesson_complete':
      return `+${amount} XP! Great learning 📚`;
    case 'quiz_perfect':
      return `+${amount} XP! Perfect score! 🌟`;
    case 'quiz_pass':
      return `+${amount} XP! Quiz passed ✨`;
    case 'symptom_log':
      return `+${amount} XP for tracking 💛`;
    case 'badge_unlock':
      return `+${amount} XP! Badge unlocked 🏅`;
    case 'streak_milestone':
      return `+${amount} XP! Streak milestone 🔥`;
    default:
      return `+${amount} XP ✨`;
  }
}
