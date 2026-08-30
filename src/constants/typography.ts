/**
 * Dottie Typography System
 *
 * Uses iOS system font (SF Pro) which is automatically available.
 * SF Pro Rounded for headlines (cheerful), SF Pro Text for body (clean).
 *
 * On Android, falls back to system default (Roboto) which has similar metrics.
 *
 * Design principles:
 * - Headlines: Bold, slightly tight tracking (confident, cheerful)
 * - Body: Regular weight, generous line height (breathing room)
 * - Numbers: Tabular nums for alignment (streak counts, XP)
 * - Never smaller than 11px (accessibility)
 */

import { Platform } from 'react-native';

// System font family references
const FONT_FAMILY = Platform.select({
  ios: 'System',           // Maps to SF Pro on iOS
  android: 'sans-serif',   // Maps to Roboto on Android
  default: 'System',
});

const FONT_FAMILY_ROUNDED = Platform.select({
  ios: 'System',           // SF Pro Rounded via fontWeight + design
  android: 'sans-serif-medium',
  default: 'System',
});

export const Typography = {
  // ─── FONT FAMILIES ────────────────────────────────────────────
  family: {
    base: FONT_FAMILY,
    rounded: FONT_FAMILY_ROUNDED,
  },

  // ─── FONT SIZES (Modular scale — 1.25 ratio) ─────────────────
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },

  // ─── LINE HEIGHTS (Generous breathing room) ───────────────────
  lineHeight: {
    tight: 1.2,       // Headlines
    normal: 1.5,      // Body text
    relaxed: 1.7,     // Long-form reading (lessons)
  },

  // ─── FONT WEIGHTS ────────────────────────────────────────────
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  // ─── LETTER SPACING ──────────────────────────────────────────
  letterSpacing: {
    tight: -0.5,       // Large headlines
    normal: 0,         // Body
    wide: 0.5,         // Buttons, badges
    wider: 1.0,        // All-caps labels
  },

  // ─── PRESET STYLES (Ready-to-use text presets) ────────────────
  preset: {
    // Headlines — cheerful, bold, rounded feel
    h1: {
      fontSize: 36,
      fontWeight: '700' as const,
      lineHeight: 43,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 30,
      fontWeight: '700' as const,
      lineHeight: 36,
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 29,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: 0,
    },

    // Body text — clean, readable
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 23,
      letterSpacing: 0,
    },
    bodyLarge: {
      fontSize: 17,
      fontWeight: '400' as const,
      lineHeight: 26,
      letterSpacing: 0,
    },
    bodySemibold: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 23,
      letterSpacing: 0,
    },

    // Captions & labels
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
      letterSpacing: 0.2,
    },
    captionBold: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0.2,
    },
    overline: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
      letterSpacing: 1.0,
      textTransform: 'uppercase' as const,
    },

    // Special — numbers/data (streak counts, XP, gems)
    number: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 29,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'] as ('tabular-nums')[],
    },
    numberLarge: {
      fontSize: 48,
      fontWeight: '800' as const,
      lineHeight: 52,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'] as ('tabular-nums')[],
    },

    // Buttons
    button: {
      fontSize: 17,
      fontWeight: '600' as const,
      lineHeight: 22,
      letterSpacing: 0.3,
    },
    buttonSmall: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0.3,
    },
  },
} as const;
