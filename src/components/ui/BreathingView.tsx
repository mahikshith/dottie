/**
 * Dottie — BreathingView
 *
 * Wraps any content in a slow, gentle "breathing" scale loop. Used for
 * the companion mascot on the hero screens so it feels alive and present
 * rather than a static sticker — the small ambient motion that separates
 * a premium app from a template.
 *
 * ─── DESIGN NOTES ───────────────────────────────────────────────────
 *
 *  - Very subtle by default (1.0 → 1.05) and slow (~2.6s per breath) so
 *    it's felt more than seen. Aggressive pulsing would read as a
 *    notification, not calm.
 *  - Runs entirely on the UI thread (Reanimated) so it never competes
 *    with JS work — stays smooth during navigation/store updates.
 *  - Honors "Reduce Motion": renders perfectly still when the user has
 *    asked the OS to minimize animation.
 *  - Cancels its animation on unmount so no worklet keeps looping behind
 *    a torn-down screen.
 */

import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

export interface BreathingViewProps {
  children: ReactNode;
  /** Peak scale at the top of each breath. Default 1.05. */
  maxScale?: number;
  /** Milliseconds for one half-breath (in, then out). Default 2600. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function BreathingView({
  children,
  maxScale = 1.05,
  duration = 2600,
  style,
}: BreathingViewProps): JSX.Element {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    // `true` (reverse) makes each repetition play back down, giving a
    // seamless 1 → maxScale → 1 loop with a soft ease at both ends.
    scale.value = withRepeat(
      withTiming(maxScale, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(scale);
  }, [reduceMotion, maxScale, duration, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
