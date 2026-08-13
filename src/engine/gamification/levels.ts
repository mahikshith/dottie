/**
 * Dottie — Level Progression System 🌟
 *
 * Levels represent the user's overall journey in Dottie.
 * Each level is a milestone of engagement, learning, and self-awareness.
 *
 * DESIGN PHILOSOPHY:
 * - Levels feel like GROWTH, not grinding
 * - Each level has a beautiful nature-inspired name (Seedling → Goddess → Legend)
 * - Level-ups trigger full-screen celebrations (confetti + companion reaction)
 * - Early levels are quick (instant gratification for new users)
 * - Higher levels = deeper commitment (but never feel impossible)
 * - Some levels unlock cosmetic perks (new themes, companion outfits)
 *
 * LEVEL CURVE DESIGN:
 * - L1-5: "Discovery" phase — quick wins, user learns the app (1-2 weeks)
 * - L6-10: "Habit" phase — consistent engagement needed (3-4 weeks)
 * - L11-15: "Knowledge" phase — learning paths drive XP (1-2 months)
 * - L16-20: "Mastery" phase — deep engagement (2-4 months)
 * - L21-25: "Expertise" phase — community + tracking (4-6 months)
 * - L26-50: "Legend" phase — long-term dedication (6-12+ months)
 *
 * UNLOCKS PER LEVEL:
 * - Every level: celebration animation + companion reaction
 * - Every 5 levels: new cosmetic unlock (theme/outfit/frame)
 * - Level 10: Community posting unlocked
 * - Level 15: Advanced insights unlocked
 * - Level 25: "Goddess" title + exclusive badge
 */

import { LevelDefinition } from '../../types/gamification.types';
import { LEVEL_DEFINITIONS } from './xp';

// ─── LEVEL UNLOCK REWARDS ─────────────────────────────────────────────

/** What gets unlocked at each level */
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  {
    level: 2,
    unlockType: 'feature',
    unlockId: 'daily_decode',
    title: 'Daily Decode Unlocked!',
    description: 'You now get personalized daily health insights 🌸',
    emoji: '📖',
  },
  {
    level: 3,
    unlockType: 'feature',
    unlockId: 'quick_log',
    title: 'Quick Log Unlocked!',
    description: 'Fast symptom logging — just 2 taps! ⚡',
    emoji: '⚡',
  },
  {
    level: 5,
    unlockType: 'cosmetic',
    unlockId: 'theme_default_alt',
    title: 'New Theme Available!',
    description: 'You unlocked the "Warm Sunset" color variant 🌅',
    emoji: '🎨',
  },
  {
    level: 7,
    unlockType: 'feature',
    unlockId: 'community_read',
    title: 'Community Access!',
    description: 'You can now browse The Circle community 💬',
    emoji: '👀',
  },
  {
    level: 10,
    unlockType: 'feature',
    unlockId: 'community_post',
    title: 'Community Posting Unlocked!',
    description: 'You can now post and reply in The Circle 🎉',
    emoji: '💬',
  },
  {
    level: 10,
    unlockType: 'cosmetic',
    unlockId: 'outfit_starter_pack',
    title: 'Companion Gift!',
    description: 'A special outfit for your companion — you earned it! 🎁',
    emoji: '🎁',
  },
  {
    level: 12,
    unlockType: 'feature',
    unlockId: 'predictions_extended',
    title: 'Extended Predictions!',
    description: 'See cycle predictions 2 months ahead 📅',
    emoji: '🔮',
  },
  {
    level: 15,
    unlockType: 'feature',
    unlockId: 'insights_advanced',
    title: 'Advanced Insights!',
    description: 'Deeper symptom correlations & patterns revealed ✨',
    emoji: '🧠',
  },
  {
    level: 15,
    unlockType: 'cosmetic',
    unlockId: 'badge_frame_silver',
    title: 'Silver Badge Frame!',
    description: 'A shimmering frame for your badge collection 🪞',
    emoji: '🪞',
  },
  {
    level: 20,
    unlockType: 'cosmetic',
    unlockId: 'avatar_glow',
    title: 'Avatar Glow Effect!',
    description: 'Your profile now radiates a soft glow ✨',
    emoji: '✨',
  },
  {
    level: 20,
    unlockType: 'feature',
    unlockId: 'dottie_predicts',
    title: 'Dottie Predicts!',
    description: 'AI-powered daily predictions based on YOUR patterns 🔮',
    emoji: '🔮',
  },
  {
    level: 25,
    unlockType: 'cosmetic',
    unlockId: 'title_goddess',
    title: '👑 Goddess Title Earned!',
    description: 'Your profile now displays the "Goddess" title. Bow down!',
    emoji: '👑',
  },
  {
    level: 30,
    unlockType: 'cosmetic',
    unlockId: 'companion_legendary_skin',
    title: 'Legendary Companion Skin!',
    description: 'An exclusive shimmering skin for your spirit companion 🦋',
    emoji: '🦋',
  },
  {
    level: 40,
    unlockType: 'cosmetic',
    unlockId: 'theme_aurora',
    title: 'Aurora Theme!',
    description: 'The most beautiful theme — shifting northern lights colors 🌌',
    emoji: '🌌',
  },
  {
    level: 50,
    unlockType: 'cosmetic',
    unlockId: 'title_dottie_master',
    title: '🩷 Dottie Master!',
    description: 'The ultimate title. You\'ve mastered your health journey.',
    emoji: '🩷',
  },
];

// ─── LEVEL JOURNEY MAP ────────────────────────────────────────────────

/**
 * Visual journey map phases — used for the progress visualization.
 * Think of it like a path through beautiful landscapes.
 */
export const JOURNEY_PHASES: JourneyPhase[] = [
  {
    name: 'The Garden',
    levelRange: [1, 5],
    description: 'Planting seeds of awareness',
    backgroundGradient: ['#E8F5E9', '#C8E6C9'],
    illustration: 'garden',
    emoji: '🌱',
  },
  {
    name: 'The Meadow',
    levelRange: [6, 10],
    description: 'Growing stronger every day',
    backgroundGradient: ['#FFF8E1', '#FFECB3'],
    illustration: 'meadow',
    emoji: '🌻',
  },
  {
    name: 'The Mountains',
    levelRange: [11, 15],
    description: 'Climbing to new heights of knowledge',
    backgroundGradient: ['#E3F2FD', '#BBDEFB'],
    illustration: 'mountains',
    emoji: '⛰️',
  },
  {
    name: 'The Stars',
    levelRange: [16, 20],
    description: 'Shining brighter than ever',
    backgroundGradient: ['#EDE7F6', '#D1C4E9'],
    illustration: 'stars',
    emoji: '⭐',
  },
  {
    name: 'The Cosmos',
    levelRange: [21, 25],
    description: 'Beyond limits — you are infinite',
    backgroundGradient: ['#FCE4EC', '#F8BBD0'],
    illustration: 'cosmos',
    emoji: '🪐',
  },
  {
    name: 'The Eternal',
    levelRange: [26, 50],
    description: 'A legend of self-care',
    backgroundGradient: ['#FFF3E0', '#FFE0B2'],
    illustration: 'eternal',
    emoji: '🏆',
  },
];

// ─── LEVEL FUNCTIONS ──────────────────────────────────────────────────

/**
 * Get all unlocks for a specific level.
 */
export function getUnlocksForLevel(level: number): LevelUnlock[] {
  return LEVEL_UNLOCKS.filter(u => u.level === level);
}

/**
 * Get all unlocks earned up to (and including) the current level.
 */
export function getAllUnlockedItems(currentLevel: number): LevelUnlock[] {
  return LEVEL_UNLOCKS.filter(u => u.level <= currentLevel);
}

/**
 * Get the next unlock the user is approaching.
 * Used for motivation: "Level 10 unlocks Community Posting!"
 */
export function getNextUnlockPreview(currentLevel: number): LevelUnlockPreview | null {
  const nextUnlock = LEVEL_UNLOCKS.find(u => u.level > currentLevel);
  if (!nextUnlock) return null;

  const levelsAway = nextUnlock.level - currentLevel;

  return {
    unlock: nextUnlock,
    levelsAway,
    message: `${levelsAway} level${levelsAway > 1 ? 's' : ''} until: ${nextUnlock.emoji} ${nextUnlock.title}`,
  };
}

/**
 * Get the current journey phase based on user level.
 */
export function getCurrentJourneyPhase(currentLevel: number): JourneyPhase {
  for (const phase of JOURNEY_PHASES) {
    if (currentLevel >= phase.levelRange[0] && currentLevel <= phase.levelRange[1]) {
      return phase;
    }
  }
  // Default to last phase for very high levels
  return JOURNEY_PHASES[JOURNEY_PHASES.length - 1];
}

/**
 * Get journey progress data for the visual map.
 * Shows where user is on the overall journey.
 */
export function getJourneyProgress(currentLevel: number): JourneyProgress {
  const currentPhase = getCurrentJourneyPhase(currentLevel);
  const phaseIndex = JOURNEY_PHASES.indexOf(currentPhase);
  const [phaseStart, phaseEnd] = currentPhase.levelRange;
  const phaseProgress = (currentLevel - phaseStart) / (phaseEnd - phaseStart + 1);

  const overallProgress = currentLevel / 50; // 50 is max level

  return {
    currentPhase,
    phaseIndex,
    phaseProgress: Math.min(1.0, phaseProgress),
    overallProgress: Math.min(1.0, overallProgress),
    totalPhases: JOURNEY_PHASES.length,
    completedPhases: phaseIndex,
    isMaxPhase: phaseIndex === JOURNEY_PHASES.length - 1,
  };
}

/**
 * Calculate estimated days to reach next level based on average daily XP.
 *
 * @param currentXP - Total XP
 * @param avgDailyXP - Average XP earned per day (from recent history)
 * @returns Estimated days, or null if already max level
 */
export function estimateDaysToNextLevel(
  currentXP: number,
  avgDailyXP: number
): number | null {
  if (avgDailyXP <= 0) return null;

  const currentLevel = getLevelFromDefinitions(currentXP);
  const nextLevel = getNextLevelDefinition(currentLevel.level);
  if (!nextLevel) return null; // Max level

  const xpNeeded = nextLevel.xpRequired - currentXP;
  if (xpNeeded <= 0) return 0;

  return Math.ceil(xpNeeded / avgDailyXP);
}

/**
 * Get the level-up celebration configuration.
 */
export function getLevelUpCelebration(newLevel: LevelDefinition): LevelUpCelebration {
  const isMajor = newLevel.level % 5 === 0 || newLevel.level >= 25;
  const unlocks = getUnlocksForLevel(newLevel.level);

  return {
    level: newLevel,
    isMajorMilestone: isMajor,
    animationType: isMajor ? 'fireworks' : 'confetti',
    companionReaction: isMajor ? 'celebrating' : 'proud',
    title: `Level ${newLevel.level}!`,
    subtitle: `${newLevel.emoji} ${newLevel.name}`,
    description: getLevelUpDescription(newLevel.level),
    unlocks,
    showFullScreen: isMajor,
  };
}

/**
 * Get summary stats for the profile level display.
 */
export function getLevelSummary(
  currentXP: number,
  currentLevel: number
): LevelSummary {
  const levelDef = LEVEL_DEFINITIONS.find(l => l.level === currentLevel) ?? LEVEL_DEFINITIONS[0];
  const nextLevel = getNextLevelDefinition(currentLevel);
  const journeyPhase = getCurrentJourneyPhase(currentLevel);

  let xpToNext = 0;
  let progressPercent = 1.0;

  if (nextLevel) {
    const xpInLevel = currentXP - levelDef.xpRequired;
    const xpForLevel = nextLevel.xpRequired - levelDef.xpRequired;
    xpToNext = nextLevel.xpRequired - currentXP;
    progressPercent = Math.min(1.0, xpInLevel / xpForLevel);
  }

  return {
    level: currentLevel,
    levelName: levelDef.name,
    levelEmoji: levelDef.emoji,
    totalXP: currentXP,
    xpToNextLevel: xpToNext,
    progressPercent,
    journeyPhaseName: journeyPhase.name,
    journeyPhaseEmoji: journeyPhase.emoji,
    isMaxLevel: !nextLevel,
  };
}

// ─── HELPER TYPES ────────────────────────────────────────────────────

export type UnlockType = 'feature' | 'cosmetic';

export interface LevelUnlock {
  level: number;
  unlockType: UnlockType;
  unlockId: string;
  title: string;
  description: string;
  emoji: string;
}

export interface LevelUnlockPreview {
  unlock: LevelUnlock;
  levelsAway: number;
  message: string;
}

export interface JourneyPhase {
  name: string;
  levelRange: [number, number];
  description: string;
  backgroundGradient: [string, string];
  illustration: string;
  emoji: string;
}

export interface JourneyProgress {
  currentPhase: JourneyPhase;
  phaseIndex: number;
  phaseProgress: number;       // 0.0 - 1.0 within current phase
  overallProgress: number;     // 0.0 - 1.0 overall journey
  totalPhases: number;
  completedPhases: number;
  isMaxPhase: boolean;
}

export interface LevelUpCelebration {
  level: LevelDefinition;
  isMajorMilestone: boolean;
  animationType: 'confetti' | 'fireworks';
  companionReaction: 'celebrating' | 'proud' | 'happy';
  title: string;
  subtitle: string;
  description: string;
  unlocks: LevelUnlock[];
  showFullScreen: boolean;
}

export interface LevelSummary {
  level: number;
  levelName: string;
  levelEmoji: string;
  totalXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  journeyPhaseName: string;
  journeyPhaseEmoji: string;
  isMaxLevel: boolean;
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

function getLevelFromDefinitions(totalXP: number): LevelDefinition {
  let current = LEVEL_DEFINITIONS[0];
  for (const level of LEVEL_DEFINITIONS) {
    if (totalXP >= level.xpRequired) {
      current = level;
    } else {
      break;
    }
  }
  return current;
}

function getNextLevelDefinition(currentLevel: number): LevelDefinition | null {
  const index = LEVEL_DEFINITIONS.findIndex(l => l.level === currentLevel);
  if (index === -1 || index >= LEVEL_DEFINITIONS.length - 1) return null;
  return LEVEL_DEFINITIONS[index + 1];
}

function getLevelUpDescription(level: number): string {
  if (level <= 5) return 'You\'re building beautiful habits! Keep growing 🌱';
  if (level <= 10) return 'Your consistency is inspiring. You really show up for yourself! 💪';
  if (level <= 15) return 'Knowledge AND dedication — you\'re unstoppable! 🧠';
  if (level <= 20) return 'You understand your body like few people do. Incredible! ✨';
  if (level <= 25) return 'You\'ve reached mastery. Your health journey is a work of art 👑';
  if (level <= 35) return 'Legend status. You inspire everyone around you 🏆';
  if (level <= 45) return 'Transcendent. Your dedication spans seasons and cycles 🌈';
  return 'Dottie Master — the ultimate honor. You are extraordinary 🩷';
}
