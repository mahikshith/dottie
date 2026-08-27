import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * MilestoneBanner — A small "you hit a milestone" headline pill.
 *
 * ─── WHEN TO USE ────────────────────────────────────────────────────
 *
 *  Renders above the StreakFlame in streak-celebration.tsx ONLY when
 *  the streak engine reports a milestone. Examples:
 *
 *      ✨ Milestone Day ✨
 *      First Week  ·  7 days
 *
 *  For a regular increment (Day 4, Day 11, etc) we don't render this
 *  banner — the celebration is the recap sheet, not a milestone moment.
 *
 * ─── MILESTONE COPY ─────────────────────────────────────────────────
 *
 *  The streak engine recognizes:
 *      3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365
 *
 *  Each gets a short, warm "name" so the moment feels named and
 *  remembered (not just numeric). Anything outside that list falls back
 *  to a generic "Streak Milestone" — but in practice we only mount this
 *  component when result.milestone !== null, so the fallback is a
 *  defensive belt-and-suspenders.
 *
 *  Tone rules:
 *    • Never use "Congratulations!" — feels canned.
 *    • Never use "You did it!" — implies it was hard to come back.
 *    • Always frame as a gift to the user, not a trophy to display.
 */

export interface MilestoneBannerProps {
  /** The exact streak count that triggered the milestone. */
  milestone: number;
  /** Optional accent color override (defaults to phase-agnostic warm gold). */
  accentColor?: string;
}

// ─── MILESTONE → COPY MAP ───────────────────────────────────────────

const MILESTONE_COPY: Record<number, { name: string; subtitle: string }> = {
  3: {
    name: 'Three In A Row',
    subtitle: "You're finding your rhythm",
  },
  7: {
    name: 'First Week',
    subtitle: 'A full cycle of showing up',
  },
  14: {
    name: 'Two Weeks',
    subtitle: 'Habits are forming gently',
  },
  21: {
    name: 'Three Weeks',
    subtitle: 'This is muscle memory now',
  },
  30: {
    name: 'One Month',
    subtitle: 'A whole month of you, with you',
  },
  50: {
    name: 'Fifty Days',
    subtitle: 'Quiet, daily power',
  },
  75: {
    name: 'Seventy-Five',
    subtitle: "You've been showing up beautifully",
  },
  100: {
    name: 'One Hundred',
    subtitle: 'A triple-digit kind of love',
  },
  150: {
    name: 'One Fifty',
    subtitle: 'This is dedication, gently held',
  },
  200: {
    name: 'Two Hundred',
    subtitle: 'You are unstoppable, softly',
  },
  365: {
    name: 'One Whole Year',
    subtitle: 'A full trip around the sun, together',
  },
};

const FALLBACK_COPY = {
  name: 'Streak Milestone',
  subtitle: "You're doing beautifully",
};

// ─── COMPONENT ──────────────────────────────────────────────────────

export function MilestoneBanner({
  milestone,
  accentColor = Colors.gamification.badge,
}: MilestoneBannerProps) {
  const { palette } = useAurora();
  const copy = MILESTONE_COPY[milestone] ?? FALLBACK_COPY;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.glass.bg, borderColor: hexToRgba(accentColor, 0.5) },
      ]}
      accessibilityRole="header"
      accessibilityLabel={`Milestone: ${copy.name}, ${milestone} day streak`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={[styles.headerText, { color: accentColor }]}>
          Milestone Day
        </Text>
        <Text style={styles.sparkle}>✨</Text>
      </View>
      <Text style={[styles.name, { color: palette.ink }]}>{copy.name}</Text>
      <Text style={[styles.subtitle, { color: palette.ink3 }]}>
        {copy.subtitle} · {milestone} days
      </Text>
    </View>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sparkle: {
    fontSize: 14,
  },
  headerText: {
    ...Typography.preset.overline,
    fontSize: 11,
  },
  name: {
    ...Typography.preset.h4,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.preset.caption,
    textAlign: 'center',
  },
});
