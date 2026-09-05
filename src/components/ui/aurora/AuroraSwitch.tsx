/**
 * Dottie — AuroraSwitch
 *
 * The app's on/off control. A drawn track with a knob that TRAVELS.
 *
 * ─── WHY NOT React Native's <Switch> ────────────────────────────────
 *
 *  DT21, owner, about the Reminders screen: "It should be a toggle button, but
 *  the buttons are working, the notifications are coming. Problem is, it's not
 *  a toggle button."
 *
 *  They were looking at a real `<Switch>`. The problem is what it looks like on
 *  this app's ground: Android draws the Material switch with a hairline track,
 *  and ours was tinted `palette.glass.edge` — a ~10% white line on a near-black
 *  card. The track effectively vanished and all that survived was a small white
 *  dot, which reads as a bullet, a radio button, or a status light. Nothing
 *  about it says "drag me / tap me and I flip".
 *
 *  It is also the one control in the app that ignored the design system
 *  entirely: no glass, no warm shadow, no press response, and a platform-
 *  dependent size we cannot align to the 4px grid.
 *
 *  So this draws it: a 52×32 track that is clearly a channel, a 26px knob that
 *  clearly sits at one END of that channel, and a spring that carries it across
 *  so the state change is something you WATCH rather than something you notice
 *  afterwards. Off is not just "dim" — the track is visibly empty and the knob
 *  sits left; on fills the track with the accent and pushes the knob right.
 *
 * ─── ACCESSIBILITY ──────────────────────────────────────────────────
 *
 *  `accessibilityRole="switch"` + `accessibilityState.checked` is what makes a
 *  screen reader announce "on/off, switch" and offer the toggle action — the
 *  same contract the platform Switch has. The whole 52×32 target plus 8px of
 *  slop clears the 48dp minimum in both axes.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { PressableScale } from '../PressableScale';
import { Shadows } from '../../../constants/shadows';
import { useAurora } from '../../../theme';

const TRACK_W = 52;
const TRACK_H = 32;
const KNOB = 26;
const PAD = (TRACK_H - KNOB) / 2;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

/** Snappy but not twitchy — the knob should land, not vibrate. */
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 } as const;

export interface AuroraSwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Track colour when ON. Defaults to the live mood accent. */
  onColor?: string;
  /**
   * Which ground this switch sits on. The OFF track is the whole point of the
   * control — an off state you cannot see is the bug this component exists to
   * fix — and glass (translucent white) only reads on the aurora ground. The
   * one cream screen left in the app (Ghost Mode) passes 'light'.
   */
  surface?: 'dark' | 'light';
  /** What this switch controls, for screen readers. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Off-track fill/edge for a cream surface, where glass is invisible. */
const LIGHT_OFF_FILL = '#E4D7CC';
const LIGHT_OFF_EDGE = '#CDBBAD';

export function AuroraSwitch({
  value,
  onValueChange,
  disabled,
  onColor,
  surface = 'dark',
  accessibilityLabel,
  accessibilityHint,
  style,
}: AuroraSwitchProps): JSX.Element {
  const { palette } = useAurora();
  const reduce = useReducedMotion();

  // Derived from the prop rather than held in a shared value: the parent owns
  // the state (it persists and reschedules), so the switch must never disagree
  // with it — including when a save fails and the value comes back unchanged.
  const t = useDerivedValue(() =>
    reduce ? (value ? 1 : 0) : withSpring(value ? 1 : 0, SPRING)
  );
  const fill = useDerivedValue(() =>
    reduce ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: 180 })
  );

  const onTrack = onColor ?? palette.accent;
  const offFill = surface === 'light' ? LIGHT_OFF_FILL : palette.glass.bg;
  const offEdge = surface === 'light' ? LIGHT_OFF_EDGE : palette.glass.edge;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [offFill, onTrack]),
    borderColor: interpolateColor(fill.value, [0, 1], [offEdge, onTrack]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * TRAVEL }],
  }));

  return (
    <PressableScale
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      haptic="light"
      scaleTo={0.94}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[styles.tap, disabled ? styles.disabled : null, style]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]}>
          {/* A hairline ring keeps the white knob from dissolving into the
              accent track at the "on" end. */}
          <View style={styles.knobRing} />
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tap: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1.5,
    padding: PAD,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    // Warm shadow from the design system — never an ad-hoc grey. On Android
    // this is elevation only, which is all the platform has.
    ...Shadows.sm,
  },
  knobRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: KNOB / 2,
    borderWidth: 1,
    borderColor: 'rgba(12,10,22,0.18)',
  },
});
