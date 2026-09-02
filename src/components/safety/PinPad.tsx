/**
 * PinPad
 *
 * The shared 4-6 digit PIN entry surface used by BOTH the lock screen
 * (ghost-lock.tsx) and the settings screen (ghost-mode.tsx). One
 * implementation, used in three flows:
 *
 *   1. Lock screen        → verify PIN to unlock
 *   2. Settings: set new  → choose + confirm new PIN
 *   3. Settings: panic    → set the optional panic PIN
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Big tappable digits — 64x64 minimum (well above 44pt HIG min)
 *  - Subtle haptic on every press (selection)
 *  - Filled dot indicators above the keypad show progress (•••○)
 *  - No "submit" button — auto-submits when the user reaches `length`
 *    digits. One less tap, more flow.
 *  - "Delete" replaces "9" position. "Cancel" replaces "0" if shown.
 *  - Shake animation on error (driven by the parent flipping `errorKey`)
 *  - Disabled state during cooldown — keypad goes pale, copy explains
 *
 * ─── INTENTIONAL NON-FEATURES ───────────────────────────────────────
 *
 *  - No "show/hide PIN" eye toggle — defeats the entire purpose of the
 *    secret PIN
 *  - No biometric button — MVP. Comes in chunk 13.
 *  - No PIN strength meter — meaningless for 4-6 digits
 *
 * ─── ACCESSIBILITY ──────────────────────────────────────────────────
 *
 *  Each digit button has an accessibilityLabel ("Number 1", "Delete").
 *  The dot indicators have a combined accessibilityValue describing
 *  progress ("2 of 4 digits entered").
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { A } from '../../theme';
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '../../types/ghost-mode.types';

// Theme presets — 'cream' is the classic Garden Notes disguise (bright,
// friendly notes-app look); 'aurora' matches the rest of the Dottie app
// (dark glass) and is used when disguise mode is OFF.
type PinPadTheme = 'cream' | 'aurora';
interface PinPadColors {
  helper: string;
  error: string;
  dotBorder: string;
  dotFill: string;
  keyBg: string;
  keyBgPressed: string;
  keyText: string;
}
const THEME_COLORS: Record<PinPadTheme, PinPadColors> = {
  cream: {
    helper: Colors.text.secondary,
    error: Colors.semantic.error,
    dotBorder: Colors.border.medium,
    dotFill: Colors.primary.coral,
    keyBg: Colors.surface.card,
    keyBgPressed: Colors.surface.cardElevated,
    keyText: Colors.text.primary,
  },
  aurora: {
    helper: A.ink2,
    error: A.error,
    dotBorder: A.edge,
    dotFill: A.accent,
    keyBg: A.glass2,
    keyBgPressed: A.edge,
    keyText: A.ink,
  },
};

// ─── PROPS ───────────────────────────────────────────────────────────

interface PinPadProps {
  /** Current PIN value (controlled). */
  value: string;
  /** Setter — called on every digit / delete. */
  onChange: (next: string) => void;
  /**
   * Called when the user has typed exactly `length` digits. The parent
   * decides what to do (verify against hash, advance to confirm step,
   * etc.). The PIN pad does NOT clear `value` afterwards — the parent
   * controls that.
   */
  onSubmit?: (pin: string) => void;
  /**
   * Expected PIN length. When the value reaches this length, `onSubmit`
   * fires. Defaults to MIN_PIN_LENGTH (4).
   *
   * For "set new PIN" flows you usually want to let the user choose
   * any length 4-6 — set length=MIN_PIN_LENGTH and add a separate
   * "Continue" button.
   */
  length?: number;
  /** Show "Cancel" in place of the bottom-left slot. */
  showCancel?: boolean;
  /** Called when "Cancel" is pressed (if shown). */
  onCancel?: () => void;
  /**
   * Flip this value to anything new to trigger a shake animation
   * (e.g., on wrong PIN). The exact value doesn't matter; just change it.
   */
  errorKey?: string | number;
  /** When true, the pad is dimmed and presses are ignored. */
  disabled?: boolean;
  /** Optional helper text shown above the dots (e.g., "Confirm new PIN"). */
  helperText?: string;
  /** Optional inline error message shown below the dots. */
  errorMessage?: string;
  /**
   * Colour scheme. 'cream' (default) is the classic Garden Notes disguise
   * (light background, coral accents). 'aurora' matches the rest of the
   * app (dark glass, mint accent) — used when the lock screen shows
   * Dottie branding rather than the disguise.
   */
  theme?: PinPadTheme;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function PinPad({
  value,
  onChange,
  onSubmit,
  length = MIN_PIN_LENGTH,
  showCancel = false,
  onCancel,
  errorKey,
  disabled = false,
  helperText,
  errorMessage,
  theme = 'cream',
}: PinPadProps) {
  const c = THEME_COLORS[theme];
  // ─── Shake animation ────────────────────────────────────────────
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Skip the very first render (errorKey starts as undefined; we
    // only animate when it CHANGES).
    if (errorKey === undefined) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
    // Error haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [errorKey, shakeX]);

  // ─── Auto-submit when full ──────────────────────────────────────
  useEffect(() => {
    if (value.length === length && onSubmit) {
      // Defer to next tick so the final dot has a chance to render
      // before the parent navigates away / starts an animation.
      const t = setTimeout(() => onSubmit(value), 40);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value, length, onSubmit]);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleDigit = (digit: string) => {
    if (disabled) return;
    if (value.length >= MAX_PIN_LENGTH) return;
    if (value.length >= length) return; // already full — wait for parent
    Haptics.selectionAsync().catch(() => {});
    onChange(value + digit);
  };

  const handleDelete = () => {
    if (disabled) return;
    if (value.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(value.slice(0, -1));
  };

  const handleCancel = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onCancel?.();
  };

  // ─── Dot indicators ─────────────────────────────────────────────
  const dots = useMemo(() => Array.from({ length }, (_, i) => i), [length]);

  return (
    <View style={styles.container}>
      {/* Helper text (above dots) */}
      {helperText ? (
        <Text style={[styles.helperText, { color: c.helper }]}>{helperText}</Text>
      ) : null}

      {/* Dots indicator */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeX }] }]}
        accessibilityRole="text"
        accessibilityValue={{ text: `${value.length} of ${length} digits entered` }}
      >
        {dots.map((i) => {
          const filled = i < value.length;
          return (
            <View
              key={`dot_${i}`}
              style={[
                styles.dot,
                filled
                  ? { backgroundColor: c.dotFill, borderColor: c.dotFill }
                  : { backgroundColor: 'transparent', borderColor: c.dotBorder },
                disabled && styles.dotDimmed,
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Error message (below dots) */}
      {errorMessage ? (
        <Text style={[styles.errorText, { color: c.error }]}>{errorMessage}</Text>
      ) : (
        <View style={styles.errorPlaceholder} />
      )}

      {/* Keypad — 4 rows of 3 */}
      <View style={[styles.keypad, disabled && styles.keypadDimmed]}>
        {KEYPAD_LAYOUT.map((row, rowIdx) => (
          <View key={`row_${rowIdx}`} style={styles.keypadRow}>
            {row.map((cell) => {
              if (cell.kind === 'digit') {
                return (
                  <DigitKey
                    key={cell.value}
                    digit={cell.value}
                    onPress={handleDigit}
                    disabled={disabled}
                    colors={c}
                  />
                );
              }
              if (cell.kind === 'delete') {
                return (
                  <ActionKey
                    key="delete"
                    label="⌫"
                    a11yLabel="Delete last digit"
                    onPress={handleDelete}
                    disabled={disabled || value.length === 0}
                    colors={c}
                  />
                );
              }
              if (cell.kind === 'cancel' && showCancel) {
                return (
                  <ActionKey
                    key="cancel"
                    label="Cancel"
                    a11yLabel="Cancel PIN entry"
                    onPress={handleCancel}
                    disabled={disabled}
                    colors={c}
                  />
                );
              }
              return <View key={cell.kind} style={styles.cellPlaceholder} />;
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function DigitKey({
  digit,
  onPress,
  disabled,
  colors,
}: {
  digit: string;
  onPress: (digit: string) => void;
  disabled: boolean;
  colors: PinPadColors;
}) {
  return (
    <Pressable
      onPress={() => onPress(digit)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Number ${digit}`}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: colors.keyBg },
        pressed && [styles.keyPressed, { backgroundColor: colors.keyBgPressed }],
      ]}
    >
      <Text style={[styles.keyDigit, { color: colors.keyText }]}>{digit}</Text>
    </Pressable>
  );
}

function ActionKey({
  label,
  a11yLabel,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  a11yLabel: string;
  onPress: () => void;
  disabled: boolean;
  colors: PinPadColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [
        styles.key,
        styles.keyAction,
        { backgroundColor: colors.keyBg },
        pressed && [styles.keyPressed, { backgroundColor: colors.keyBgPressed }],
        disabled && styles.keyDisabled,
      ]}
    >
      <Text style={[styles.keyAction_label, { color: colors.keyText }]}>{label}</Text>
    </Pressable>
  );
}

// ─── KEYPAD LAYOUT ──────────────────────────────────────────────────

type KeyCell =
  | { kind: 'digit'; value: string }
  | { kind: 'delete' }
  | { kind: 'cancel' }
  | { kind: 'spacer' };

const KEYPAD_LAYOUT: KeyCell[][] = [
  [
    { kind: 'digit', value: '1' },
    { kind: 'digit', value: '2' },
    { kind: 'digit', value: '3' },
  ],
  [
    { kind: 'digit', value: '4' },
    { kind: 'digit', value: '5' },
    { kind: 'digit', value: '6' },
  ],
  [
    { kind: 'digit', value: '7' },
    { kind: 'digit', value: '8' },
    { kind: 'digit', value: '9' },
  ],
  [
    { kind: 'cancel' },
    { kind: 'digit', value: '0' },
    { kind: 'delete' },
  ],
];

// ─── STYLES ──────────────────────────────────────────────────────────

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
  },

  // Helper / error text
  helperText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.preset.captionBold,
    color: Colors.semantic.error,
    textAlign: 'center',
    minHeight: 18,
  },
  errorPlaceholder: {
    minHeight: 18,
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderColor: Colors.border.medium,
  },
  dotFilled: {
    backgroundColor: Colors.primary.coral,
    borderColor: Colors.primary.coral,
  },
  dotDimmed: {
    opacity: 0.4,
  },

  // Keypad
  keypad: {
    gap: Spacing.base,
  },
  keypadDimmed: {
    opacity: 0.5,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    justifyContent: 'center',
  },
  cellPlaceholder: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },

  // Individual key
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: Colors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  keyPressed: {
    transform: [{ scale: 0.9 }],
    backgroundColor: Colors.surface.cardElevated,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyDigit: {
    fontSize: 30,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'] as const,
  },
  keyAction: {
    backgroundColor: 'transparent',
  },
  keyAction_label: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.secondary,
    fontSize: 17,
  },
});
