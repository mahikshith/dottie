/**
 * Dottie — CompanionCreature
 *
 * A REAL animated character for each spirit companion: a drawn body with a
 * rigged face that blinks, smiles, frowns, and loses its mind when you ace
 * something. Not an emoji with a bounce on it.
 *
 * ─── HOW THE RIG WORKS ──────────────────────────────────────────────
 *
 *  Every species shares one rig, so behaviour is consistent and only the body
 *  art differs:
 *    • bob     — a slow vertical float (the character is never still)
 *    • sway    — a lazy horizontal drift, so it "moves around" rather than
 *                bouncing on the spot
 *    • squash  — anticipation on the down-beat, the thing that makes motion
 *                read as alive rather than mechanical
 *    • blink   — driven independently on its own irregular cycle, because
 *                perfectly periodic blinking looks robotic
 *    • flap    — ear / folded-wing motion
 *
 *  Every one of those runs on the UI thread via Reanimated shared values, so a
 *  busy JS thread can't stutter the character (a lesson from the tab bar).
 *  Reduce Motion collapses all of it to a still, correctly-expressed pose —
 *  the face still shows the emotion, it just doesn't move.
 *
 *  The FACE comes from expressions.ts (pure + unit-tested); this file only
 *  turns those numbers into geometry.
 *
 *  ─── WHY NOT DOWNLOADED LOTTIE ART ────────────────────────────────
 *  Free character packs carry unclear or non-commercial licences and a .json is
 *  an opaque blob we can't review. These are vectors we own, so they're safe to
 *  ship, inspectable, and recolour per mood for free. `CompanionLottie` still
 *  prefers real Lottie art when a file is wired, so commissioned art drops in
 *  later without touching a single screen.
 */

import { useEffect, useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { CompanionType } from '../../../types/content.types';
import { expressionFor, type CreatureState } from './expressions';
import { creatureShapes, SPECIES, EYE, JOINTS, ARM_POSE, type Limb, type Shape } from './geometry';

export interface CompanionCreatureProps {
  type: CompanionType;
  state?: CreatureState;
  /** 0..1 — how strongly to play the state. */
  intensity?: number;
  /** Square size in px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The art lives in `./geometry.ts` as plain data, so the same numbers can be
 * rendered to an HTML page by `scripts/companion-preview.ts` and reviewed in a
 * browser. That loop is why these finally stopped looking like insects — see
 * the header of that file for what each signal was.
 */

/** One geometry shape → one react-native-svg element. */
function Draw({ s }: { s: Shape }): JSX.Element {
  const common = {
    fill: s.fill ?? (s.stroke ? 'none' : undefined),
    stroke: s.stroke,
    strokeWidth: s.sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: s.opacity,
  };
  if (s.k === 'circle') {
    const t = s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined;
    return <Circle cx={s.cx} cy={s.cy} r={s.r} transform={t} {...common} />;
  }
  if (s.k === 'ellipse') {
    const t = s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined;
    return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={t} {...common} />;
  }
  const t = s.rotate ? `rotate(${s.rotate} ${s.px ?? 50} ${s.py ?? 50})` : undefined;
  return <Path d={s.d} transform={t} {...common} />;
}

export function CompanionCreature({
  type,
  state = 'idle',
  intensity = 1,
  size = 96,
  style,
  accessibilityLabel,
}: CompanionCreatureProps): JSX.Element {
  const reduce = useReducedMotion();
  const expr = useMemo(() => expressionFor(state, intensity), [state, intensity]);
  const sp = SPECIES[type];
  const shapes = useMemo(() => creatureShapes(type, expr), [type, expr]);
  /**
   * Group the shape list into CONTIGUOUS runs, so paint order survives.
   *
   * Bucketing by limb instead would have put every arm and leg on top of the
   * face: the legs belong behind the body and the arms between the body and
   * the head, and that is expressed purely by where they sit in the list.
   */
  const runs = useMemo(() => {
    const out: { limb: Limb | null; shapes: Shape[] }[] = [];
    for (const sh of shapes) {
      const limb = sh.limb ?? null;
      const last = out[out.length - 1];
      if (last && last.limb === limb) last.shapes.push(sh);
      else out.push({ limb, shapes: [sh] });
    }
    return out;
  }, [shapes]);
  const [armLBase, armRBase] = ARM_POSE[expr.armPose];

  // ── Rig ────────────────────────────────────────────────────────
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const squash = useSharedValue(0);
  const blink = useSharedValue(1); // 1 = open
  const flap = useSharedValue(0);

  const period = Math.max(220, 1500 / expr.tempo);

  // One shared driver for every limb: a -1..1 oscillator. Each limb reads it
  // with its own gain and sign, so the arms swing opposite the legs and the
  // whole thing stays in step without four separate timelines to keep aligned.
  const swing = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      bob.value = 0; sway.value = 0; squash.value = 0; blink.value = 1; flap.value = 0; swing.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: period, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    );
    sway.value = withRepeat(
      withTiming(1, { duration: period * 2.6, easing: Easing.inOut(Easing.sin) }), -1, true
    );
    squash.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period * 0.5, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: period * 0.5, easing: Easing.in(Easing.quad) })
      ), -1, true
    );
    swing.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period * 0.9, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: period * 0.9, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    );
    flap.value = withRepeat(
      withTiming(1, { duration: sp.wings ? 260 / expr.tempo : period, easing: Easing.inOut(Easing.sin) }), -1, true
    );
  }, [reduce, period, expr.tempo, sp.wings, bob, sway, squash, flap, swing]);

  // Blinking on its own irregular rhythm — a periodic blink looks mechanical.
  useEffect(() => {
    if (reduce || expr.eyeArc || expr.eyeOpen < 0.3) { blink.value = 1; return; }
    const run = () => {
      blink.value = withSequence(
        withTiming(0, { duration: 70 }),
        withTiming(1, { duration: 90 }),
        withDelay(1400 + Math.random() * 2600, withTiming(1, { duration: 1 }))
      );
    };
    run();
    const id = setInterval(run, 2600 + Math.random() * 2400);
    return () => clearInterval(id);
  }, [reduce, expr.eyeArc, expr.eyeOpen, blink]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * 3.2 * expr.bounce },
      { translateX: (sway.value - 0.5) * 5 * expr.bounce },
      { rotate: `${expr.tilt + (sway.value - 0.5) * 4}deg` },
      { scaleY: 1 - squash.value * 0.05 * expr.bounce },
      { scaleX: 1 + squash.value * 0.05 * expr.bounce },
    ],
  }));

  const S = size;
  const eyeLid = useAnimatedStyle(() => ({ opacity: 1 - blink.value }));

  // ─── LIMB MOTION (device-test-19) ───────────────────────────────
  //
  //  DT18 rotated each limb with `animatedProps` on a react-native-svg <G>
  //  (rotation / originX / originY). On the owner's device NOTHING moved: the
  //  only animation left in a companion was the confetti. Reanimated can only
  //  drive a prop the underlying native component actually applies per-frame,
  //  and <G> is not one of them — so the whole reason for adding arms and legs
  //  was silently a no-op.
  //
  //  These are plain VIEW transforms now, which Reanimated has always been able
  //  to drive on the UI thread. Each limb is its own absolutely-positioned
  //  layer with `transformOrigin` set to that limb's joint as a percentage of
  //  the 100x100 box, so a shoulder still rotates from the shoulder. RN 0.76
  //  supports transformOrigin natively, so this costs nothing extra.
  //
  //  Arms swing further than legs, and each side leads the other — a creature
  //  whose limbs move in perfect unison looks like a wind-up toy.
  const gain = expr.limbSwing;
  const armLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armLBase + swing.value * 9 * gain}deg` }],
  }));
  const armRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armRBase - swing.value * 9 * gain}deg` }],
  }));
  const legLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-swing.value * 4 * gain}deg` }],
  }));
  const legRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swing.value * 4 * gain}deg` }],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swing.value * 11 * gain}deg` }],
  }));
  const LIMB_STYLE: Partial<Record<Limb, ReturnType<typeof useAnimatedStyle>>> = {
    armL: armLStyle, armR: armRStyle, legL: legLStyle, legR: legRStyle, tail: tailStyle,
  };

  /**
   * Below this size a companion is an inline glyph beside a line of text, and
   * splitting it into six animated layers buys motion nobody can see. Small
   * ones draw as ONE static Svg with the pose baked in.
   */
  const animateLimbs = !reduce && S >= 44;

  return (
    <View
      style={[{ width: S, height: S }, style]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Svg width={S} height={S} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`glow_${type}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={sp.accent} stopOpacity={0.5} />
              <Stop offset="1" stopColor={sp.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* celebration halo */}
          {expr.sparkles > 0 && <Circle cx={50} cy={52} r={46} fill={`url(#glow_${type})`} />}

          {runs.map((run, r) => {
            const inner = run.shapes.map((sh, i) => <Draw key={i} s={sh} />);
            // When the limbs animate they are lifted OUT of this Svg into their
            // own layers below, so skip them here and keep the gap in the paint
            // order. When they don't, the pose is baked in with a plain SVG
            // rotate about the joint.
            if (!run.limb) return <G key={r}>{inner}</G>;
            if (animateLimbs && LIMB_STYLE[run.limb]) return null;
            const [ox, oy] = JOINTS[run.limb];
            const angle = run.limb === 'armL' ? armLBase : run.limb === 'armR' ? armRBase : 0;
            return (
              <G key={r} transform={`rotate(${angle} ${ox} ${oy})`}>
                {inner}
              </G>
            );
          })}
        </Svg>
        {/* Animated limb layers, in the same order as the runs above so the
            legs stay behind the body and the arms stay in front of it. Each is
            a full-size overlay containing only that limb. */}
        {animateLimbs
          ? runs.map((run, r) => {
              if (!run.limb) return null;
              const limbStyle = LIMB_STYLE[run.limb];
              if (!limbStyle) return null;
              const [ox, oy] = JOINTS[run.limb];
              return (
                <Animated.View
                  key={`limb-${r}`}
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    { transformOrigin: `${ox}% ${oy}%` },
                    limbStyle,
                  ]}
                >
                  <Svg width={S} height={S} viewBox="0 0 100 100">
                    {run.shapes.map((sh, i) => (
                      <Draw key={i} s={sh} />
                    ))}
                  </Svg>
                </Animated.View>
              );
            })
          : null}
      </Animated.View>

      {/* Eyelids ride above the SVG so a blink can cross any eye shape. */}
      {!expr.eyeArc && expr.eyeOpen >= 0.3 && (
        <Animated.View style={[StyleSheet.absoluteFill, eyeLid]} pointerEvents="none">
          <Svg width={S} height={S} viewBox="0 0 100 100">
            {!expr.winkLeft && (
              <Ellipse cx={EYE.lx} cy={EYE.cy} rx={EYE.rx0 + 1.6} ry={EYE.ry0 + 1.2} fill={sp.fur} />
            )}
            <Ellipse cx={EYE.rx} cy={EYE.cy} rx={EYE.rx0 + 1.6} ry={EYE.ry0 + 1.2} fill={sp.fur} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
