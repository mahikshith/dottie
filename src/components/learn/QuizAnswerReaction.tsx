/**
 * Dottie — QuizAnswerReaction
 *
 * The spirit companion reacting to a SINGLE quiz answer — the per-question
 * sibling of CompanionScoreReaction (which reacts to the final score). This is
 * the "Duolingo owl celebrates / gently encourages" moment, on every answer,
 * so the empty space under the question fills with something alive.
 *
 * ─── WARM RULE (non-negotiable) ─────────────────────────────────────
 *
 *  A wrong answer NEVER gets a punishing or angry face. Dottie's whole voice is
 *  supportive — a miss gets a cozy companion + "good try!", the same "low stays
 *  warm" rule CompanionScoreReaction follows. Even the most frustrated user
 *  should feel encouraged, not scolded.
 *
 * ─── MOTION ─────────────────────────────────────────────────────────
 *
 *  Correct → an excited pop + a springy bob (a little hop of joy).
 *  Wrong   → a soft pop + a gentle sway (a reassuring "it's okay" nod).
 *  An expression badge (🎉 / 💪 …) overlays the companion so the emoji
 *  fallback reads an emotion until real Lottie art is wired. Reduce Motion
 *  shows the still companion + badge + headline. UI-thread only.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { CompanionLottie } from '../ui';
import type { CompanionAnim } from '../../content/companion-lottie';
import type { CompanionType } from '../../types/content.types';

// Rotating headlines keep repeated answers from feeling canned.
const CORRECT_HEADLINES = ['Correct!', 'Nailed it!', 'Yes! 🎉', 'Brilliant!', 'Spot on!'];
const WRONG_HEADLINES = ['Good try!', 'Almost!', 'Not quite —', 'So close!', "That's okay!"];

const CORRECT_BADGES = ['🎉', '⭐', '✨', '🙌'];
const WRONG_BADGES = ['💪', '🫂', '🌱'];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

export interface QuizAnswerReactionProps {
  companionType: CompanionType;
  correct: boolean;
  /** Varies the headline/badge so repeats don't feel canned (e.g. question index). */
  seed?: number;
  size?: number;
  headlineColor: string;
  badgeBg: string;
}

export function QuizAnswerReaction({
  companionType,
  correct,
  seed = 0,
  size = 96,
  headlineColor,
  badgeBg,
}: QuizAnswerReactionProps): JSX.Element {
  const reduce = useReducedMotion();

  const state: CompanionAnim = correct ? 'celebrate' : 'cozy';
  const badge = correct ? pick(CORRECT_BADGES, seed) : pick(WRONG_BADGES, seed);
  const headline = correct ? pick(CORRECT_HEADLINES, seed) : pick(WRONG_HEADLINES, seed);

  const pop = useSharedValue(reduce ? 1 : 0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    pop.value = withSpring(1, { damping: 9, stiffness: 150, mass: 0.7 });
    bob.value = withDelay(
      360,
      withRepeat(
        correct
          ? withSequence(
              withTiming(-9, { duration: 280, easing: Easing.out(Easing.quad) }),
              withTiming(0, { duration: 320, easing: Easing.bounce }),
              withDelay(560, withTiming(0, { duration: 1 })),
            )
          : withSequence(
              withTiming(-3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            ),
        -1,
        false,
      ),
    );
    // Re-run the reaction each time a new answer flips `correct`/`seed`.
  }, [reduce, correct, seed, pop, bob]);

  const charStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + pop.value * 0.4 }, { translateY: bob.value }],
    opacity: pop.value,
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : pop.value }],
    opacity: pop.value,
  }));

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={headline}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={charStyle}>
          <CompanionLottie type={companionType} state={state} size={size} loop={!correct} />
        </Animated.View>
        <Animated.View
          style={[styles.badge, { backgroundColor: badgeBg, borderColor: headlineColor }, badgeStyle]}
          pointerEvents="none"
        >
          <Text style={styles.badgeText}>{badge}</Text>
        </Animated.View>
      </View>
      <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 17 },
  headline: { ...Typography.preset.h4, marginTop: Spacing.xs, textAlign: 'center' },
});
