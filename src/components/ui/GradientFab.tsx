/**
 * Dottie — GradientFab
 *
 * The floating action button used across Community + Sisterhood (and
 * anywhere else that needs a primary "+" action). One shared primitive
 * so every FAB in the app looks and feels identical: a coral→peach
 * gradient circle that lifts off the canvas with a warm shadow and
 * springs on press.
 *
 * ─── WHY A SHARED PRIMITIVE ─────────────────────────────────────────
 *
 *  Community and Sisterhood each hand-rolled the same flat-coral FAB.
 *  Consolidating here means a single source of truth for the app's most
 *  prominent action affordance — consistency is a big part of "premium".
 *
 * ─── SHADOW/CLIP ────────────────────────────────────────────────────
 *
 *  Same two-view trick as GradientButton: the outer PressableScale owns
 *  the shadow + round shape + opaque fallback (so the iOS shadow casts),
 *  the inner View owns the circular clip the gradient fills.
 */

import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { PressableScale, type PressableScaleHaptic } from './PressableScale';

export interface GradientFabProps {
  onPress: () => void;
  /** Glyph rendered in the center. Default '+'. */
  icon?: string;
  /** Gradient stops. Defaults to the warm coral→peach brand gradient. */
  colors?: readonly [string, string, ...string[]];
  /** Diameter in points. Default 60. */
  size?: number;
  /** Absolute bottom offset in points (caller accounts for tab bar / safe area). */
  bottom?: number;
  /** Absolute right offset in points. Default screen padding. */
  right?: number;
  haptic?: PressableScaleHaptic;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const DEFAULT_COLORS = [Colors.primary.coral, Colors.primary.peach] as const;

export function GradientFab({
  onPress,
  icon = '+',
  colors = DEFAULT_COLORS,
  size = 60,
  bottom = Spacing.xl,
  right = Spacing.screenPadding,
  haptic = 'light',
  style,
  accessibilityLabel = 'Create',
}: GradientFabProps): JSX.Element {
  const radius = size / 2;

  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      scaleTo={0.9}
      style={[
        styles.fab,
        { width: size, height: size, borderRadius: radius, bottom, right },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.clip, { width: size, height: size, borderRadius: radius }]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.icon, { fontSize: size * 0.53 }]}>{icon}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    backgroundColor: Colors.primary.coral,
    ...Shadows.floating,
  },
  clip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: Colors.text.inverse,
    fontWeight: '300',
    marginTop: -2,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
