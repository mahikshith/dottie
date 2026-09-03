/**
 * Dottie — CompanionWave
 *
 * A one-shot "hello!" the companion gives when a screen opens: a little pop +
 * a friendly wiggle, then it rests. Meant to wrap the hero companion (which is
 * already inside a BreathingView idle loop) so opening the app feels like the
 * companion greets you, not like a static emoji.
 *
 * Pure transform (scale + rotate) on the UI thread. Reduce Motion → no wave
 * (the gentle breathing underneath is enough).
 */

import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export interface CompanionWaveProps {
  children: React.ReactNode;
  /** Delay before the wave plays (ms). Lets the screen settle first. */
  delay?: number;
}

export function CompanionWave({ children, delay = 320 }: CompanionWaveProps): JSX.Element {
  const reduce = useReducedMotion();
  const rot = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    rot.value = withDelay(
      delay,
      withSequence(
        withTiming(-10, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(10, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        withTiming(-6, { duration: 120, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) }),
      ),
    );
    pop.value = withDelay(
      delay,
      withSequence(
        withTiming(1.18, { duration: 160, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 150, mass: 0.6 }),
      ),
    );
    // Play once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${rot.value}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
