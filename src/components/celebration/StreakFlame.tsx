import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

/**
 * StreakFlame — Hero streak number with a flame emoji + soft halo.
 *
 * ─── WHEN TO USE ────────────────────────────────────────────────────
 *
 *  The visual anchor of the streak-celebration sheet:
 *
 *      🔥
 *      7
 *      day streak
 *
 *  We deliberately keep it minimal: one emoji, one giant number, one
 *  small caption. The celebration energy comes from the surrounding
 *  scene (warm phase tint, companion line, reward chips), not from
 *  visual noise here.
 *
 * ─── ANIMATION ──────────────────────────────────────────────────────
 *
 *  • Number scales from 0.6 → 1.0 with a spring on mount.
 *  • Flame pulses gently (subtle ±5% opacity loop) to feel "alive"
 *    without being distracting.
 *  • All animations honor reduced-motion — we'd hook into AccessibilityInfo
 *    in a later polish pass; for Batch 2 the durations are short enough
 *    that it's not yet a blocker.
 *
 * ─── PROPS ──────────────────────────────────────────────────────────
 *
 *  • count        - The streak number to celebrate.
 *  • accentColor  - Optional override (defaults to streak fire orange).
 *  • size         - 'standard' (default) or 'large' (used in milestones).
 */

export interface StreakFlameProps {
  count: number;
  accentColor?: string;
  size?: 'standard' | 'large';
}

export function StreakFlame({
  count,
  accentColor = Colors.gamification.streak,
  size = 'standard',
}: StreakFlameProps) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const flamePulse = useRef(new Animated.Value(1)).current;

  // Entrance: scale + fade together (spring physics on the scale)
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous gentle flame pulse — 0.85 ↔ 1.0 opacity, 1.5s loop.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flamePulse, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(flamePulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [scale, opacity, flamePulse]);

  const isLarge = size === 'large';

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ scale }] },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${count} day streak`}
    >
      {/* Soft warm halo behind the flame */}
      <View
        style={[
          styles.halo,
          isLarge && styles.haloLarge,
          { backgroundColor: hexToRgba(accentColor, 0.12) },
        ]}
      />

      {/* The flame itself, gently pulsing */}
      <Animated.Text
        style={[
          styles.flame,
          isLarge && styles.flameLarge,
          { opacity: flamePulse },
        ]}
      >
        🔥
      </Animated.Text>

      {/* The hero number */}
      <Text
        style={[
          styles.count,
          isLarge && styles.countLarge,
          { color: accentColor },
        ]}
      >
        {count}
      </Text>

      {/* Caption */}
      <Text style={styles.caption}>
        {count === 1 ? 'day streak' : 'day streak'}
      </Text>
    </Animated.View>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── STYLES ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  halo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 0,
  },
  haloLarge: {
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  flame: {
    fontSize: 56,
    marginBottom: Spacing.xs,
  },
  flameLarge: {
    fontSize: 76,
  },
  count: {
    ...Typography.preset.numberLarge,
    fontSize: 80,
    lineHeight: 86,
  },
  countLarge: {
    fontSize: 112,
    lineHeight: 120,
  },
  caption: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
