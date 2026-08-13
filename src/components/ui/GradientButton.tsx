/**
 * Dottie — GradientButton
 *
 * The premium primary call-to-action. A pill button with a warm diagonal
 * gradient fill, a soft coral shadow so it lifts off the cream canvas,
 * and the shared spring-press behavior from PressableScale.
 *
 * ─── WHY IT REPLACES FLAT CORAL BUTTONS ─────────────────────────────
 *
 *  The onboarding + CTA buttons were flat `Colors.primary.coral`. A
 *  single-color fill reads as "functional"; a subtle coral→peach
 *  gradient with a lift shadow reads as "crafted". This is one of the
 *  highest perceived-quality-per-line changes available, and it uses
 *  `expo-linear-gradient`, already a dependency.
 *
 * ─── THE TWO-VIEW SHADOW/CLIP TRICK ─────────────────────────────────
 *
 *  On iOS a single view CANNOT both cast a shadow AND clip its children
 *  with `overflow: 'hidden'` (the clip sets `masksToBounds`, which also
 *  clips the shadow). So the outer PressableScale owns the shadow +
 *  radius + a solid coral fallback, and an inner View owns the rounded
 *  clip that the gradient fills. This renders correctly on both
 *  platforms.
 */

import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { PressableScale, type PressableScaleHaptic } from './PressableScale';

export interface GradientButtonProps {
  label: string;
  onPress: () => void;
  /** Gradient stops. Defaults to the warm coral→peach brand gradient. */
  colors?: readonly [string, string, ...string[]];
  /** Optional leading emoji/glyph rendered before the label. */
  leadingEmoji?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Haptic on press. Default 'light' — this is an important action. */
  haptic?: PressableScaleHaptic;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const DEFAULT_COLORS = [Colors.primary.coral, Colors.primary.peach] as const;

export function GradientButton({
  label,
  onPress,
  colors = DEFAULT_COLORS,
  leadingEmoji,
  disabled = false,
  loading = false,
  haptic = 'light',
  style,
  accessibilityLabel,
  accessibilityHint,
}: GradientButtonProps): JSX.Element {
  const isInert = disabled || loading;

  return (
    <PressableScale
      // Dim ONLY when disabled-and-not-loading: a loading button keeps full
      // opacity so its spinner reads on the bright gradient; a genuinely
      // disabled (invalid-input) button greys out to signal "not yet".
      style={[styles.shadow, disabled && !loading ? styles.disabledDim : null, style]}
      haptic={isInert ? 'none' : haptic}
      disabled={isInert}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInert, busy: loading }}
    >
      <View style={styles.clip}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {loading ? (
          <ActivityIndicator color={Colors.text.inverse} />
        ) : (
          <Text style={styles.label} numberOfLines={1}>
            {leadingEmoji ? `${leadingEmoji}  ` : ''}
            {label}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Outer: owns shadow + radius + a solid fallback so the iOS shadow
  // has an opaque body to cast from (see header note).
  shadow: {
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.primary.coral,
    ...Shadows.button,
  },
  disabledDim: {
    opacity: 0.55,
  },
  // Inner: owns the rounded clip the gradient fills.
  clip: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  label: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
    textAlign: 'center',
  },
});
