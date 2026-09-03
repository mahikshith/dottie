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

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { CompanionCreature } from './creature/CompanionCreature';
import type { CreatureState } from './creature/expressions';
import {
  getCompanionLottie,
  getMomentLottie,
  type CompanionAnim,
  type MomentAnim,
} from '../../content/companion-lottie';
import type { CompanionType } from '../../types/content.types';

export interface CompanionLottieProps {
  /** Which spirit companion to show. */
  type: CompanionType;
  /** Animation state — defaults to a gentle idle loop. */
  state?: CompanionAnim;
  /** Square render size in px. Default 96. */
  size?: number;
  /** Loop the Lottie. Default true. */
  loop?: boolean;
  /**
   * A big-moment animation layered OVER the character (🤯 / 🎉 / 🤗).
   * Pass explicitly for a peak moment; otherwise a sensible one is chosen from
   * the state. Pass null to force none.
   */
  moment?: MomentAnim | null;
  style?: StyleProp<ViewStyle>;
}

export function CompanionLottie({
  type,
  state = 'idle',
  size = 96,
  loop = true,
  moment,
  style,
}: CompanionLottieProps): JSX.Element {
  const reduce = useReducedMotion();
  const asset = getCompanionLottie(type, state);

  // ── Reduce Motion: a STILL but correctly-EXPRESSED pose ────────────
  // A paused Lottie freezes on whatever frame it starts at, which may show the
  // character mid-blink and reads as broken. The drawn rig can hold a real
  // expression without moving, so it's the better still.
  if (reduce || asset == null) {
    return (
      <View style={[{ width: size, height: size }, styles.center, style]}>
        <CompanionCreature type={type} state={ANIM_TO_STATE[state]} size={size} />
      </View>
    );
  }

  // ── Illustrated path: real open-source Lottie art ──────────────────
  // Each companion file is ONE looping performance (Noto Animated Emoji can't
  // pull a sad face), so the EMOTION is carried around it: the tempo changes,
  // and a moment animation plays over the top for the peaks.
  const overlay = moment === null ? null : getMomentLottie(moment ?? DEFAULT_MOMENT[state] ?? 'confetti');
  const showOverlay = moment !== null && (moment !== undefined || DEFAULT_MOMENT[state] !== undefined);

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <LottieView
        source={asset as LottieViewProps['source']}
        autoPlay
        loop={loop}
        speed={STATE_SPEED[state]}
        style={{ width: size, height: size }}
      />
      {showOverlay && overlay != null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LottieView
            source={overlay as LottieViewProps['source']}
            autoPlay
            loop
            speed={1}
            style={{ width: size, height: size }}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Playback tempo per state. This is most of what makes one performance read as
 * several: a companion that idles calmly, quickens when pleased, and slows right
 * down on a low day is doing real emotional work with one asset.
 */
const STATE_SPEED: Record<CompanionAnim, number> = {
  idle: 1,
  encourage: 1.2,
  proud: 1.1,
  celebrate: 1.6,
  cozy: 0.6,
  sad: 0.55,
};

/** The moment animation a state gets when the caller doesn't specify one. */
const DEFAULT_MOMENT: Partial<Record<CompanionAnim, MomentAnim>> = {
  celebrate: 'confetti',
};

/**
 * The Lottie manifest's animation names map onto the creature rig's emotional
 * states, used for the Reduce-Motion still. Explicit so a new state can't
 * silently fall through to a wrong expression.
 */
const ANIM_TO_STATE: Record<CompanionAnim, CreatureState> = {
  idle: 'idle',
  celebrate: 'celebrate',
  encourage: 'happy',
  cozy: 'sleepy',
  proud: 'proud',
  sad: 'sad',
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
