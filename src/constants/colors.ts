/**
 * Dottie Color System — "Warm Geometric" Design Language
 *
 * Philosophy: Monument Valley serenity + Duolingo joy
 * - Warm, cheerful, never clinical
 * - Phase-responsive (colors shift with cycle phase)
 * - Generous depth through warm-toned shadows (never grey)
 *
 * Usage:
 *   import { Colors } from '@constants/colors';
 *   style={{ backgroundColor: Colors.surface.background }}
 */

export const Colors = {
  // ─── PRIMARY PALETTE (Warm + Cheerful) ────────────────────────
  primary: {
    coral: '#FF6B6B',       // Heart — primary action color
    peach: '#FFA07A',       // Warmth — secondary actions
    sunburst: '#FFD93D',    // Joy — highlights, celebrations
    sage: '#6BCB77',        // Growth — success, health
    calm: '#4D96FF',        // Trust — informational
  },

  // ─── PHASE COLORS (Each phase of menstrual cycle) ─────────────
  phase: {
    menstrual: {
      primary: '#E88EA0',
      gradient: ['#E88EA0', '#C75B6F'] as const,
      light: '#FFF0F3',
      emoji: '🌊',
      label: 'Menstrual',
    },
    follicular: {
      primary: '#7ECFB3',
      gradient: ['#7ECFB3', '#4DAF8B'] as const,
      light: '#F0FFF8',
      emoji: '🌱',
      label: 'Follicular',
    },
    ovulatory: {
      primary: '#F4A261',
      gradient: ['#F4A261', '#E76F51'] as const,
      light: '#FFF8F0',
      emoji: '☀️',
      label: 'Ovulatory',
    },
    luteal: {
      primary: '#9B8FD4',
      gradient: ['#9B8FD4', '#7B6FB5'] as const,
      light: '#F5F0FF',
      emoji: '🌙',
      label: 'Luteal',
    },
  },

  // ─── SURFACES (Backgrounds & Cards) ──────────────────────────
  surface: {
    background: '#FFF8F2',     // Cream Canvas — main bg
    card: '#FFFFFF',           // White — card surfaces
    cardElevated: '#FFF1E8',   // Warm Ivory — elevated cards
    overlay: 'rgba(45, 35, 28, 0.4)', // Warm dark overlay for modals
  },

  // ─── TEXT COLORS ──────────────────────────────────────────────
  text: {
    primary: '#2D1B12',        // Rich Warm Brown — headings
    secondary: '#6B5344',      // Muted Brown — body text
    tertiary: '#9B8B80',       // Light Brown — captions, hints
    inverse: '#FFFFFF',        // White — on dark/colored backgrounds
    link: '#4D96FF',           // Calm Blue — tappable text
  },

  // ─── SEMANTIC COLORS ──────────────────────────────────────────
  semantic: {
    success: '#6BCB77',
    warning: '#FFD93D',
    error: '#FF6B6B',
    info: '#4D96FF',
  },

  // ─── GAMIFICATION COLORS ──────────────────────────────────────
  gamification: {
    streak: '#FF6B35',         // Fire orange for streaks
    xp: '#7C5CFC',            // Purple for XP
    gems: '#00C9A7',           // Teal for gems
    badge: '#FFD700',          // Gold for badges
    levelUp: '#FF6B6B',        // Coral for level-ups
  },

  // ─── COMPANION COLORS (Per spirit animal accent) ──────────────
  companion: {
    fox: '#E8813D',            // Warm amber
    bunny: '#FFB3D9',          // Soft pink
    butterfly: '#B388FF',      // Lavender
    cat: '#7C7C7C',            // Cool grey
    owl: '#5D8AA8',            // Steel blue
    blossom: '#FF8FAB',        // Rose
  },

  // ─── SHADOWS (Warm-toned, never grey!) ────────────────────────
  shadow: {
    light: 'rgba(180, 130, 100, 0.08)',
    medium: 'rgba(180, 130, 100, 0.15)',
    heavy: 'rgba(180, 130, 100, 0.25)',
  },

  // ─── DARK MODE ────────────────────────────────────────────────
  dark: {
    background: '#1A1210',
    card: '#2D2420',
    cardElevated: '#3D3230',
    text: {
      primary: '#FFF8F2',
      secondary: '#D4C4B8',
      tertiary: '#9B8B80',
    },
  },

  // ─── BORDERS ──────────────────────────────────────────────────
  border: {
    light: 'rgba(180, 130, 100, 0.12)',
    medium: 'rgba(180, 130, 100, 0.20)',
  },
} as const;

// ─── TYPE HELPERS ─────────────────────────────────────────────────
export type PhaseKey = keyof typeof Colors.phase;
export type CompanionKey = keyof typeof Colors.companion;

// Helper to get phase color by key
export function getPhaseColors(phase: PhaseKey) {
  return Colors.phase[phase];
}
