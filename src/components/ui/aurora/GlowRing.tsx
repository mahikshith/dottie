/**
 * Dottie — GlowRing (design-v2)
 *
 * The signature cycle-progress ring: a glowing accent-gradient arc that draws
 * itself in on mount (a "line-drawing" reveal), with content (usually the day
 * number) in the centre. Reads the accent gradient from the active palette.
 *
 * ─── MOTION (animate-expo) ──────────────────────────────────────────
 *
 *  The draw animates `strokeDashoffset` on the UI thread via
 *  `useAnimatedProps` on an animated <Circle> — transform/opacity-class work,
 *  no layout. Reduce Motion → the ring appears already filled (no draw).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Confirm the SVG gradient stroke +
 *  the animated draw render correctly; the accent glow (RN view shadow on an
 *  SVG) may need tuning per platform.
 */

import { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAurora } from '../../../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1); // animate-expo strong ease-out

export interface GlowRingProps {
  /** 0..1 progress (e.g. dayInCycle / cycleLength). */
  progress: number;
  /** Ring diameter in px. Default 96. */
  size?: number;
  /** Stroke width. Default 7. */
  stroke?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GlowRing({
  progress,
  size = 96,
  stroke = 7,
  children,
  style,
}: GlowRingProps): JSX.Element {
  const { palette } = useAurora();
  const reduce = useReducedMotion();

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const target = c * (1 - clamped);

  const offset = useSharedValue(reduce ? target : c);
  useEffect(() => {
    if (reduce) {
      offset.value = target;
      return;
    }
    offset.value = withTiming(target, { duration: 1300, easing: EASE_OUT });
  }, [target, reduce, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  // Unique gradient id so multiple rings on one screen don't collide.
  const gid = 'glowring' + useId().replace(/:/g, '');

  return (
    <View style={[{ width: size, height: size }, styles.glow, { shadowColor: palette.accent }, style]}>
      <Svg width={size} height={size} style={styles.rotate}>
        <Defs>
          <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.accent2} />
            <Stop offset="1" stopColor={palette.accent} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.13)"
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  rotate: {
    transform: [{ rotate: '-90deg' }], // start the arc at 12 o'clock
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
