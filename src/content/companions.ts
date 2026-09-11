/**
 * Dottie — the voice
 *
 * ─── WHAT THIS FILE USED TO BE (and why it is not, DT30) ────────────
 *
 *  Six "spirit companions" — Luna the fox, Pip the bunny, Mira, Nyx, Sage and
 *  Dottie — each with its own name, emoji, accent colour and per-phase
 *  greetings, chosen once in onboarding and shown on every screen.
 *
 *  The owner removed them:
 *
 *      "Let's ditch the entire companion thing ... no more companions.
 *       Remove the screen."
 *
 *  Four device rounds went into that character art and it never landed. So the
 *  app has ONE voice now — Dottie's, the original — and no character to pick.
 *  `getCompanion()` ignores its argument and returns her; the saved
 *  `companionType` on old installs is inert rather than migrated, which keeps
 *  a stored value from ever putting a fox back on screen.
 *
 *  The type union stays because the database column and a few sample rows are
 *  typed by it. It selects nothing any more.
 */


import {
  CompanionType,
  CompanionDefinition,
  CompanionOutfit,
} from '../types/companion.types';
import { Colors } from '../constants/colors';

// ─── COMPANION DEFINITIONS ────────────────────────────────────────────

/** The one voice. Warm, caring, big-sister — the original Dottie. */
export const DOTTIE: CompanionDefinition = {
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
};

/**
 * Kept keyed by the old union so the database column and the community sample
 * rows still type-check. Every key is the same voice — there is nothing to
 * choose between.
 */
export const COMPANIONS: Record<CompanionType, CompanionDefinition> = {
  fox: DOTTIE, bunny: DOTTIE, butterfly: DOTTIE, cat: DOTTIE, owl: DOTTIE, blossom: DOTTIE,
};

// ─── COMPANION LOOKUP HELPERS ─────────────────────────────────────────

/**
 * The voice. The argument is ignored — it exists only so the call sites that
 * still pass a stored `companionType` keep compiling (DT30).
 */
export function getCompanion(_type?: CompanionType): CompanionDefinition {
  return DOTTIE;
}

/** The default. Same as every other answer. */
export function getDefaultCompanion(): CompanionDefinition {
  return DOTTIE;
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
