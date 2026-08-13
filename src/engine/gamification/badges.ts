/**
 * Dottie — Badge System 🏅
 *
 * Badges are ACHIEVEMENTS that celebrate user milestones.
 * They represent dedication, learning, and growth — never pressure.
 *
 * DESIGN PHILOSOPHY:
 * - Badges are EARNED through natural engagement, never grind
 * - Each badge has a warm, encouraging name and description
 * - Unlocking a badge triggers celebration animation + companion reaction
 * - Badges display on profile and in anonymous community posts (credibility)
 * - Some badges are "hidden" — discovered only when earned (surprise & delight)
 *
 * BADGE CATEGORIES:
 * - Streak: Consistency & showing up
 * - Learning: Knowledge & education
 * - Community: Helping others & engagement
 * - Tracking: Logging & self-awareness
 * - Milestone: Special life/app moments
 *
 * BADGE UNLOCK FLOW:
 * 1. User performs action
 * 2. Badge engine checks if any badge conditions are newly met
 * 3. If badge unlocked → store earned badge
 * 4. Trigger celebration: confetti + companion dance + XP/Gem reward
 * 5. Badge appears in profile collection
 */

import { BadgeDefinition, BadgeCategory, BadgeEarned } from '../../types/gamification.types';

// ─── ALL BADGE DEFINITIONS ────────────────────────────────────────────

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── STREAK BADGES ──────────────────────────────────────────────────
  {
    id: 'streak_3',
    name: 'Getting Started',
    emoji: '🌱',
    description: 'Checked in for 3 days in a row — the habit is forming!',
    category: 'streak',
    requirement: '3-day streak',
    xpReward: 15,
    gemReward: 5,
  },
  {
    id: 'streak_7',
    name: 'One Week Wonder',
    emoji: '🔥',
    description: 'A full week of showing up for yourself. Incredible!',
    category: 'streak',
    requirement: '7-day streak',
    xpReward: 30,
    gemReward: 15,
  },
  {
    id: 'streak_14',
    name: 'Fortnight Strong',
    emoji: '💪',
    description: 'Two weeks of consistency — you\'re building real awareness.',
    category: 'streak',
    requirement: '14-day streak',
    xpReward: 50,
    gemReward: 25,
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    emoji: '⭐',
    description: 'A full month! You know your body better than ever.',
    category: 'streak',
    requirement: '30-day streak',
    xpReward: 100,
    gemReward: 50,
  },
  {
    id: 'streak_50',
    name: 'Unstoppable',
    emoji: '🌟',
    description: '50 days straight — your dedication is truly inspiring.',
    category: 'streak',
    requirement: '50-day streak',
    xpReward: 150,
    gemReward: 75,
  },
  {
    id: 'streak_100',
    name: 'Century Champion',
    emoji: '👑',
    description: '100 DAYS! You are a legend. Your body thanks you.',
    category: 'streak',
    requirement: '100-day streak',
    xpReward: 300,
    gemReward: 150,
  },
  {
    id: 'streak_365',
    name: 'Year of You',
    emoji: '🏆',
    description: '365 days of self-care. You\'ve transformed your health journey.',
    category: 'streak',
    requirement: '365-day streak',
    xpReward: 1000,
    gemReward: 500,
  },

  // ── LEARNING BADGES ────────────────────────────────────────────────
  {
    id: 'first_lesson',
    name: 'Curious Mind',
    emoji: '📚',
    description: 'Completed your first lesson — knowledge is power!',
    category: 'learning',
    requirement: 'Complete 1 lesson',
    xpReward: 20,
    gemReward: 10,
  },
  {
    id: 'path_complete_1',
    name: 'Path Pioneer',
    emoji: '🗺️',
    description: 'Finished your first complete learning path. Brilliant!',
    category: 'learning',
    requirement: 'Complete 1 learning path',
    xpReward: 75,
    gemReward: 50,
  },
  {
    id: 'path_complete_3',
    name: 'Knowledge Seeker',
    emoji: '🎓',
    description: 'Three learning paths mastered — you\'re a cycle expert!',
    category: 'learning',
    requirement: 'Complete 3 learning paths',
    xpReward: 150,
    gemReward: 100,
  },
  {
    id: 'quiz_perfect_5',
    name: 'Sharp Mind',
    emoji: '🧠',
    description: 'Five perfect quiz scores — nothing gets past you!',
    category: 'learning',
    requirement: '5 perfect quiz scores (100%)',
    xpReward: 60,
    gemReward: 30,
  },
  {
    id: 'quiz_perfect_20',
    name: 'Quiz Queen',
    emoji: '💎',
    description: '20 perfect scores — your health knowledge is extraordinary.',
    category: 'learning',
    requirement: '20 perfect quiz scores',
    xpReward: 150,
    gemReward: 75,
  },
  {
    id: 'lessons_10',
    name: 'Dedicated Learner',
    emoji: '📖',
    description: '10 lessons completed — building knowledge step by step.',
    category: 'learning',
    requirement: 'Complete 10 lessons',
    xpReward: 50,
    gemReward: 25,
  },

  // ── COMMUNITY BADGES ───────────────────────────────────────────────
  {
    id: 'first_post',
    name: 'Voice Found',
    emoji: '💬',
    description: 'You shared with the community for the first time. Brave!',
    category: 'community',
    requirement: 'Create first community post',
    xpReward: 20,
    gemReward: 10,
  },
  {
    id: 'helper_10',
    name: 'Kind Helper',
    emoji: '🤗',
    description: 'You\'ve helped 10 people with your replies. Thank you!',
    category: 'community',
    requirement: '10 replies marked as helpful',
    xpReward: 50,
    gemReward: 30,
  },
  {
    id: 'helper_50',
    name: 'Community Angel',
    emoji: '😇',
    description: '50 helpful replies — you make this space better for everyone.',
    category: 'community',
    requirement: '50 replies marked as helpful',
    xpReward: 150,
    gemReward: 75,
  },
  {
    id: 'hugs_given_25',
    name: 'Hug Giver',
    emoji: '🫂',
    description: 'You\'ve sent 25 hugs — spreading warmth wherever you go.',
    category: 'community',
    requirement: 'Send 25 hugs in community',
    xpReward: 30,
    gemReward: 15,
  },
  {
    id: 'hugs_given_100',
    name: 'Warmth Warrior',
    emoji: '💛',
    description: '100 hugs sent! The community is warmer because of you.',
    category: 'community',
    requirement: 'Send 100 hugs in community',
    xpReward: 75,
    gemReward: 40,
  },

  // ── TRACKING BADGES ────────────────────────────────────────────────
  {
    id: 'first_log',
    name: 'First Step',
    emoji: '✏️',
    description: 'You logged your first symptom. The journey begins!',
    category: 'tracking',
    requirement: 'Log first symptom',
    xpReward: 10,
    gemReward: 5,
  },
  {
    id: 'symptoms_50',
    name: 'Body Listener',
    emoji: '👂',
    description: '50 symptoms logged — you really listen to your body.',
    category: 'tracking',
    requirement: 'Log 50 symptoms',
    xpReward: 40,
    gemReward: 20,
  },
  {
    id: 'symptoms_200',
    name: 'Self-Awareness Queen',
    emoji: '🪞',
    description: '200 logs! Your body data is a goldmine of self-knowledge.',
    category: 'tracking',
    requirement: 'Log 200 symptoms',
    xpReward: 100,
    gemReward: 50,
  },
  {
    id: 'all_phases_logged',
    name: 'Full Cycle Explorer',
    emoji: '🔄',
    description: 'You\'ve logged in every phase of your cycle. Complete picture!',
    category: 'tracking',
    requirement: 'Log at least once in each of the 4 phases',
    xpReward: 40,
    gemReward: 20,
  },
  {
    id: 'period_logged_6',
    name: 'Cycle Tracker',
    emoji: '📅',
    description: '6 periods logged — Dottie\'s predictions are getting smarter!',
    category: 'tracking',
    requirement: 'Log 6 complete period cycles',
    xpReward: 60,
    gemReward: 30,
  },
  {
    id: 'period_logged_12',
    name: 'Year Mapper',
    emoji: '🗓️',
    description: '12 cycles tracked — a full year of cycle data. Powerful!',
    category: 'tracking',
    requirement: 'Log 12 complete period cycles',
    xpReward: 150,
    gemReward: 75,
  },

  // ── MILESTONE BADGES ───────────────────────────────────────────────
  {
    id: 'onboarding_complete',
    name: 'Welcome Home',
    emoji: '🏠',
    description: 'You set up your Dottie profile. Welcome to the family!',
    category: 'milestone',
    requirement: 'Complete onboarding',
    xpReward: 15,
    gemReward: 10,
  },
  {
    id: 'companion_chosen',
    name: 'Spirit Connected',
    emoji: '🦊',
    description: 'You chose your spirit companion. A friendship begins!',
    category: 'milestone',
    requirement: 'Select spirit companion',
    xpReward: 10,
    gemReward: 5,
  },
  {
    id: 'sisterhood_created',
    name: 'Circle Starter',
    emoji: '👯‍♀️',
    description: 'You created a Sisterhood Circle. Caring for others is beautiful.',
    category: 'milestone',
    requirement: 'Create first Sisterhood Circle',
    xpReward: 30,
    gemReward: 20,
  },
  {
    id: 'first_care_nudge',
    name: 'Care Bearer',
    emoji: '💌',
    description: 'You sent your first care nudge. Small acts of love matter.',
    category: 'milestone',
    requirement: 'Send first care nudge',
    xpReward: 15,
    gemReward: 10,
  },
  {
    id: 'doctor_report',
    name: 'Health Advocate',
    emoji: '🩺',
    description: 'You generated your first doctor report. Empowered!',
    category: 'milestone',
    requirement: 'Generate first doctor report',
    xpReward: 40,
    gemReward: 25,
  },
  {
    id: 'cramp_freeze_used',
    name: 'Self-Care Champion',
    emoji: '🧊',
    description: 'Used your first Cramp Freeze. Rest IS productive!',
    category: 'milestone',
    requirement: 'Use first Cramp Freeze',
    xpReward: 10,
    gemReward: 5,
  },
  {
    id: 'level_10',
    name: 'Rising Star',
    emoji: '🌅',
    description: 'Reached Level 10! Your dedication shines bright.',
    category: 'milestone',
    requirement: 'Reach Level 10',
    xpReward: 100,
    gemReward: 50,
  },
  {
    id: 'level_25',
    name: 'Goddess Level',
    emoji: '✨',
    description: 'Level 25 — you\'ve mastered the art of self-awareness.',
    category: 'milestone',
    requirement: 'Reach Level 25',
    xpReward: 250,
    gemReward: 125,
  },
];

// ─── HIDDEN BADGES (Surprise & Delight) ───────────────────────────────

/** These badges are NOT shown in the badge list until earned */
export const HIDDEN_BADGES: BadgeDefinition[] = [
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description: 'Logged a check-in after midnight. We see you! Rest soon 💤',
    category: 'milestone',
    requirement: 'Check in between 12am-4am',
    xpReward: 10,
    gemReward: 10,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🐦',
    description: 'Check-in before 6am! Starting the day with intention.',
    category: 'milestone',
    requirement: 'Check in before 6am',
    xpReward: 10,
    gemReward: 10,
  },
  {
    id: 'phase_sync',
    name: 'In Sync',
    emoji: '🤝',
    description: 'You and a Sisterhood member are in the same phase!',
    category: 'milestone',
    requirement: 'Be in same phase as a Sisterhood Circle member',
    xpReward: 15,
    gemReward: 10,
  },
  {
    id: 'comeback',
    name: 'The Comeback',
    emoji: '🌈',
    description: 'Returned after 7+ days away. Welcome back, we missed you!',
    category: 'milestone',
    requirement: 'Return after 7+ days of inactivity',
    xpReward: 20,
    gemReward: 15,
  },
  {
    id: 'valentines',
    name: 'Self-Love Day',
    emoji: '💕',
    description: 'Logged on Valentine\'s Day. The most important love is self-love.',
    category: 'milestone',
    requirement: 'Check in on February 14th',
    xpReward: 15,
    gemReward: 15,
  },
  {
    id: 'new_year',
    name: 'Fresh Start',
    emoji: '🎆',
    description: 'Starting the year right! Checked in on January 1st.',
    category: 'milestone',
    requirement: 'Check in on January 1st',
    xpReward: 15,
    gemReward: 15,
  },
];

// ─── BADGE ENGINE FUNCTIONS ───────────────────────────────────────────

/**
 * Check all badge conditions against current user state.
 * Returns any NEWLY earned badges.
 *
 * @param state - Current user metrics for badge evaluation
 * @param earnedBadgeIds - Badges already earned (to avoid duplicates)
 * @returns Array of newly unlocked badges
 */
export function checkBadgeUnlocks(
  state: BadgeCheckState,
  earnedBadgeIds: string[]
): BadgeUnlockResult[] {
  const newBadges: BadgeUnlockResult[] = [];

  // Check all regular badges
  for (const badge of BADGE_DEFINITIONS) {
    if (earnedBadgeIds.includes(badge.id)) continue; // Already earned
    if (evaluateBadgeCondition(badge.id, state)) {
      newBadges.push(createBadgeUnlock(badge));
    }
  }

  // Check hidden badges
  for (const badge of HIDDEN_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue;
    if (evaluateHiddenBadgeCondition(badge.id, state)) {
      newBadges.push({ ...createBadgeUnlock(badge), isHidden: true });
    }
  }

  return newBadges;
}

/**
 * Get all badges for display (earned + locked).
 * Hidden badges only show if earned.
 */
export function getBadgeCollection(earnedBadgeIds: string[]): BadgeDisplayItem[] {
  const collection: BadgeDisplayItem[] = [];

  // Regular badges — always shown (earned or locked)
  for (const badge of BADGE_DEFINITIONS) {
    collection.push({
      ...badge,
      isEarned: earnedBadgeIds.includes(badge.id),
      isHidden: false,
    });
  }

  // Hidden badges — only shown if earned
  for (const badge of HIDDEN_BADGES) {
    if (earnedBadgeIds.includes(badge.id)) {
      collection.push({
        ...badge,
        isEarned: true,
        isHidden: true,
      });
    }
  }

  return collection;
}

/**
 * Get badges filtered by category.
 */
export function getBadgesByCategory(
  category: BadgeCategory,
  earnedBadgeIds: string[]
): BadgeDisplayItem[] {
  return getBadgeCollection(earnedBadgeIds).filter(b => b.category === category);
}

/**
 * Get count of earned badges per category.
 */
export function getBadgeCountByCategory(
  earnedBadgeIds: string[]
): Record<BadgeCategory, { earned: number; total: number }> {
  const categories: BadgeCategory[] = ['streak', 'learning', 'community', 'tracking', 'milestone'];
  const result: Record<string, { earned: number; total: number }> = {};

  for (const category of categories) {
    const allInCategory = BADGE_DEFINITIONS.filter(b => b.category === category);
    const earnedInCategory = allInCategory.filter(b => earnedBadgeIds.includes(b.id));
    result[category] = {
      earned: earnedInCategory.length,
      total: allInCategory.length,
    };
  }

  return result as Record<BadgeCategory, { earned: number; total: number }>;
}

/**
 * Get the next badge the user is closest to earning.
 * Used for motivation: "2 more days until 'One Week Wonder'!"
 */
export function getNextBadgeProgress(
  state: BadgeCheckState,
  earnedBadgeIds: string[]
): BadgeProgressHint | null {
  // Check streak badges first (most visible progress)
  const streakBadges = BADGE_DEFINITIONS.filter(
    b => b.category === 'streak' && !earnedBadgeIds.includes(b.id)
  );

  for (const badge of streakBadges) {
    const target = getStreakTarget(badge.id);
    if (target && state.currentStreak > 0) {
      const remaining = target - state.currentStreak;
      if (remaining > 0 && remaining <= 10) {
        return {
          badge,
          progressMessage: `${remaining} more day${remaining > 1 ? 's' : ''} until "${badge.name}" ${badge.emoji}`,
          progressPercent: state.currentStreak / target,
        };
      }
    }
  }

  // Check learning badges
  const learningBadges = BADGE_DEFINITIONS.filter(
    b => b.category === 'learning' && !earnedBadgeIds.includes(b.id)
  );

  if (learningBadges.length > 0 && state.lessonsCompleted > 0) {
    const nextLesson = learningBadges.find(b => b.id === 'lessons_10');
    if (nextLesson && state.lessonsCompleted < 10 && state.lessonsCompleted >= 7) {
      const remaining = 10 - state.lessonsCompleted;
      return {
        badge: nextLesson,
        progressMessage: `${remaining} more lesson${remaining > 1 ? 's' : ''} until "${nextLesson.name}" ${nextLesson.emoji}`,
        progressPercent: state.lessonsCompleted / 10,
      };
    }
  }

  return null;
}

/**
 * Get celebration message for a badge unlock.
 * Each badge has a unique celebration feel.
 */
export function getBadgeCelebration(badgeId: string): BadgeCelebration {
  const badge = [...BADGE_DEFINITIONS, ...HIDDEN_BADGES].find(b => b.id === badgeId);

  if (!badge) {
    return {
      title: 'Badge Unlocked!',
      subtitle: 'You earned a new badge!',
      animationType: 'confetti',
      companionReaction: 'celebrating',
    };
  }

  // Special celebrations for major milestones
  if (badge.id === 'streak_100' || badge.id === 'streak_365') {
    return {
      title: `🎉 ${badge.name}!`,
      subtitle: badge.description,
      animationType: 'fireworks',
      companionReaction: 'celebrating',
    };
  }

  if (badge.id === 'level_25') {
    return {
      title: `✨ ${badge.name}!`,
      subtitle: badge.description,
      animationType: 'fireworks',
      companionReaction: 'proud',
    };
  }

  // Hidden badge discovery
  if (HIDDEN_BADGES.find(b => b.id === badgeId)) {
    return {
      title: `🔓 Secret Badge Discovered!`,
      subtitle: `${badge.emoji} ${badge.name}: ${badge.description}`,
      animationType: 'sparkle',
      companionReaction: 'celebrating',
    };
  }

  // Default celebration
  return {
    title: `${badge.emoji} ${badge.name}!`,
    subtitle: badge.description,
    animationType: 'confetti',
    companionReaction: 'proud',
  };
}

// ─── HELPER TYPES ────────────────────────────────────────────────────

/** State required to evaluate badge conditions */
export interface BadgeCheckState {
  currentStreak: number;
  longestStreak: number;
  lessonsCompleted: number;
  pathsCompleted: number;
  perfectQuizzes: number;
  totalQuizzes: number;
  symptomsLogged: number;
  periodsLogged: number;
  phasesLoggedIn: string[];       // e.g., ['menstrual', 'follicular', 'ovulatory', 'luteal']
  communityPosts: number;
  helpfulReplies: number;
  hugsGiven: number;
  currentLevel: number;
  crampFreezesUsed: number;
  sisterhoodCreated: boolean;
  careNudgesSent: number;
  doctorReportsGenerated: number;
  companionChosen: boolean;
  onboardingComplete: boolean;
  checkInHour: number;            // 0-23 (for time-based hidden badges)
  checkInDate: string;            // ISO date (for date-based hidden badges)
  daysInactive: number;           // Days since last check-in
  isSamePhaseAsSisterhood: boolean;
}

export interface BadgeUnlockResult {
  badge: BadgeDefinition;
  earnedAt: string;
  xpReward: number;
  gemReward: number;
  isHidden: boolean;
}

export interface BadgeDisplayItem extends BadgeDefinition {
  isEarned: boolean;
  isHidden: boolean;
}

export interface BadgeProgressHint {
  badge: BadgeDefinition;
  progressMessage: string;
  progressPercent: number;
}

export interface BadgeCelebration {
  title: string;
  subtitle: string;
  animationType: 'confetti' | 'fireworks' | 'sparkle';
  companionReaction: 'celebrating' | 'proud' | 'happy';
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function createBadgeUnlock(badge: BadgeDefinition): BadgeUnlockResult {
  return {
    badge,
    earnedAt: new Date().toISOString(),
    xpReward: badge.xpReward,
    gemReward: badge.gemReward,
    isHidden: false,
  };
}

function evaluateBadgeCondition(badgeId: string, state: BadgeCheckState): boolean {
  switch (badgeId) {
    // Streak badges
    case 'streak_3': return state.currentStreak >= 3;
    case 'streak_7': return state.currentStreak >= 7;
    case 'streak_14': return state.currentStreak >= 14;
    case 'streak_30': return state.currentStreak >= 30;
    case 'streak_50': return state.currentStreak >= 50;
    case 'streak_100': return state.currentStreak >= 100;
    case 'streak_365': return state.currentStreak >= 365;

    // Learning badges
    case 'first_lesson': return state.lessonsCompleted >= 1;
    case 'lessons_10': return state.lessonsCompleted >= 10;
    case 'path_complete_1': return state.pathsCompleted >= 1;
    case 'path_complete_3': return state.pathsCompleted >= 3;
    case 'quiz_perfect_5': return state.perfectQuizzes >= 5;
    case 'quiz_perfect_20': return state.perfectQuizzes >= 20;

    // Community badges
    case 'first_post': return state.communityPosts >= 1;
    case 'helper_10': return state.helpfulReplies >= 10;
    case 'helper_50': return state.helpfulReplies >= 50;
    case 'hugs_given_25': return state.hugsGiven >= 25;
    case 'hugs_given_100': return state.hugsGiven >= 100;

    // Tracking badges
    case 'first_log': return state.symptomsLogged >= 1;
    case 'symptoms_50': return state.symptomsLogged >= 50;
    case 'symptoms_200': return state.symptomsLogged >= 200;
    case 'all_phases_logged': return state.phasesLoggedIn.length >= 4;
    case 'period_logged_6': return state.periodsLogged >= 6;
    case 'period_logged_12': return state.periodsLogged >= 12;

    // Milestone badges
    case 'onboarding_complete': return state.onboardingComplete;
    case 'companion_chosen': return state.companionChosen;
    case 'sisterhood_created': return state.sisterhoodCreated;
    case 'first_care_nudge': return state.careNudgesSent >= 1;
    case 'doctor_report': return state.doctorReportsGenerated >= 1;
    case 'cramp_freeze_used': return state.crampFreezesUsed >= 1;
    case 'level_10': return state.currentLevel >= 10;
    case 'level_25': return state.currentLevel >= 25;

    default: return false;
  }
}

function evaluateHiddenBadgeCondition(badgeId: string, state: BadgeCheckState): boolean {
  switch (badgeId) {
    case 'night_owl':
      return state.checkInHour >= 0 && state.checkInHour < 4;
    case 'early_bird':
      return state.checkInHour >= 4 && state.checkInHour < 6;
    case 'phase_sync':
      return state.isSamePhaseAsSisterhood;
    case 'comeback':
      return state.daysInactive >= 7;
    case 'valentines':
      return state.checkInDate.endsWith('-02-14');
    case 'new_year':
      return state.checkInDate.endsWith('-01-01');
    default:
      return false;
  }
}

function getStreakTarget(badgeId: string): number | null {
  const map: Record<string, number> = {
    streak_3: 3,
    streak_7: 7,
    streak_14: 14,
    streak_30: 30,
    streak_50: 50,
    streak_100: 100,
    streak_365: 365,
  };
  return map[badgeId] ?? null;
}
