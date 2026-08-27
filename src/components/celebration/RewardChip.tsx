import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * RewardChip — A warm pill showing a gamification reward.
 *
 * ─── WHEN TO USE ────────────────────────────────────────────────────
 *
 *  Anywhere we want to acknowledge an XP or gem award without making
 *  it the loud center of the screen. Examples:
 *
 *    +10 XP        →  daily check-in success recap
 *    +50 💎        →  streak milestone celebration
 *    +25 XP +5 💎  →  lesson complete (two chips side-by-side)
 *
 *  The chip is deliberately small and non-disruptive — the celebration
 *  comes from the surrounding moment (sheet animation, companion line),
 *  not from the chip itself.
 *
 * ─── DESIGN NOTES ───────────────────────────────────────────────────
 *
 *  • Pill shape (radius.full) — matches the Dottie button language.
 *  • Soft shadow via Shadows.sm — feels lifted but never aggressive.
 *  • Warm tone variants:
 *      'xp'    → soft purple (Colors.gamification.xp)
 *      'gem'   → teal (Colors.gamification.gems)
 *      'fire'  → coral/orange (Colors.gamification.streak)
 *  • Number uses tabular-nums so 8, 88, 888 all line up vertically when
 *    chips are stacked across cards.
 *
 *  Never red, never alarming, never blinking.
 */

export type RewardKind = 'xp' | 'gem' | 'fire';

export interface RewardChipProps {
  /** Which kind of reward — drives color + icon. */
  kind: RewardKind;
  /** The numeric amount to show. */
  amount: number;
  /** Optional override label (defaults to the kind's standard label). */
  label?: string;
  /** Optional flag to render in a more compact form (smaller padding). */
  compact?: boolean;
}

// ─── KIND → APPEARANCE MAP ──────────────────────────────────────────

const KIND_CONFIG: Record<
  RewardKind,
  { emoji: string; color: string; defaultLabel: string }
> = {
  xp: {
    emoji: '⭐',
    color: Colors.gamification.xp,
    defaultLabel: 'XP',
  },
  gem: {
    emoji: '💎',
    color: Colors.gamification.gems,
    defaultLabel: '',
  },
  fire: {
    emoji: '🔥',
    color: Colors.gamification.streak,
    defaultLabel: 'days',
  },
};

// ─── COMPONENT ──────────────────────────────────────────────────────

export function RewardChip({
  kind,
  amount,
  label,
  compact = false,
}: RewardChipProps) {
  const { palette } = useAurora();
  const config = KIND_CONFIG[kind];
  const displayLabel = label ?? config.defaultLabel;

  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        { backgroundColor: palette.glass.bg, borderColor: hexToRgba(config.color, 0.45) },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Plus ${amount} ${displayLabel || config.emoji}`}
    >
      <Text style={styles.emoji}>{config.emoji}</Text>
      <Text style={[styles.amount, { color: config.color }]}>
        +{amount}
      </Text>
      {displayLabel ? (
        <Text style={[styles.label, { color: config.color }]}>
          {displayLabel}
        </Text>
      ) : null}
    </View>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────

/**
 * Convert a hex color (#RRGGBB) to an rgba() string at the given alpha.
 * Used to derive a soft tinted border from each reward kind's accent.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── STYLES ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
    gap: 6,
  },
  chipCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  emoji: {
    fontSize: 16,
  },
  amount: {
    ...Typography.preset.bodySemibold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...Typography.preset.captionBold,
  },
});
