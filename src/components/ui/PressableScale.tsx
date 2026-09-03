/**
 * Dottie — PressableScale
 *
 * The premium tap primitive. A drop-in `Pressable` that springs down on
 * press and back on release, on the UI thread via Reanimated, with an
 * optional haptic. This is the one place the app's "spring/scale on
 * press" rule (from the design system) is implemented, so every tappable
 * surface feels identical and buttery.
 *
 * ─── WHY REANIMATED (not RN Animated) ───────────────────────────────
 *
 *  The beta components use RN's legacy `Animated`, which is fine for
 *  slow pulses but drives transforms from the JS thread — any JS work
 *  (a store update, a navigation) can stutter the press feedback. A
 *  press animation MUST stay at 60fps to feel premium, so this runs on
 *  the UI thread via `useSharedValue` + `useAnimatedStyle`. Reanimated
 *  is already a dependency and the babel plugin is configured, so this
 *  adds no new packages.
 *
 * ─── WHY onPressIn FOR HAPTIC ───────────────────────────────────────
 *
 *  Haptic fires on `onPressIn` (the instant the finger lands) rather
 *  than on `onPress` (after release) so the tactile response feels
 *  simultaneous with the visual squish. This is the detail that makes
 *  taps feel "connected" on iOS.
 *
 * ─── ACCESSIBILITY & REDUCED MOTION ─────────────────────────────────
 *
 *  Honors the OS "Reduce Motion" setting: when on, the scale animation
 *  is skipped entirely (the button still works and still gives haptic +
 *  onPress). All the usual Pressable a11y props pass straight through.
 */

import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { log } from '../../diagnostics/logger';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Snappy-but-soft spring. Low mass + high stiffness = fast settle with a
// hair of overshoot on release, which reads as "alive" without wobbling.
const PRESS_SPRING = { damping: 18, stiffness: 260, mass: 0.6 } as const;
const RELEASE_SPRING = { damping: 14, stiffness: 220, mass: 0.6 } as const;

export type PressableScaleHaptic = 'selection' | 'light' | 'medium' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children?: ReactNode;
  /** Static style(s) for the pressable. Animated transform is merged in. */
  style?: StyleProp<ViewStyle>;
  /** Scale target while pressed. Default 0.96 (subtle). Use ~0.9 for chips. */
  scaleTo?: number;
  /** Haptic fired on press-in. Default 'selection'. 'none' to disable. */
  haptic?: PressableScaleHaptic;
}

function fireHaptic(kind: PressableScaleHaptic): void {
  switch (kind) {
    case 'selection':
      Haptics.selectionAsync().catch(() => {});
      break;
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      break;
    case 'none':
    default:
      break;
  }
}

export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = 'selection',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps): JSX.Element {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={(e) => {
        // Owner-requested diagnostics: PressableScale is the standard tappable,
        // so logging here captures essentially every deliberate tap in the app
        // with one change instead of touching ~70 call sites. We record the
        // accessibility label (already required on every tappable by the UI
        // audit), never the surrounding content — no health data.
        const label =
          typeof rest.accessibilityLabel === 'string' && rest.accessibilityLabel.length > 0
            ? rest.accessibilityLabel
            : 'unlabelled';
        log.tap(label);
        onPress?.(e);
      }}
      onPressIn={(e) => {
        if (!disabled) {
          if (!reduceMotion) scale.value = withSpring(scaleTo, PRESS_SPRING);
          fireHaptic(haptic);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.value = withSpring(1, RELEASE_SPRING);
        onPressOut?.(e);
      }}
      // NOTE: we deliberately DON'T auto-dim on `disabled`. Callers own the
      // disabled look — a day cell that's merely non-tappable shouldn't grey
      // out, a locked row already carries its own 0.55, and GradientButton
      // dims itself only when disabled AND not loading (so a spinner shows
      // on a full-opacity pill). A blanket opacity here fought all three.
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
