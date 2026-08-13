/**
 * Dottie — Companion Types
 *
 * Spirit Companion system — each user picks a personal companion
 * that guides them through their health journey.
 *
 * Companions have:
 * - Unique personality (affects dialogue tone)
 * - Emotional states (react to user behavior)
 * - Outfits/accessories (purchasable with gems)
 * - Phase-aware greetings
 *
 * DESIGN: The companion personality is just a "wrapper" layer on shared content.
 * Expensive computation (WHAT to show) is shared across all users in same state.
 * Cheap personalization (HOW to say it) is a local string template swap.
 */

import { Phase } from './cycle.types';

// ─── COMPANION IDENTITY ──────────────────────────────────────────────

/** Available spirit companion types */
export type CompanionType = 'fox' | 'bunny' | 'butterfly' | 'cat' | 'owl' | 'blossom';

/** Companion personality archetype */
export type CompanionPersonality =
  | 'wise'        // Fox — gentle, encouraging
  | 'playful'     // Bunny — energetic, celebratory
  | 'calm'        // Butterfly — poetic, reflective
  | 'sassy'       // Cat — direct, humorous
  | 'intellectual' // Owl — factual, teaching
  | 'nurturing';  // Blossom — warm, big-sister

/** Full companion definition */
export interface CompanionDefinition {
  type: CompanionType;
  name: string;
  personality: CompanionPersonality;
  emoji: string;
  /** Short personality tagline shown in selection */
  tagline: string;
  /** Longer description for companion picker */
  description: string;
  /** Accent color (matches Colors.companion[type]) */
  accentColor: string;
  /** Default greeting templates per phase */
  greetings: Record<Phase, string>;
  /** Dialogue style description (for content generation) */
  dialogueStyle: string;
}

// ─── COMPANION EMOTIONAL STATES ──────────────────────────────────────

/** Companion mood states (react to user behavior) */
export type CompanionMood =
  | 'happy'       // User logged today
  | 'celebrating' // Milestone reached (streak, badge, level-up)
  | 'sleepy'      // User hasn't opened app in 2+ days
  | 'supportive'  // User logged pain or low mood
  | 'proud'       // User completed a lesson or quiz
  | 'cozy'        // User activated Cramp Freeze
  | 'excited'     // User about to hit streak milestone
  | 'neutral';    // Default/idle state

/** What triggers companion mood changes */
export interface MoodTrigger {
  mood: CompanionMood;
  condition: MoodCondition;
  priority: number; // Higher = takes precedence when multiple apply
}

/** Conditions that trigger mood changes */
export type MoodCondition =
  | 'checked_in_today'
  | 'streak_milestone'
  | 'badge_unlocked'
  | 'level_up'
  | 'inactive_2_days'
  | 'inactive_5_days'
  | 'logged_high_pain'
  | 'logged_low_mood'
  | 'lesson_completed'
  | 'quiz_passed'
  | 'cramp_freeze_used'
  | 'near_streak_milestone'
  | 'first_open_today';

// ─── COMPANION DIALOGUE ──────────────────────────────────────────────

/** A dialogue template with placeholder support */
export interface CompanionDialogue {
  id: string;
  companionType: CompanionType;
  mood: CompanionMood;
  phase: Phase | 'any';
  /** Template string with {{placeholders}} */
  template: string;
  /** Emoji suffix to append */
  emoji: string;
}

/**
 * Dialogue context — variables available for template interpolation.
 * Example template: "{{companion_name}} thinks day {{day_in_phase}} is special!"
 */
export interface DialogueContext {
  companion_name: string;
  phase_name: string;
  day_in_phase: number;
  day_in_cycle: number;
  streak_count: number;
  user_mood?: string;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
}

// ─── COMPANION CUSTOMIZATION ─────────────────────────────────────────

/** Outfit/accessory slot types */
export type OutfitSlot = 'hat' | 'scarf' | 'background' | 'effect' | 'accessory';

/** A purchasable outfit/accessory item */
export interface CompanionOutfit {
  id: string;
  name: string;
  slot: OutfitSlot;
  emoji: string;
  /** Gem cost (0 = included free with companion) */
  gemCost: number;
  /** Whether this is a limited-time seasonal item */
  seasonal: boolean;
  /** Season tag if seasonal */
  season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'holiday';
  /** Compatible companion types (empty = all) */
  compatibleWith: CompanionType[];
  /** Visual description for accessibility */
  description: string;
}

/** User's current companion configuration */
export interface CompanionConfig {
  type: CompanionType;
  equippedOutfits: Record<OutfitSlot, string | null>; // outfit IDs
  unlockedOutfits: string[]; // outfit IDs user owns
}

// ─── COMPANION REACTIONS ─────────────────────────────────────────────

/** Animation types the companion can play */
export type CompanionAnimation =
  | 'wave'        // First open of the day
  | 'bounce'      // Celebration
  | 'sleep'       // Idle / inactive
  | 'hug'         // Supportive moment
  | 'dance'       // Big achievement
  | 'nod'         // Acknowledging check-in
  | 'sparkle'     // Level up / badge
  | 'cozy_wrap';  // Cramp freeze / period comfort

/** A companion reaction (animation + dialogue) */
export interface CompanionReaction {
  trigger: MoodCondition;
  animation: CompanionAnimation;
  /** Dialogue template ID to use */
  dialogueId: string;
  /** Duration of animation in milliseconds */
  durationMs: number;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** All available companions (used for selection screen) */
export const COMPANION_TYPES: CompanionType[] = [
  'fox', 'bunny', 'butterfly', 'cat', 'owl', 'blossom',
];

/** Mood priority order (higher index = higher priority) */
export const MOOD_PRIORITY: CompanionMood[] = [
  'neutral',
  'happy',
  'sleepy',
  'excited',
  'proud',
  'cozy',
  'supportive',
  'celebrating',
];
