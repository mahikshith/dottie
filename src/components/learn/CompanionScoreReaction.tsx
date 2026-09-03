/**
 * Dottie — CompanionScoreReaction (Learn Quest · design-v2)
 *
 * The spirit companion REACTING to a score — the "Duo is mind-blown at 100%"
 * moment the owner asked for, in place of the old generic leaf/star emoji.
 *
 * ─── THE INTERACTION MODEL (the "research" behind it) ────────────────
 *
 *  Duolingo's end-of-lesson reaction does three things at once, and we mirror
 *  each with what we have today (emoji companion now, drop-in Lottie later):
 *
 *   1. The CHARACTER expresses the outcome — not a neutral trophy. We keep the
 *      user's own companion (identity matters) and drive its `state` by score:
 *        100%  → celebrate  (biggest reaction)
 *        ≥80%  → celebrate  (passed / "amazing")
 *        ≥50%  → encourage  ("nice progress, keep going")
 *        <50%  → cozy       (soft + supportive — NEVER punishing; Apple's
 *                            *Responsibility* + our own "low stays warm" rule)
 *   2. A short, punchy HEADLINE keyed to the same band ("Mind = blown!" at 100).
 *   3. MOTION carries the emotion: a spring pop-in + a state-appropriate loop
 *      (an excited bob for wins, a gentle sway for a soft landing). Reduce-Motion
 *      users get the still character with the same expression + headline.
 *
 *  A small EXPRESSION BADGE (🤯/🎉/💪/🫂) overlays the companion so the emoji
 *  fallback still reads an emotion before real illustrated art is wired. When a
 *  companion Lottie lands for `celebrate`/`encourage`/`cozy`, the SAME call
 *  upgrades to the illustrated reaction with zero changes here.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
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

// ─── SCORE BANDS ─────────────────────────────────────────────────────

export interface ScoreReaction {
  state: CompanionAnim;
  badge: string;
  headline: string;
  /** Accent role: a win glows success, a soft landing stays warm/neutral. */
  tone: 'perfect' | 'great' | 'okay' | 'soft';
}

/** Maps a 0..1 score to the companion's reaction. Exported for result copy. */
export function reactionForScore(score: number): ScoreReaction {
  if (score >= 1) return { state: 'celebrate', badge: '🤯', headline: 'Mind = blown!', tone: 'perfect' };
  if (score >= 0.8) return { state: 'celebrate', badge: '🎉', headline: 'Amazing!', tone: 'great' };
  if (score >= 0.5) return { state: 'encourage', badge: '💪', headline: 'Nice progress!', tone: 'okay' };
  return { state: 'cozy', badge: '🫂', headline: 'Every rep counts', tone: 'soft' };
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export interface CompanionScoreReactionProps {
  companionType: CompanionType;
  /** 0..1. */
  score: number;
  size?: number;
  /** Colour for the headline (usually the result accent). */
  headlineColor: string;
  /** Optional sub-headline colour for the badge ring. */
  badgeBg: string;
}

export function CompanionScoreReaction({
  companionType,
  score,
  size = 128,
  headlineColor,
  badgeBg,
}: CompanionScoreReactionProps): JSX.Element {
  const reduce = useReducedMotion();
  const r = reactionForScore(score);
  const excited = r.tone === 'perfect' || r.tone === 'great';

  // Pop-in on mount, then a state-appropriate idle loop.
  const pop = useSharedValue(reduce ? 1 : 0);
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pop.value = withSpring(1, { damping: 9, stiffness: 140, mass: 0.7 });
    bob.value = withDelay(
      420,
      withRepeat(
        excited
          ? withSequence(
              withTiming(-10, { duration: 300, easing: Easing.out(Easing.quad) }),
              withTiming(0, { duration: 340, easing: Easing.bounce }),
              withDelay(500, withTiming(0, { duration: 1 })),
            )
          : withSequence(
              withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
            ),
        -1,
        false,
      ),
    );
  }, [reduce, excited, pop, bob]);

  const charStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + pop.value * 0.4 }, { translateY: bob.value }],
    opacity: pop.value,
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : pop.value }],
    opacity: pop.value,
  }));

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={r.headline}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={charStyle}>
          {/* The real animated character, with the emotion layered over it.
              A PERFECT run gets the 🤯 moment animation on top — visibly a
              bigger event than the 🎉 an 80% gets, which is the whole point of
              a top-of-the-ladder reaction. Reduce Motion falls back to the
              drawn rig holding a still 'mindblown' pose (see CompanionLottie). */}
          <CompanionLottie
            type={companionType}
            state={r.state}
            size={size}
            loop={!excited}
            moment={score >= 1 ? 'quiz_perfect' : score >= 0.8 ? 'confetti' : null}
          />
        </Animated.View>
        <Animated.View
          style={[styles.badge, { backgroundColor: badgeBg, borderColor: headlineColor }, badgeStyle]}
          pointerEvents="none"
        >
          <Text style={styles.badgeText}>{r.badge}</Text>
        </Animated.View>
      </View>
      <Text style={[styles.headline, { color: headlineColor }]}>{r.headline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 20 },
  headline: { ...Typography.preset.h3, marginTop: Spacing.sm, textAlign: 'center' },
});
