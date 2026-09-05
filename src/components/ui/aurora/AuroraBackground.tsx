/**
 * Dottie — AuroraBackground (design-v2)
 *
 * The luminous ground every aurora screen sits on: a dark palette ground with
 * a few soft, slowly-drifting colour blooms. Wrap a screen's content in it.
 *
 * ─── HOW THE BLOOM IS MADE (no blur needed) ─────────────────────────
 *
 *  React Native has no cheap view blur, so each bloom is an SVG circle filled
 *  with a RADIAL GRADIENT that fades hue → transparent. The gradient falloff
 *  IS the softness — it reads like the CSS `blur()` blobs in the mockups
 *  without a per-frame blur pass. (react-native-svg is already a dep.)
 *
 * ─── MOTION (animate-expo rules) ────────────────────────────────────
 *
 *  - Each bloom drifts via a transform-only Reanimated loop (never layout).
 *  - On a palette change the whole field dips + restores opacity — a gentle
 *    "re-bloom" that softens the instant token swap (see ThemeProvider).
 *  - Honors Reduce Motion: static blooms, no drift, no dip.
 *
 *  ⚠️ design-v2 / UNVERIFIED (written without a device). Feel-check on a
 *  release build: drift should be barely perceptible; the re-bloom on mood
 *  change should feel like a soft breath, not a flash.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAurora } from '../../../theme/ThemeProvider';

// Bloom layout as fractions of the screen box (kept resolution-independent).
// {sizeFrac, leftFrac, topFrac, hue index into palette.aurora, drift px, secs}

const BLOOMS = [
  { size: 1.05, left: -0.18, top: -0.1, hue: 0, dx: 26, dy: 22, secs: 20 },
  { size: 0.95, left: 0.6, top: 0.08, hue: 1, dx: -24, dy: 26, secs: 24 },
  { size: 1.1, left: -0.12, top: 0.66, hue: 2, dx: 24, dy: -20, secs: 28 },
  { size: 0.7, left: 0.66, top: 0.7, hue: 3, dx: -18, dy: 18, secs: 22 },
] as const;

function Bloom({
  hue,
  boxW,
  cfg,
  reduce,
}: {
  hue: string;
  boxW: number;
  cfg: (typeof BLOOMS)[number];
  reduce: boolean;
}): JSX.Element {
  const size = boxW * cfg.size;
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: cfg.secs * 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [reduce, cfg.secs, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * cfg.dx },
      { translateY: t.value * cfg.dy },
    ],
  }));

  // Unique gradient id per bloom instance (hue is enough; blooms use distinct hues).
  const gid = `bloom-${cfg.hue}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bloom,
        { width: size, height: size, left: boxW * cfg.left, top: boxW * cfg.top },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={hue} stopOpacity={0.55} />
            <Stop offset="0.7" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

export interface AuroraBackgroundProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Screen box width used to scale blooms. Default 400 (safe for phones). */
  width?: number;
}

export function AuroraBackground({
  children,
  style,
  width = 400,
}: AuroraBackgroundProps): JSX.Element {
  const { palette, paletteId } = useAurora();
  const reduce = useReducedMotion();

  // Gentle "re-bloom" dip when the mood palette changes.
  const fieldOpacity = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      fieldOpacity.value = 1;
      return;
    }
    fieldOpacity.value = withSequence(
      withTiming(0.45, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 340, easing: Easing.out(Easing.quad) })
    );
  }, [paletteId, reduce, fieldOpacity]);

  const fieldStyle = useAnimatedStyle(() => ({ opacity: fieldOpacity.value }));

  return (
    <View style={[styles.root, { backgroundColor: palette.ground }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, fieldStyle]} pointerEvents="none">
        {BLOOMS.map((cfg, i) => (
          <Bloom key={i} cfg={cfg} hue={palette.aurora[cfg.hue]} boxW={width} reduce={reduce} />
        ))}
      </Animated.View>
      {children}
      {/* ─── THERE IS NO STATUS VEIL, AND THERE MUST NOT BE ONE ─────
          (device-test-19)

          A veil lived here from DT7 to DT18 and it is the single longest-
          running bug in this app. The owner reported "the top of my UI is
          being eaten" in device tests 3, 6, 7, 16 and 19. Every round it was
          re-tuned — a gradient, then a shorter gradient, then an opaque strip
          of exactly `insets.top` — and every round it came back, because the
          veil was never the fix. It was the bug.

          TWO THINGS WERE WRONG.

          1. It protected against something that cannot happen. `app.json` sets
             androidStatusBar.translucent:false and app/_layout.tsx renders
             <StatusBar translucent={false}>, so the app window BEGINS below the
             status bar. Nothing has ever been able to scroll under it. The veil
             was written for a translucent status bar this app does not have.

          2. It was positioned in the wrong coordinate space. `top: 0` is the top
             of THIS COMPONENT'S box, not the top of the window. On any screen
             with a navigation header — every lesson, every exercise, the whole
             sisterhood and profile stacks — AuroraBackground starts BELOW the
             header, so an `insets.top`-tall opaque band was painted straight
             across the first ~110px of the content. That is precisely the black
             bar in the owner's screenshots, and precisely why it looked like the
             app was eating the UI: it was.

          Do not reintroduce a cap, a veil, a gradient or a spacer here. If
          content ever genuinely needs to clear the status bar, that is the
          SCREEN's padding to own — `audit:safearea` checks the real geometry
          now — and never a sibling that paints over whatever happens to be
          beneath it. */}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  bloom: {
    position: 'absolute',
  },
});
