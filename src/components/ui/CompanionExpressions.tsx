/**
 * Dottie — CompanionExpressions
 *
 * ONE companion, cycling through its emotional range in place.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, device-test-16: "all the expressions of each and every single
 *  companion needs to be expressed so that the user will look at it and find
 *  out what they want, based upon the companion that they want to set up."
 *
 *  That is the right instinct. Both picker screens showed ONE static text
 *  emoji per companion — 🐰 — which tells you the species and nothing else.
 *  But the species is the least interesting thing about the choice: what the
 *  user is actually picking is a face that will react to them for months.
 *
 * ─── WHY IT IS NO LONGER A ROW OF THREE ─────────────────────────────
 *
 *  DT21, owner: "for each companion, for example, take let's say Luna, right?
 *  Why are we giving three Lunas in a single pane? We need to have one single
 *  companion with different expressions, different chaining expressions."
 *
 *  Exactly right, and for a reason worth writing down: three faces side by
 *  side don't read as one character in three moods, they read as THREE
 *  CHARACTERS. The card is answering "which companion do you want", so putting
 *  three of them in the answer is the one thing it must not do. Three rigs
 *  also cost three times the draw and left each face at ~20px, which is under
 *  the size where an expression is legible at all.
 *
 *  So: one companion, at a size you can actually read, changing its face on a
 *  slow loop. The range arrives over time instead of over space — which is
 *  also how you'll meet it in the app.
 *
 * ─── MOTION ─────────────────────────────────────────────────────────
 *
 *  The face swaps INSTANTLY and the new one fades and pops in. There is
 *  deliberately no fade-out-then-swap: that needs a completion callback to
 *  carry the state change, and a Reanimated callback reports `finished: false`
 *  when interrupted, which would strand the companion permanently dimmed
 *  (DT19-9 was exactly that bug on the mood overlay). Rising-only animation
 *  cannot strand — the worst case is a face that arrived without its pop.
 *
 *  Reduce Motion holds the first face and never cycles.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../../constants/typography';
import { A } from '../../theme/aurora-static';
import { CompanionCreature } from './creature/CompanionCreature';
import type { CompanionType } from '../../types/companion.types';
import type { CreatureState } from './creature/expressions';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The reel.
 *
 * Not a random sample and not the whole 26 — these are the beats you will
 * actually live with, in an order that tells a small story: ordinary day,
 * pleased, a win, asking you something, playful, and then the one that
 * matters most — how it behaves when your day has been hard.
 */
const DEFAULT_FACES: readonly CreatureState[] = [
  'idle',
  'happy',
  'celebrate',
  'curious',
  'wink',
  'proud',
  'caring',
  'sad',
];

/**
 * Plain-language names. The rig's state keys are engineering words
 * ('caring', 'idle'); what the user needs is what the moment IS.
 */
const FACE_LABEL: Partial<Record<CreatureState, string>> = {
  idle: 'an ordinary day',
  happy: 'pleased',
  celebrate: 'when you win',
  mindblown: 'blown away',
  curious: 'asking you something',
  thinking: 'thinking it over',
  wink: 'in on the joke',
  laugh: 'delighted',
  proud: 'proud of you',
  caring: 'when yours has been hard',
  sad: 'a low day',
  cheer: 'rooting for you',
  excited: 'excited',
  sleepy: 'sleepy',
  love: 'fond of you',
  queasy: 'a rough day',
  determined: 'ready to try again',
};

/** How long each face is held, in ms. Slow enough to actually look at. */
const HOLD_MS = 1700;

export interface CompanionExpressionsProps {
  type: CompanionType;
  /** Which faces to cycle through, in order. Defaults to the eight-beat reel. */
  faces?: readonly CreatureState[];
  /** Square size of the companion. */
  size?: number;
  /** Name the current mood underneath. Default true. */
  showLabel?: boolean;
  /** Stop on the first face (e.g. an unselected card). Default true. */
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CompanionExpressions({
  type,
  faces = DEFAULT_FACES,
  size = 84,
  showLabel = true,
  playing = true,
  style,
}: CompanionExpressionsProps): JSX.Element {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const enter = useSharedValue(1);

  const count = faces.length;
  const face = faces[index % count] ?? 'idle';

  useEffect(() => {
    if (reduce || !playing || count < 2) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % count), HOLD_MS);
    return () => clearInterval(id);
  }, [reduce, playing, count]);

  // Reset to the first face whenever the reel stops, so a card that is no
  // longer selected doesn't keep whatever mood it happened to be wearing.
  useEffect(() => {
    if (!playing) setIndex(0);
  }, [playing]);

  useEffect(() => {
    if (reduce) return;
    enter.value = 0;
    enter.value = withTiming(1, { duration: 260, easing: EASE_OUT });
  }, [index, reduce, enter]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + enter.value * 0.65,
    transform: [{ scale: 0.94 + enter.value * 0.06 }],
  }));

  const label = FACE_LABEL[face];

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Animated.View style={enterStyle}>
        <CompanionCreature type={type} state={face} intensity={0.9} size={size} />
      </Animated.View>
      {showLabel && label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { ...Typography.preset.caption, fontSize: 10, color: A.ink3, letterSpacing: 0.2 },
});
