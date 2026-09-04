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

  // ── ONE COMPANION, ONE LOOK, EVERY EXPRESSION ─────────────────────
  //
  //  The character is ALWAYS the drawn rig now. The previous build sent `idle`
  //  to a Noto Animated Emoji file and every other state to the rig — two
  //  completely different drawings of the same animal. So the moment the user
  //  logged a mood, their orange emoji cat was replaced by the rig's grey cat
  //  and it read as "a different spirit companion showed up" (device-test-8).
  //  Worse, the emoji file is a single fixed grin: picking Nyx and getting only
  //  a smiley patch was exactly that file.
  //
  //  A companion the user chose has to be recognisably the same creature on
  //  every screen and in every mood, and it has to be able to look sad. Only
  //  the rig can do both — it draws one body per species and moves the brows,
  //  eye openness and mouth per state (`expressionFor`). So the rig is no
  //  longer the fallback; it IS the companion.
  //
  //  The licensed Noto art is still used, but only for MOMENT overlays
  //  (confetti, mind-blown, hug) — those are companion-agnostic effects where a
  //  fixed performance is the right thing, and they play as a corner badge so
  //  they never cover the face.
  const intensity = STATE_INTENSITY[state] ?? 1;

  // The moment overlay is the only Lottie left on this path.
  const overlay = moment === null ? null : getMomentLottie(moment ?? DEFAULT_MOMENT[state] ?? 'confetti');
  const showOverlay =
    !reduce && moment !== null && (moment !== undefined || DEFAULT_MOMENT[state] !== undefined);

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <CompanionCreature
        type={type}
        state={ANIM_TO_STATE[state]}
        intensity={intensity}
        size={size}
      />
      {showOverlay && overlay != null && (
        // A corner BADGE, not a full-size layer. Playing it at the character's
        // own size drew confetti straight over the face (owner screenshot).
        <View
          style={[styles.badge, { width: size * 0.42, height: size * 0.42 }]}
          pointerEvents="none"
        >
          <LottieView
            source={overlay as LottieViewProps['source']}
            autoPlay
            loop
            speed={1}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      )}
    </View>
  );
}

/**
 * How STRONGLY the rig plays each state (`expressionFor(state, intensity)`
 * scales brow tilt, eye openness, mouth curve and bounce by this). A low day is
 * deliberately gentle rather than a big sad performance — someone who just
 * logged "rough" should not be emoted at.
 */
// (`expressionFor` clamps to 0..1, so 1 is the full performance.)
const STATE_INTENSITY: Record<CompanionAnim, number> = {
  idle: 0.7,
  encourage: 1,
  proud: 1,
  celebrate: 1,
  cozy: 0.8,
  sad: 0.85,
  // DT18 conversation faces. The quiet, listening ones are deliberately played
  // DOWN — a companion that performs while you are still reading the question
  // is a distraction, not a character.
  curious: 0.9,
  thinking: 0.6,
  surprised: 1,
  wink: 1,
  laugh: 1,
  shy: 0.9,
  determined: 0.85,
  cheer: 1,
  confused: 0.8,
  relieved: 0.8,
};

/** The moment animation a state gets when the caller doesn't specify one. */
const DEFAULT_MOMENT: Partial<Record<CompanionAnim, MomentAnim>> = {
  celebrate: 'confetti',
};

/**
 * Animation names map onto the creature rig's emotional states. Explicit so a
 * new state can't silently fall through to a wrong expression.
 */
const ANIM_TO_STATE: Record<CompanionAnim, CreatureState> = {
  idle: 'idle',
  celebrate: 'celebrate',
  encourage: 'happy',
  cozy: 'caring',
  proud: 'proud',
  sad: 'sad',
  // DT18 conversation faces — one-to-one with the rig.
  curious: 'curious',
  thinking: 'thinking',
  surprised: 'surprised',
  wink: 'wink',
  laugh: 'laugh',
  shy: 'shy',
  determined: 'determined',
  cheer: 'cheer',
  confused: 'confused',
  relieved: 'relieved',
};

const styles = StyleSheet.create({
  badge: { position: 'absolute', right: -2, top: -2 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
