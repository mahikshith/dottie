/**
 * Dottie Spacing & Layout System
 *
 * 4px base unit grid for consistency.
 * Generous spacing — "breathing room" is core to our design language.
 * Rounded corners everywhere — soft, organic, never sharp.
 *
 * Usage:
 *   import { Spacing } from '@constants/spacing';
 *   style={{ padding: Spacing.screenPadding, borderRadius: Spacing.radius['2xl'] }}
 */

export const Spacing = {
  // ─── BASE SPACING SCALE (4px grid) ────────────────────────────
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,

  // ─── SEMANTIC SPACING ─────────────────────────────────────────
  screenPadding: 20,         // Horizontal page margins
  cardPadding: 16,           // Inner card padding
  cardPaddingLarge: 24,      // Large cards (Daily Decode, etc.)
  sectionGap: 24,            // Gap between sections on a screen
  itemGap: 12,               // Gap between list items
  inlineGap: 8,              // Gap between inline elements

  // ─── BORDER RADIUS (Rounded & Organic) ────────────────────────
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,            // Cards
    '3xl': 32,            // Large cards, modals
    full: 9999,           // Pill buttons, circles
  },

  // ─── COMPONENT SIZES ──────────────────────────────────────────
  buttonHeight: {
    sm: 36,
    md: 48,
    lg: 56,
  },
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
  avatarSize: {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  },
  touchTarget: 44,           // Minimum touch target (Apple HIG)

  // ─── TAB BAR ──────────────────────────────────────────────────
  tabBarHeight: 85,          // Bottom tab bar height (incl. safe area)
  tabBarPadding: 8,

  // ─── STATUS BAR / HEADER ──────────────────────────────────────
  headerHeight: 56,
  statusBarOffset: 44,       // iOS notch area
} as const;
