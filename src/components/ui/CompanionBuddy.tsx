/**
 * Dottie — CompanionBuddy
 *
 * A small, LIVELY spirit-animal companion you can drop onto ANY screen so the
 * character is present across the app — guiding the prediction explainer under
 * the Calendar, popping on the You tab near the sections, cheering on Home, etc.
 * The owner's ask: the spirit animal should feel alive everywhere — greet you,
 * periodically "peek" to catch your eye, and react when you tap it. That
 * playful presence is what makes the app sticky.
 *
 * ─── WHAT IT DOES ───────────────────────────────────────────────────
 *
 *  • greet   — a one-shot pop + wiggle when the screen opens.
 *  • idle    — a gentle breathing loop so it's never a dead emoji.
 *  • peek    — every few seconds, a quick attention hop + head-tilt wiggle
 *              ("hey, look at me!") — the eye-catcher.
 *  • tap     — tap it and it does a happy bounce + a selection haptic.
 *
 *  Uses <CompanionLottie> for the visual, so it shows the animated EMOJI today
 *  and upgrades to real illustrated Lottie art (eyes going big, etc.) with zero
 *  changes here the moment art is wired into the manifest.
 *
 *  All motion is transform-only on the UI thread. Reduce Motion → a still,
 *  friendly companion (no hop/wiggle), tap still gives haptic feedback.
 */

import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CompanionLottie } from './CompanionLottie';
import type { CompanionType } from '../../types/content.types';

export interface CompanionBuddyProps {
  type: CompanionType;
  size?: number;
  /** Periodic "peek" attention animation. Default true. */
  lively?: boolean;
  /** One-shot greet pop on mount. Default true. */
  greet?: boolean;
  /** Tap to make it react (+ haptic). Default true. */
  interactive?: boolean;
  /** Called after the tap reaction (e.g. navigate, show a tip). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function CompanionBuddy({
  type,
  size = 56,
  lively = true,
  greet = true,
  interactive = true,
  onPress,
  style,
  accessibilityLabel = 'Your companion',
}: CompanionBuddyProps): JSX.Element {
  const reduce = useReducedMotion();

  const breathe = useSharedValue(1);
  const peek = useSharedValue(0); // 0..1 pulse, drives hop + wiggle
  const greetV = useSharedValue(greet && !reduce ? 0 : 1);
  const tapV = useSharedValue(0); // one-shot scale/rot bump

  useEffect(() => {
    if (reduce) return;

    // Gentle idle breathing.
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Greet: pop in on mount.
    if (greet) {
      greetV.value = withSequence(
        withTiming(1.16, { duration: 170, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 150, mass: 0.6 }),
      );
    }

    // Periodic peek — a hop + head wiggle every ~5s to catch the eye.
    if (lively) {
      peek.value = withDelay(
        2200,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 380, easing: Easing.inOut(Easing.ease) }),
            withDelay(4200, withTiming(0, { duration: 1 })),
          ),
          -1,
          false,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, lively, greet]);

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (!reduce) {
      tapV.value = withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 7, stiffness: 200, mass: 0.5 }),
      );
    }
    onPress?.();
  };

  const animStyle = useAnimatedStyle(() => {
    const hop = interpolate(peek.value, [0, 0.5, 1], [0, -size * 0.14, 0]);
    const wiggle = interpolate(peek.value, [0, 0.25, 0.5, 0.75, 1], [0, -7, 0, 7, 0]);
    const scale = breathe.value * greetV.value * (1 + tapV.value * 0.22);
    const tapWiggle = interpolate(tapV.value, [0, 0.5, 1], [0, 8, 0]);
    return {
      transform: [
        { translateY: hop },
        { scale },
        { rotate: `${wiggle + tapWiggle}deg` },
      ],
    };
  });

  const content = (
    <Animated.View style={animStyle}>
      <CompanionLottie type={type} state="idle" size={size} loop />
    </Animated.View>
  );

  if (!interactive) {
    return (
      <View style={[styles.wrap, style]} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.wrap, style]}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
