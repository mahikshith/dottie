/**
 * Dottie — PopOnChange
 *
 * Wraps content that represents a changing value (a streak count, a gem
 * balance) and gives it a quick, satisfying "pop" whenever the value
 * changes — a tiny reward animation that makes logging feel responsive.
 *
 * ─── WHY A POP, NOT A ROLLING COUNTER ───────────────────────────────
 *
 *  Animating the digits themselves (a rolling odometer) requires either
 *  re-rendering Text every frame from JS (janky) or a heavier component.
 *  A UI-thread scale "pop" on change delivers ~90% of the delight at a
 *  fraction of the cost and zero jank, so it's the right call for the
 *  home dashboard where several of these can update at once.
 *
 * ─── FIRST-RENDER GUARD ─────────────────────────────────────────────
 *
 *  We skip the pop on the very first render (initial hydration) so the
 *  screen doesn't "pop" everything on load — only genuine changes after
 *  mount animate. Reduce Motion disables the pop entirely.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';

export interface PopOnChangeProps {
  /** The value to watch. A change (by ===) triggers the pop. */
  value: number | string;
  children: ReactNode;
  /** Peak scale of the pop. Default 1.22. */
  popScale?: number;
  style?: StyleProp<ViewStyle>;
}

export function PopOnChange({
  value,
  children,
  popScale = 1.22,
  style,
}: PopOnChangeProps): JSX.Element {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (reduceMotion) return;
    // Quick punch up, springy settle back — the classic "juice" curve.
    scale.value = withSequence(
      withTiming(popScale, { duration: 130 }),
      withSpring(1, { damping: 10, stiffness: 240, mass: 0.5 })
    );
  }, [value, reduceMotion, popScale, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
