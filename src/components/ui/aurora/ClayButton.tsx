/**
 * Dottie — ClayButton (design-v2)
 *
 * A soft "claymorphism" control: a puffy gradient surface with a top sheen and
 * a lift shadow that reads as physically pressable. Reads clay + accent tokens
 * from the active mood palette; when `selected` it lights up in the accent.
 *
 * Built ON the shared `PressableScale` primitive, so it inherits the app-wide
 * spring press + haptic (animate-expo: `scale ~0.9` for a chunky control, on
 * press-in, Reduce-Motion aware). Uses the two-view shadow/clip trick so the
 * iOS lift shadow survives the rounded gradient clip.
 *
 * Sizing is left to the parent (e.g. `flex: 1, aspectRatio: 1` for a mood key)
 * — pass it through `style`.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). The real clay "puff" (soft inner
 *  shadows) is faked with a top-sheen gradient here; if RN 0.76's `boxShadow`
 *  style proves reliable on device, richer inset shadows can replace it.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale, type PressableScaleHaptic } from '../PressableScale';
import { useAurora } from '../../../theme/ThemeProvider';

export interface ClayButtonProps {
  children?: ReactNode;
  /**
   * Press handler. Receives the touch event (forwarded from Pressable) so
   * callers can read the tap origin — e.g. the mood keys pass
   * `e.nativeEvent.pageX/pageY` into `applyMood(score, origin)` for the
   * radiate-from-tap colour reveal.
   */
  onPress?: (event: GestureResponderEvent) => void;
  /** Lights the button in the accent gradient + glow. */
  selected?: boolean;
  radius?: number;
  haptic?: PressableScaleHaptic;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ClayButton({
  children,
  onPress,
  selected = false,
  radius = 20,
  haptic = 'light',
  style,
  accessibilityLabel,
}: ClayButtonProps): JSX.Element {
  const { palette } = useAurora();
  const { clay, accent, accent2 } = palette;

  const fill = selected
    ? ([accent, accent2] as const)
    : ([clay.hi, clay.lo] as const);

  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[
        styles.shadow,
        { borderRadius: radius, backgroundColor: clay.lo },
        // Selected → glow in the accent (a coloured lift instead of the dark one).
        selected && { shadowColor: accent, shadowOpacity: 0.55, shadowRadius: 18 },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        <LinearGradient
          colors={fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Top sheen = the clay "puff" highlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as const}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  clip: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
