/**
 * Dottie — Spirit Companion Definitions
 *
 * Six unique companions, each with a distinct personality that shapes
 * how Dottie speaks to the user. The companion is chosen once during
 * onboarding (changeable later) and becomes the user's daily guide.
 *
 * DESIGN PHILOSOPHY:
 * Each companion is a "voice layer" on top of shared content.
 * The WHAT (insights, questions, tips) is the same for every user
 * in the same cohort state. The HOW (tone, vocabulary, emoji) is the
 * companion. This is a cheap, local string-template swap — never a
 * server call.
 *
 * THE SIX COMPANIONS:
 *   🦊 Fox / "Luna"      — Wise, gentle, encouraging
 *   🐰 Bunny / "Pip"     — Playful, energetic, celebratory
 *   🦋 Butterfly / "Mira" — Calm, poetic, reflective
 *   🐱 Cat / "Nyx"       — Sassy, direct, humorous
 *   🦉 Owl / "Sage"      — Intellectual, factual, teaching-focused
 *   🌸 Blossom / "Dottie" — Warm, caring, big-sister vibe (the OG)
 *
 * USAGE:
 *   import { COMPANIONS, getCompanion } from '@/content/companions';
 *   const luna = getCompanion('fox');
 *   const greeting = luna.greetings.follicular;
 */

import {
  CompanionType,
  CompanionDefinition,
  CompanionOutfit,
} from '../types/companion.types';
import { Colors } from '../constants/colors';

// ─── COMPANION DEFINITIONS ────────────────────────────────────────────

/**
 * The six core companions, keyed by type.
 * Each has a name, personality archetype, default greetings per phase,
 * and a dialogue style description used by the dialogue engine.
 */
export const COMPANIONS: Record<CompanionType, CompanionDefinition> = {
  // ─── 🦊 LUNA THE FOX ───────────────────────────────────────────────
  fox: {
    type: 'fox',
    name: 'Luna',
    personality: 'wise',
    emoji: '🦊',
    tagline: 'Your gentle guide through every phase',
    description:
      'Luna is the thoughtful one — she notices the small things and ' +
      'speaks softly. She’ll help you understand your body without ever ' +
      'making it feel like a science lecture.',
    accentColor: Colors.companion.fox,
    dialogueStyle:
      'Gentle, observant, encouraging. Uses warm metaphors. Asks ' +
      'questions rather than declaring. Never preachy.',
    greetings: {
      menstrual:
        'Hey, soft soul. Your body is doing brave work today — let’s be gentle together 🦊',
      follicular:
        'I see new energy rising in you. What feels possible today? 🦊',
      ovulatory:
        'You’re glowing — and I noticed. Today’s a beautiful day to shine 🦊',
      luteal:
        'Slow seasons hold wisdom too. I’m here, however the day unfolds 🦊',
    },
  },

  // ─── 🐰 PIP THE BUNNY ──────────────────────────────────────────────
  bunny: {
    type: 'bunny',
    name: 'Pip',
    personality: 'playful',
    emoji: '🐰',
    tagline: 'Bouncy, bright, and always cheering you on',
    description:
      'Pip is pure sunshine — she celebrates EVERYTHING. Tracked your ' +
      'mood? YAY! Logged a symptom? AMAZING! Started your period? She’s ' +
      'bringing you a virtual cup of cocoa.',
    accentColor: Colors.companion.bunny,
    dialogueStyle:
      'Energetic, celebratory, lots of exclamation marks. Uses words like ' +
      '“YAY!”, “LET’S GO!”, “you’re AMAZING!”. Never sarcastic.',
    greetings: {
      menstrual:
        'Hi hi hi!! Period days = couch + snacks + ALL the love. Got you 🐰💛',
      follicular:
        'Heyyy energy!! I can FEEL the spark in you today — let’s gooo!! 🐰✨',
      ovulatory:
        'OMG hi! You’re glowing like a disco ball and I am LIVING for it!! 🐰🌟',
      luteal:
        'Soft hugs incoming!! Whatever today is, we’re in it together 🐰🤗',
    },
  },

  // ─── 🦋 MIRA THE BUTTERFLY ─────────────────────────────────────────
  butterfly: {
    type: 'butterfly',
    name: 'Mira',
    personality: 'calm',
    emoji: '🦋',
    tagline: 'A quiet, poetic presence',
    description:
      'Mira speaks like a breeze through wildflowers. She notices ' +
      'rhythms, transitions, and the beauty in small moments. Perfect ' +
      'if you want your daily check-in to feel like meditation.',
    accentColor: Colors.companion.butterfly,
    dialogueStyle:
      'Poetic, calm, contemplative. Uses nature imagery. Short, gentle ' +
      'sentences. Speaks of seasons, tides, and quiet truths.',
    greetings: {
      menstrual:
        'A new tide begins. Soften, rest, let the wave carry you 🦋',
      follicular:
        'Buds opening, light returning. What wants to bloom in you today? 🦋',
      ovulatory:
        'Petals fully open. You are radiant — let yourself be seen 🦋',
      luteal:
        'The day grows quieter. Listen inward. The answers are already there 🦋',
    },
  },

  // ─── 🐱 NYX THE CAT ────────────────────────────────────────────────
  cat: {
    type: 'cat',
    name: 'Nyx',
    personality: 'sassy',
    emoji: '🐱',
    tagline: 'Real talk, zero fluff, all heart',
    description:
      'Nyx says the things your best friend says when no one’s listening. ' +
      'Sassy, sharp, secretly soft. She’ll roast your bad sleep habits ' +
      'and then bring you a heating pad.',
    accentColor: Colors.companion.cat,
    dialogueStyle:
      'Witty, direct, slightly sarcastic but always warm underneath. ' +
      'Uses casual modern slang. Mocks the “wellness industrial complex.”',
    greetings: {
      menstrual:
        'Day 1 energy: same as me before my 3pm nap. Rest is the move 😼',
      follicular:
        'Oh, look who has energy today. Use it wisely — or chaotically. Your call 😼',
      ovulatory:
        'You’re main character today. Carry yourself accordingly 😼💅',
      luteal:
        'Feeling Some Type Of Way? Same. We’ll get through it together 😼',
    },
  },

  // ─── 🦉 SAGE THE OWL ───────────────────────────────────────────────
  owl: {
    type: 'owl',
    name: 'Sage',
    personality: 'intellectual',
    emoji: '🦉',
    tagline: 'For the curious — facts and warmth in equal measure',
    description:
      'Sage is the friend who knows exactly why you feel the way you do — ' +
      'and explains it without ever talking down. Perfect if you want to ' +
      'understand the science behind your cycle.',
    accentColor: Colors.companion.owl,
    dialogueStyle:
      'Curious, factual, warm. Drops “fun facts” often. Uses precise ' +
      'language but never clinical. Always connects science to feeling.',
    greetings: {
      menstrual:
        'Fun fact: prostaglandins peak on day 1 — which is why you feel what you feel. Be kind to yourself 🦉',
      follicular:
        'Estrogen is climbing — your memory and focus may feel sharper today. Beautiful day to learn something new 🦉',
      ovulatory:
        'LH surge time! Your verbal fluency and social ease tend to peak around now. Enjoy it 🦉',
      luteal:
        'Progesterone is doing its quiet work. If you feel slower, that’s biology — not weakness 🦉',
    },
  },

  // ─── 🌸 DOTTIE THE BLOSSOM ─────────────────────────────────────────
  blossom: {
    type: 'blossom',
    name: 'Dottie',
    personality: 'nurturing',
    emoji: '🌸',
    tagline: 'The original — your big-sister in your pocket',
    description:
      'Dottie is the warm, wise big sister you always wanted. She shows ' +
      'up every day with kindness, never judges, and remembers what you ' +
      'told her last week. The OG.',
    accentColor: Colors.companion.blossom,
    dialogueStyle:
      'Warm, supportive, sisterly. Uses pet names sparingly (“love”, ' +
      '“you”). Validates feelings first, gives info second. Heart-led.',
    greetings: {
      menstrual:
        'Hey love. Period days are sacred — take what you need today 🌸',
      follicular:
        'Look at you, showing up again. I’m so proud of how you keep going 🌸',
      ovulatory:
        'You’re radiant today — and I hope you can feel it too 🌸',
      luteal:
        'Soft days call for soft love. I’m right here with you 🌸',
    },
  },
};

// ─── COMPANION LOOKUP HELPERS ─────────────────────────────────────────

/**
 * Get a companion definition by type.
 */
export function getCompanion(type: CompanionType): CompanionDefinition {
  return COMPANIONS[type] ?? COMPANIONS.blossom;
}

/**
 * Get all companions as an array (for selection screens).
 */
export function getAllCompanions(): CompanionDefinition[] {
  return Object.values(COMPANIONS);
}

/**
 * Get the default companion (Blossom/Dottie — the OG).
 */
export function getDefaultCompanion(): CompanionDefinition {
  return COMPANIONS.blossom;
}

/**
 * Find a companion by name (case-insensitive).
 * Returns null if no match.
 */
export function findCompanionByName(name: string): CompanionDefinition | null {
  const normalized = name.toLowerCase().trim();
  return (
    getAllCompanions().find(c => c.name.toLowerCase() === normalized) ?? null
  );
}

// ─── DEFAULT COMPANION OUTFITS ────────────────────────────────────────

/**
 * Default outfit catalog — seasonal & themed accessories purchasable with gems.
 * These hook into the Gem Store engine. Outfit IDs match gem store item IDs
 * where applicable (e.g., 'outfit_winter_scarf').
 *
 * Categories:
 *   - SEASONAL: Limited-time (winter, summer, autumn, spring, holiday)
 *   - PHASE-AWARE: Match user's current phase (period blanket, ovulation glow)
 *   - UNIVERSAL: Always available, fit any companion
 */
export const COMPANION_OUTFITS: CompanionOutfit[] = [
  // ─── Universal — fit all companions ───────────────────────────��────
  {
    id: 'outfit_winter_scarf',
    name: 'Cozy Winter Scarf',
    slot: 'scarf',
    emoji: '🧣',
    gemCost: 75,
    seasonal: true,
    season: 'winter',
    compatibleWith: [],
    description: 'A soft knit scarf — perfect for cold days and cramp days alike.',
  },
  {
    id: 'outfit_summer_hat',
    name: 'Beach Sun Hat',
    slot: 'hat',
    emoji: '👒',
    gemCost: 75,
    seasonal: true,
    season: 'summer',
    compatibleWith: [],
    description: 'Wide brim, sunny vibes. Ready for the beach.',
  },
  {
    id: 'outfit_flower_crown',
    name: 'Wildflower Crown',
    slot: 'hat',
    emoji: '💐',
    gemCost: 100,
    seasonal: true,
    season: 'spring',
    compatibleWith: [],
    description: 'A crown of fresh spring blooms.',
  },
  {
    id: 'outfit_rainbow_cape',
    name: 'Rainbow Cape',
    slot: 'accessory',
    emoji: '🌈',
    gemCost: 120,
    seasonal: false,
    compatibleWith: [],
    description: 'A celebration of every color. Pride year-round.',
  },
  {
    id: 'outfit_cozy_blanket',
    name: 'Cozy Blanket Wrap',
    slot: 'accessory',
    emoji: '🧸',
    gemCost: 90,
    seasonal: false,
    compatibleWith: [],
    description: 'Soft, warm, and ready for rest days.',
  },
  {
    id: 'outfit_party_hat',
    name: 'Party Hat',
    slot: 'hat',
    emoji: '🎉',
    gemCost: 80,
    seasonal: false,
    compatibleWith: [],
    description: 'Every milestone deserves a party.',
  },

  // ─── Effects — visual flair around the companion ───────────────────
  {
    id: 'outfit_sparkle_effect',
    name: 'Sparkle Aura',
    slot: 'effect',
    emoji: '✨',
    gemCost: 100,
    seasonal: false,
    compatibleWith: [],
    description: 'A shimmering halo of sparkles around your companion.',
  },
  {
    id: 'outfit_heart_effect',
    name: 'Floating Hearts',
    slot: 'effect',
    emoji: '💖',
    gemCost: 100,
    seasonal: false,
    compatibleWith: [],
    description: 'Tiny hearts that drift gently around your companion.',
  },

  // ─── Backgrounds — themed scenes behind the companion ──────────────
  {
    id: 'outfit_bg_garden',
    name: 'Garden Scene',
    slot: 'background',
    emoji: '🌷',
    gemCost: 150,
    seasonal: false,
    compatibleWith: [],
    description: 'A peaceful garden filled with spring blooms.',
  },
  {
    id: 'outfit_bg_starry_night',
    name: 'Starry Night',
    slot: 'background',
    emoji: '🌌',
    gemCost: 180,
    seasonal: false,
    compatibleWith: [],
    description: 'A dreamy nightscape with twinkling stars.',
  },
  {
    id: 'outfit_bg_meadow',
    name: 'Sunset Meadow',
    slot: 'background',
    emoji: '🌅',
    gemCost: 150,
    seasonal: false,
    compatibleWith: [],
    description: 'Golden hour over a wildflower meadow.',
  },

  // ─── Companion-specific outfits ────────────────────────────────────
  {
    id: 'outfit_fox_glasses',
    name: 'Wisdom Glasses',
    slot: 'accessory',
    emoji: '🤓',
    gemCost: 60,
    seasonal: false,
    compatibleWith: ['fox', 'owl'],
    description: 'Tiny round glasses for the thinkers (Luna & Sage).',
  },
  {
    id: 'outfit_bunny_bowtie',
    name: 'Polka Dot Bowtie',
    slot: 'accessory',
    emoji: '🎀',
    gemCost: 50,
    seasonal: false,
    compatibleWith: ['bunny', 'cat'],
    description: 'A jaunty bowtie for the playful spirits (Pip & Nyx).',
  },
  {
    id: 'outfit_butterfly_wings',
    name: 'Iridescent Wings',
    slot: 'effect',
    emoji: '🦋',
    gemCost: 120,
    seasonal: false,
    compatibleWith: ['butterfly'],
    description: 'Shimmering rainbow wings for Mira.',
  },
];

// ─── OUTFIT HELPERS ───────────────────────────────────────────────────

/**
 * Get an outfit definition by ID.
 */
export function getOutfit(id: string): CompanionOutfit | null {
  return COMPANION_OUTFITS.find(o => o.id === id) ?? null;
}

/**
 * Get all outfits compatible with a specific companion.
 * An outfit is compatible if compatibleWith is empty (universal) or
 * explicitly includes the companion type.
 */
export function getOutfitsForCompanion(type: CompanionType): CompanionOutfit[] {
  return COMPANION_OUTFITS.filter(
    o => o.compatibleWith.length === 0 || o.compatibleWith.includes(type)
  );
}

/**
 * Get outfits available for a specific slot.
 */
export function getOutfitsBySlot(slot: CompanionOutfit['slot']): CompanionOutfit[] {
  return COMPANION_OUTFITS.filter(o => o.slot === slot);
}

/**
 * Get seasonal outfits for a given season.
 */
export function getSeasonalOutfits(
  season: NonNullable<CompanionOutfit['season']>
): CompanionOutfit[] {
  return COMPANION_OUTFITS.filter(o => o.seasonal && o.season === season);
}

// ─── COMPANION PHASE-AWARE MOOD MAPPING ───────────────────────────────

/**
 * Default mood overlays per phase per companion.
 * The companion-dialogue engine combines these with user-behavior
 * triggers (streak, badges, etc.) to pick the right reaction.
 *
 * This is the BASE mood — behavior triggers override when they fire.
 */
export const COMPANION_PHASE_MOODS: Record<
  CompanionType,
  Record<
    'menstrual' | 'follicular' | 'ovulatory' | 'luteal',
    'happy' | 'celebrating' | 'supportive' | 'cozy' | 'proud' | 'excited'
  >
> = {
  fox: {
    menstrual: 'supportive',
    follicular: 'happy',
    ovulatory: 'proud',
    luteal: 'cozy',
  },
  bunny: {
    menstrual: 'cozy',
    follicular: 'excited',
    ovulatory: 'celebrating',
    luteal: 'happy',
  },
  butterfly: {
    menstrual: 'supportive',
    follicular: 'happy',
    ovulatory: 'happy',
    luteal: 'supportive',
  },
  cat: {
    menstrual: 'cozy',
    follicular: 'happy',
    ovulatory: 'proud',
    luteal: 'supportive',
  },
  owl: {
    menstrual: 'supportive',
    follicular: 'happy',
    ovulatory: 'proud',
    luteal: 'happy',
  },
  blossom: {
    menstrual: 'supportive',
    follicular: 'happy',
    ovulatory: 'proud',
    luteal: 'cozy',
  },
};
