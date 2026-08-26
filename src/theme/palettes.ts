/**
 * Dottie — Aurora Palettes (design-v2)
 *
 * The token sets behind the "Mood Aurora" direction: one glass/clay/aurora
 * system that wears a different palette per the user's logged mood. This is
 * PURE DATA — the single source of truth every screen reads its colours from,
 * so re-theming the whole app is a one-value change (the active palette id),
 * not a hunt through stylesheets.
 *
 * ─── DESIGN PRINCIPLE THAT SHAPED THIS ──────────────────────────────
 *
 *  The "harder" moods (low / rough) map to WARM, SOOTHING palettes
 *  (Twilight, Ember) — never dark, grey, or punishing. A health app that
 *  visually dims when someone feels low can quietly reinforce the low mood.
 *  The app should meet a hard day gently. (apple-design · Responsibility)
 *
 * ─── HOW IT'S CONSUMED (planned) ────────────────────────────────────
 *
 *  A ThemeProvider holds the active `AuroraPalette` (default Nocturne,
 *  swapped to `paletteForMood(latestCheckIn.moodScore)` after a check-in),
 *  cross-fades on change, and exposes it via `useAurora()`. Components read
 *  `palette.accent`, `palette.glass`, etc. Gradients use `expo-linear-gradient`;
 *  the aurora blobs are absolutely-positioned blurred views. See
 *  `.claude/skills/animate-expo` for the motion (transform/opacity only,
 *  cross-fade on palette change, Reduce-Motion aware).
 *
 *  NB: hex values are lifted verbatim from the approved Aurora mockups so the
 *  build matches the visualization exactly — do not round or "tidy" them.
 */

// ─── TYPES ───────────────────────────────────────────────────────────

export type MoodPaletteId = 'nocturne' | 'radiance' | 'meadow' | 'twilight' | 'ember';

export interface AuroraGlass {
  /** translucent panel fill */
  bg: string;
  /** hairline border */
  edge: string;
  /** bright top inner edge (light catching the material) */
  top: string;
  /** drop shadow (rgba) */
  shadow: string;
}

export interface AuroraClay {
  /** soft-control gradient high stop */
  hi: string;
  /** soft-control gradient low stop */
  lo: string;
}

export interface AuroraPalette {
  id: MoodPaletteId;
  /** display name (settings / debug) */
  name: string;
  /** the feeling this palette expresses */
  mood: string;
  /** screen ground behind the aurora */
  ground: string;
  /** the four aurora bloom hues (a1..a4) */
  aurora: readonly [string, string, string, string];
  /** primary accent (ring/active/glow) */
  accent: string;
  /** secondary accent (gradient partner) */
  accent2: string;
  /** accent glow (rgba, for shadows/blooms) */
  accentGlow: string;
  /** text: primary / secondary / tertiary */
  ink: string;
  ink2: string;
  ink3: string;
  glass: AuroraGlass;
  clay: AuroraClay;
}

// ─── PHASE HUES (constant across moods) ──────────────────────────────
//
// Phase identity must NOT shift with mood — the phase lives in the cycle
// ring and calendar and stays legible/consistent. Mood owns the atmosphere;
// phase owns the ring.
export const PHASE_AURORA = {
  menstrual: '#FF6FA5',
  follicular: '#54E6C8',
  ovulatory: '#FFC24D',
  luteal: '#9B7BFF',
} as const;

// ─── PALETTES ────────────────────────────────────────────────────────

export const AURORA_PALETTES: Record<MoodPaletteId, AuroraPalette> = {
  // okay 😐 — the calm, balanced default (also the pre-log state)
  nocturne: {
    id: 'nocturne',
    name: 'Nocturne',
    mood: 'steady',
    ground: '#0C0A16',
    aurora: ['#9B7BFF', '#54E6C8', '#FF6FA5', '#FFB27A'],
    accent: '#54E6C8',
    accent2: '#9B7BFF',
    accentGlow: 'rgba(155,123,255,0.40)',
    ink: '#F3EEFF',
    ink2: '#B8AED6',
    ink3: '#8B82A8',
    glass: {
      bg: 'rgba(255,255,255,0.06)',
      edge: 'rgba(255,255,255,0.16)',
      top: 'rgba(255,255,255,0.28)',
      shadow: 'rgba(0,0,0,0.60)',
    },
    clay: { hi: '#2a2440', lo: '#191428' },
  },

  // great 😊 — sunny, celebratory
  radiance: {
    id: 'radiance',
    name: 'Radiance',
    mood: 'radiant',
    ground: '#170F08',
    aurora: ['#FFC24D', '#FF9A5B', '#FF6FA5', '#FFE08A'],
    accent: '#FFC24D',
    accent2: '#FF8A5B',
    accentGlow: 'rgba(255,194,77,0.42)',
    ink: '#FFF6E9',
    ink2: '#E7CFA8',
    ink3: '#B09A78',
    glass: {
      bg: 'rgba(255,246,232,0.07)',
      edge: 'rgba(255,225,180,0.18)',
      top: 'rgba(255,238,210,0.30)',
      shadow: 'rgba(40,24,4,0.62)',
    },
    clay: { hi: '#3a2e18', lo: '#241a0c' },
  },

  // good 🙂 — fresh, upbeat
  meadow: {
    id: 'meadow',
    name: 'Meadow',
    mood: 'fresh',
    ground: '#07160F',
    aurora: ['#6FE6A8', '#54E6C8', '#8CE06B', '#B9F0C4'],
    accent: '#54E6C8',
    accent2: '#6FE6A8',
    accentGlow: 'rgba(84,230,200,0.40)',
    ink: '#EAFFF4',
    ink2: '#AFD8C4',
    ink3: '#7CA692',
    glass: {
      bg: 'rgba(230,255,244,0.06)',
      edge: 'rgba(200,255,225,0.16)',
      top: 'rgba(220,255,238,0.28)',
      shadow: 'rgba(0,26,16,0.60)',
    },
    clay: { hi: '#153025', lo: '#0b1e16' },
  },

  // low 😔 — soft, soothing (gentle, NOT grey)
  twilight: {
    id: 'twilight',
    name: 'Twilight',
    mood: 'held',
    ground: '#0B0D1C',
    aurora: ['#8FA3FF', '#B79BFF', '#7FD0FF', '#C9B8FF'],
    accent: '#9FB0FF',
    accent2: '#B79BFF',
    accentGlow: 'rgba(143,163,255,0.40)',
    ink: '#EFF0FF',
    ink2: '#BAC0E6',
    ink3: '#8890B8',
    glass: {
      bg: 'rgba(235,238,255,0.06)',
      edge: 'rgba(210,218,255,0.16)',
      top: 'rgba(225,230,255,0.28)',
      shadow: 'rgba(4,6,26,0.60)',
    },
    clay: { hi: '#232842', lo: '#141830' },
  },

  // rough 😤 — warm, grounding (a hug, NOT a warning)
  ember: {
    id: 'ember',
    name: 'Ember',
    mood: 'grounded',
    ground: '#160810',
    aurora: ['#FF8A6B', '#FF6FA5', '#C86BFF', '#FFB27A'],
    accent: '#FF8A7A',
    accent2: '#FF6FA5',
    accentGlow: 'rgba(255,111,90,0.40)',
    ink: '#FFF0EC',
    ink2: '#E6C4C4',
    ink3: '#B0898C',
    glass: {
      bg: 'rgba(255,238,232,0.07)',
      edge: 'rgba(255,210,200,0.18)',
      top: 'rgba(255,228,218,0.30)',
      shadow: 'rgba(36,6,14,0.64)',
    },
    clay: { hi: '#3a2028', lo: '#25121a' },
  },
};

/** Palette shown before any mood is logged (and for the "okay" mood). */
export const DEFAULT_PALETTE_ID: MoodPaletteId = 'nocturne';

/** Convenience getter with a guaranteed fallback. */
export function getPalette(id: MoodPaletteId | null | undefined): AuroraPalette {
  return AURORA_PALETTES[id ?? DEFAULT_PALETTE_ID] ?? AURORA_PALETTES[DEFAULT_PALETTE_ID];
}
