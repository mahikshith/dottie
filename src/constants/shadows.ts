/**
 * Dottie Shadow System
 *
 * Warm-toned shadows — NEVER grey.
 * Uses peachy/brown tones for depth that feels cozy, not cold.
 * Inspired by Monument Valley's layered depth.
 *
 * Usage:
 *   import { Shadows } from '@constants/shadows';
 *   style={Shadows.card}
 */

import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

export const Shadows: Record<string, ShadowStyle> = {
  // ─── ELEVATION LEVELS ─────────────────────────────────────────

  /** Subtle lift — input fields, inactive cards */
  sm: Platform.select({
    ios: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
      shadowColor: '#B48264',
    },
    default: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
  }) as ShadowStyle,

  /** Standard card elevation */
  card: Platform.select({
    ios: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
      shadowColor: '#B48264',
    },
    default: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
  }) as ShadowStyle,

  /** Elevated card — Daily Decode, active states */
  cardElevated: Platform.select({
    ios: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
    },
    android: {
      elevation: 8,
      shadowColor: '#B48264',
    },
    default: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
    },
  }) as ShadowStyle,

  /** Floating elements — FAB, modals, tooltips */
  floating: Platform.select({
    ios: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.20,
      shadowRadius: 28,
    },
    android: {
      elevation: 12,
      shadowColor: '#B48264',
    },
    default: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.20,
      shadowRadius: 28,
    },
  }) as ShadowStyle,

  /** Button press shadow (smaller, tighter) */
  button: Platform.select({
    ios: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    android: {
      elevation: 3,
      shadowColor: '#B48264',
    },
    default: {
      shadowColor: '#B48264',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
  }) as ShadowStyle,

  /** No shadow — flat elements */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};
