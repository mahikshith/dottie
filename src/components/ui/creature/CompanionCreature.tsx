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
import { expressionFor, type CreatureState, type Expression } from './expressions';

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

/** Per-species palette + silhouette switches. */
const SPECIES: Record<
  CompanionType,
  { fur: string; furDark: string; belly: string; accent: string; ear: 'pointy' | 'long' | 'tuft' | 'deer' | 'none'; folded: boolean; petals: boolean }
> = {
  fox:       { fur: '#F0873C', furDark: '#C9611F', belly: '#FFF1E2', accent: '#FFFFFF', ear: 'pointy', folded: false, petals: false },
  bunny:     { fur: '#EBE4F5', furDark: '#C9BEDD', belly: '#FFFFFF', accent: '#FFB7CE', ear: 'long',   folded: false, petals: false },
  // `butterfly` keeps its ID so nobody's saved choice breaks, but it is drawn
  // as a DEER now — see the note above about the insect silhouette.
  butterfly: { fur: '#B9A0FF', furDark: '#8468E0', belly: '#F3EDFF', accent: '#FFD36E', ear: 'deer',   folded: false, petals: false },
  cat:       { fur: '#5A5470', furDark: '#3C3752', belly: '#EDE9F7', accent: '#FFC24D', ear: 'pointy', folded: false, petals: false },
  owl:       { fur: '#C89B6A', furDark: '#9A7346', belly: '#F7E9D6', accent: '#FFC24D', ear: 'tuft',   folded: true,  petals: false },
  blossom:   { fur: '#FF8FB1', furDark: '#E76A92', belly: '#FFF0F5', accent: '#FFD36E', ear: 'none',   folded: false, petals: true },
};

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

  // ── Rig ────────────────────────────────────────────────────────
  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const squash = useSharedValue(0);
  const blink = useSharedValue(1); // 1 = open
  const flap = useSharedValue(0);

  const period = Math.max(220, 1500 / expr.tempo);

  useEffect(() => {
    if (reduce) {
      bob.value = 0; sway.value = 0; squash.value = 0; blink.value = 1; flap.value = 0;
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
    flap.value = withRepeat(
      withTiming(1, { duration: sp.folded ? 260 / expr.tempo : period, easing: Easing.inOut(Easing.sin) }), -1, true
    );
  }, [reduce, period, expr.tempo, sp.folded, bob, sway, squash, flap]);

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

          <Body sp={sp} expr={expr} />
          <Face sp={sp} expr={expr} />
          <Sparkles count={expr.sparkles} color={sp.accent} />
        </Svg>
      </Animated.View>

      {/* Eyelids ride above the SVG so a blink can cross any eye shape. */}
      {!expr.eyeArc && expr.eyeOpen >= 0.3 && (
        <Animated.View style={[StyleSheet.absoluteFill, eyeLid]} pointerEvents="none">
          <Svg width={S} height={S} viewBox="0 0 100 100">
            <Ellipse cx={38} cy={46} rx={7.5} ry={7.5} fill={SPECIES[type].fur} />
            <Ellipse cx={62} cy={46} rx={7.5} ry={7.5} fill={SPECIES[type].fur} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

// ─── BODY ────────────────────────────────────────────────────────────

function Body({ sp, expr }: { sp: (typeof SPECIES)[CompanionType]; expr: Expression }): JSX.Element {
  return (
    <G>
      {/* petals (blossom) behind the head */}
      {sp.petals &&
        [0, 60, 120, 180, 240, 300].map((a) => (
          <Ellipse
            key={a}
            cx={50}
            cy={22}
            rx={11}
            ry={16}
            fill={sp.fur}
            opacity={0.95}
            transform={`rotate(${a} 50 50)`}
          />
        ))}

      {/* FOLDED wings (owl only), tucked against the body.
          The previous version drew two large dark ellipses FLANKING the
          character at x=22 and x=78. Two symmetrical shapes either side of a
          round body is the silhouette of an insect, which is exactly what the
          owner saw: "all of them look like bugs, real bugs... people are going
          to freak out" (device-test-16). These sit ON the body instead, so the
          outline stays a single soft blob. */}
      {sp.folded && (
        <G>
          <Ellipse cx={32} cy={64} rx={9} ry={16} fill={sp.furDark} opacity={0.85} transform="rotate(-8 32 64)" />
          <Ellipse cx={68} cy={64} rx={9} ry={16} fill={sp.furDark} opacity={0.85} transform="rotate(8 68 64)" />
        </G>
      )}

      {/* ears */}
      {sp.ear === 'pointy' && (
        <G>
          <Path d="M32 30 L26 10 L44 22 Z" fill={sp.fur} />
          <Path d="M68 30 L74 10 L56 22 Z" fill={sp.fur} />
          <Path d="M33 27 L30 16 L41 23 Z" fill={sp.accent} opacity={0.55} />
          <Path d="M67 27 L70 16 L59 23 Z" fill={sp.accent} opacity={0.55} />
        </G>
      )}
      {sp.ear === 'long' && (
        <G>
          <Ellipse cx={38} cy={16} rx={6.5} ry={17} fill={sp.fur} transform="rotate(-9 38 16)" />
          <Ellipse cx={62} cy={16} rx={6.5} ry={17} fill={sp.fur} transform="rotate(9 62 16)" />
          <Ellipse cx={38} cy={17} rx={3.2} ry={11} fill={sp.accent} opacity={0.75} transform="rotate(-9 38 17)" />
          <Ellipse cx={62} cy={17} rx={3.2} ry={11} fill={sp.accent} opacity={0.75} transform="rotate(9 62 17)" />
        </G>
      )}
      {sp.ear === 'deer' && (
        <G>
          {/* soft leaf-shaped ears, angled outward */}
          <Ellipse cx={30} cy={22} rx={7} ry={12} fill={sp.fur} transform="rotate(-28 30 22)" />
          <Ellipse cx={70} cy={22} rx={7} ry={12} fill={sp.fur} transform="rotate(28 70 22)" />
          <Ellipse cx={31} cy={23} rx={3.4} ry={7} fill={sp.accent} opacity={0.6} transform="rotate(-28 31 23)" />
          <Ellipse cx={69} cy={23} rx={3.4} ry={7} fill={sp.accent} opacity={0.6} transform="rotate(28 69 23)" />
          {/* two rounded nubs — a hint of antler, no points */}
          <Circle cx={42} cy={14} r={3.2} fill={sp.furDark} />
          <Circle cx={58} cy={14} r={3.2} fill={sp.furDark} />
        </G>
      )}
      {sp.ear === 'tuft' && (
        <G>
          <Path d="M34 26 L30 12 L45 21 Z" fill={sp.furDark} />
          <Path d="M66 26 L70 12 L55 21 Z" fill={sp.furDark} />
        </G>
      )}

      {/* head + body */}
      <Ellipse cx={50} cy={62} rx={26} ry={24} fill={sp.fur} />
      <Ellipse cx={50} cy={66} rx={16} ry={16} fill={sp.belly} opacity={0.9} />
      <Circle cx={50} cy={44} r={25} fill={sp.fur} />
      <Ellipse cx={50} cy={52} rx={15} ry={11} fill={sp.belly} opacity={0.85} />

      {/* cheeks */}
      <Ellipse cx={30} cy={53} rx={6} ry={4} fill={sp.accent} opacity={expr.blush} />
      <Ellipse cx={70} cy={53} rx={6} ry={4} fill={sp.accent} opacity={expr.blush} />
    </G>
  );
}

// ─── FACE ────────────────────────────────────────────────────────────

function Face({ sp, expr }: { sp: (typeof SPECIES)[CompanionType]; expr: Expression }): JSX.Element {
  const ink = '#2A2340';
  const ry = 7.5 * expr.eyeOpen;
  const pupil = 3.1 * expr.pupilScale;

  // Mouth: a quadratic whose control point is the emotion.
  const mouthY = 58;
  const curve = expr.mouthCurve * 7;
  const mouthPath = `M42 ${mouthY} Q50 ${mouthY + curve} 58 ${mouthY}`;

  return (
    <G>
      {/* brows — small, but they carry most of the read */}
      <Path
        d={`M30 ${34 - expr.browTilt * 3} Q37 ${31 - expr.browTilt * 5} 43 ${34 - expr.browTilt * 2}`}
        stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75}
      />
      <Path
        d={`M57 ${34 - expr.browTilt * 2} Q63 ${31 - expr.browTilt * 5} 70 ${34 - expr.browTilt * 3}`}
        stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75}
      />

      {/* eyes */}
      {expr.eyeArc ? (
        <G>
          <Path d="M31 47 Q38 39 45 47" stroke={ink} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <Path d="M55 47 Q62 39 69 47" stroke={ink} strokeWidth={3.2} fill="none" strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Ellipse cx={38} cy={46} rx={6.4} ry={ry} fill={ink} />
          <Ellipse cx={62} cy={46} rx={6.4} ry={ry} fill={ink} />
          {expr.eyeOpen > 0.4 && (
            <G>
              <Circle cx={40} cy={44} r={pupil * 0.6} fill="#FFFFFF" opacity={0.95} />
              <Circle cx={64} cy={44} r={pupil * 0.6} fill="#FFFFFF" opacity={0.95} />
            </G>
          )}
        </G>
      )}

      {/* muzzle / beak */}
      <Ellipse cx={50} cy={54} rx={3.4} ry={2.6} fill={ink} opacity={0.85} />

      {/* mouth */}
      {expr.mouthOpen > 0.05 ? (
        <Ellipse
          cx={50}
          cy={mouthY + 2}
          rx={4 + 3 * expr.mouthOpen}
          ry={2.5 + 5 * expr.mouthOpen}
          fill={ink}
          opacity={0.9}
        />
      ) : (
        <Path d={mouthPath} stroke={ink} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}

      {/* tongue on a big open grin */}
      {expr.mouthOpen > 0.7 && (
        <Ellipse cx={50} cy={mouthY + 5} rx={3} ry={2.2} fill={sp.accent} opacity={0.9} />
      )}
    </G>
  );
}

// ─── SPARKLES ────────────────────────────────────────────────────────

function Sparkles({ count, color }: { count: number; color: string }): JSX.Element | null {
  if (count <= 0) return null;
  const pts = Array.from({ length: Math.min(count, 12) }, (_, i) => {
    const a = (i / Math.min(count, 12)) * Math.PI * 2;
    return { x: 50 + Math.cos(a) * 42, y: 50 + Math.sin(a) * 42, r: 1.6 + (i % 3) * 0.9 };
  });
  return (
    <G>
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={0.85} />
      ))}
    </G>
  );
}
