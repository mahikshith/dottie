/**
 * Dottie — CompanionLottie (design-v2)
 *
 * The ONE way any screen renders a spirit companion. It looks the companion +
 * state up in the Lottie manifest (`src/content/companion-lottie.ts`):
 *   • art wired → renders the illustrated Lottie animation
 *   • not yet   → renders the companion's EMOJI, gently breathing
 *
 * So Learn/Calendar/celebration screens call `<CompanionLottie type="fox"
 * state="celebrate" />` today and get the emoji spirit-animal; the day the
 * illustrated `.json` lands in `assets/lottie/` and is wired into the manifest,
 * the SAME call renders the real character — no screen changes. This is the
 * drop-in seam the whole "Duolingo characters" direction hangs on.
 *
 * Motion is Reduce-Motion aware: the Lottie is paused (first frame) and the
 * emoji fallback is static when the user asks for reduced motion.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). `lottie-react-native` (Apache-2.0) is
 *  a listed dependency but needs a native/dev build to render — consistent with
 *  the app already requiring one (MMKV). With no art wired, this component never
 *  renders a LottieView, so it's inert on the emoji path.
 */

import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { BreathingView } from './BreathingView';
import { getCompanionLottie, type CompanionAnim } from '../../content/companion-lottie';
import { getCompanion } from '../../content/companions';
import type { CompanionType } from '../../types/content.types';

export interface CompanionLottieProps {
  /** Which spirit companion to show. */
  type: CompanionType;
  /** Animation state — defaults to a gentle idle loop. */
  state?: CompanionAnim;
  /** Square render size in px. Default 96. */
  size?: number;
  /** Loop the Lottie (ignored for the emoji fallback). Default true. */
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CompanionLottie({
  type,
  state = 'idle',
  size = 96,
  loop = true,
  style,
}: CompanionLottieProps): JSX.Element {
  const reduce = useReducedMotion();
  const asset = getCompanionLottie(type, state);

  // ── Illustrated path: real Lottie art has been wired for this state ──
  if (asset != null) {
    return (
      <LottieView
        source={asset as LottieViewProps['source']}
        autoPlay={!reduce}
        loop={loop && !reduce}
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  // ── Fallback path: the emoji spirit-animal, gently breathing ────────
  const glyph = (
    <Text style={[styles.emoji, { fontSize: Math.round(size * 0.62) }]}>
      {getCompanion(type).emoji}
    </Text>
  );

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      {reduce ? glyph : <BreathingView>{glyph}</BreathingView>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
});
