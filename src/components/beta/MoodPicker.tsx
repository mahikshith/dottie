/**
 * MoodPicker
 *
 * A 5-emoji horizontal selector used inside the FeedbackSheet to
 * capture the user's overall mood about Dottie.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - 5 emojis side-by-side (😞 😐 🙂 😊 🥰)
 *  - Tap → soft scale + selection highlight, accent color pulled from
 *    the user's companion accent so the picker feels personal
 *  - VoiceOver-friendly: each emoji has an accessibilityLabel from
 *    FEEDBACK_MOOD_OPTIONS so screen readers say "Frustrated" instead
 *    of "frowning face emoji"
 *  - Selected emoji grows ~10%, unselected ones fade slightly — keeps
 *    a clear visual answer to "which one did I pick?" without using
 *    a separate checkbox or radio indicator
 *
 * ─── REUSE NOTE ─────────────────────────────────────────────────────
 *
 *  Lives in src/components/beta/ because beta feedback is the only
 *  current consumer. If we ever add an in-app mood snapshot for the
 *  daily check-in flow (which already uses a different scale picker),
 *  this can graduate to src/components/ui/ — but no need to do that
 *  preemptively.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import {
  FeedbackMood,
  FeedbackMoodOption,
  FEEDBACK_MOOD_OPTIONS,
} from '../../types/beta-feedback.types';

// ─── PROPS ───────────────────────────────────────────────────────────

interface MoodPickerProps {
  /** Current selected mood (null = nothing picked yet). */
  value: FeedbackMood | null;
  /** Called when the user picks (or re-picks) a mood. */
  onChange: (mood: FeedbackMood) => void;
  /**
   * Optional accent color for the selected mood's background tint.
   * Defaults to Dottie's primary coral. Pass the companion accent for
   * a personal touch.
   */
  accentColor?: string;
  /** When true, dims the picker and ignores taps. */
  disabled?: boolean;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function MoodPicker({
  value,
  onChange,
  accentColor,
  disabled = false,
}: MoodPickerProps) {
  const accent = accentColor ?? Colors.primary.coral;

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      {FEEDBACK_MOOD_OPTIONS.map((option) => (
        <MoodCell
          key={option.value}
          option={option}
          selected={value === option.value}
          accent={accent}
          onPress={() => {
            if (disabled) return;
            Haptics.selectionAsync().catch(() => {});
            onChange(option.value);
          }}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

// ─── INDIVIDUAL CELL ─────────────────────────────────────────────────

function MoodCell({
  option,
  selected,
  accent,
  onPress,
  disabled,
}: {
  option: FeedbackMoodOption;
  selected: boolean;
  accent: string;
  onPress: () => void;
  disabled: boolean;
}) {
  // Animate scale on selection — feels alive without being noisy.
  // Native driver because this is a transform animation, not a layout.
  const scale = useRef(new Animated.Value(selected ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.1 : 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        pressed && !disabled && styles.cellPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected, disabled }}
      hitSlop={8}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.cellInner,
          selected && {
            backgroundColor: hexToRgba(accent, 0.14),
            borderColor: accent,
          },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.emoji, !selected && styles.emojiUnselected]}>
          {option.emoji}
        </Text>
      </Animated.View>
      <Text
        style={[
          styles.label,
          selected && { color: accent, fontWeight: '600' as const },
        ]}
        numberOfLines={1}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cellPressed: {
    opacity: 0.85,
  },
  cellInner: {
    width: 56,
    height: 56,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.cardElevated,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  emojiUnselected: {
    opacity: 0.75,
  },
  label: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
