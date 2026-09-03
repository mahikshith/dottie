/**
 * Dottie — Aurora Celebration (full-screen, mood-aware)
 *
 * A victory celebration that is NOT canned 2D confetti. It's native to Dottie's
 * "Mood Aurora" identity: a full-screen bloom of soft light orbs that launch
 * from the centre, drift out across the WHOLE screen, and fade — with a radial
 * flash and a gentle colour wash behind them.
 *
 * ─── MOOD-AWARE INTENSITY (the Gemini instruction) ──────────────────
 *
 *  The same win is celebrated differently depending on how the person feels
 *  today (their logged mood):
 *    • glory  — happy / neutral / unknown: the big, joyful bloom.
 *    • warm   — middling mood, or a smaller win: fewer, softer, warmer orbs.
 *    • gentle — low / frustrated / sad mood: NO burst. A slow, breathing warm
 *               glow that rises and settles — it acknowledges the win while
 *               SOOTHING, so a frustrated user is calmed, never grated on.
 *  Reduce Motion collapses any tier to a single soft opacity bloom.
 *
 * ─── IMPERATIVE, ROOT-MOUNTED, NEVER A <Modal> ──────────────────────
 *
 *  Same pattern as showAppDialog: call `showCelebration(tier)` from anywhere;
 *  the single <CelebrationHost/> at the app root plays it as an in-tree,
 *  pointer-transparent overlay above every screen (so it spreads across the
 *  whole screen, whatever triggered it). Never a Modal — Modals caused the
 *  stuck white-circle bug.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { create } from 'zustand';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { A } from '../../../theme';

export type CelebrationTier = 'gentle' | 'warm' | 'glory';

// ─── IMPERATIVE STORE ────────────────────────────────────────────────

interface CelebrationStoreState {
  /** Bumps on every fire so the host replays even for the same tier. */
  token: number;
  tier: CelebrationTier;
  fire: (tier: CelebrationTier) => void;
}

const useCelebrationStore = create<CelebrationStoreState>((set) => ({
  token: 0,
  tier: 'glory',
  fire: (tier) => set((s) => ({ token: s.token + 1, tier })),
}));

/** Fire the celebration from anywhere (handlers, effects). */
export function showCelebration(tier: CelebrationTier = 'glory'): void {
  useCelebrationStore.getState().fire(tier);
}

/**
 * Pick a tier for a WIN given the user's logged mood (1..5) and how big the win
 * is. Low mood → gentle (soothing); a small win never goes full glory.
 */
export function celebrationTierForMood(
  moodScore: number | null | undefined,
  magnitude: 'big' | 'small' = 'big'
): CelebrationTier {
  if (moodScore != null && moodScore <= 2) return 'gentle';
  if (magnitude === 'small') return 'warm';
  if (moodScore === 3) return 'warm';
  return 'glory';
}

// ─── TIER SPECS ──────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MAX_REACH = Math.max(SCREEN_W, SCREEN_H) * 0.62;

interface TierSpec {
  orbCount: number;
  reach: number; // how far orbs travel (px)
  durMin: number;
  durMax: number;
  sizeMin: number;
  sizeMax: number;
  colors: string[];
  washOpacity: number;
  riseBias: number; // 0 = radial, 1 = mostly upward
  totalMs: number;
}

const SPECS: Record<CelebrationTier, TierSpec> = {
  glory: {
    orbCount: 26,
    reach: MAX_REACH,
    durMin: 900,
    durMax: 1500,
    sizeMin: 8,
    sizeMax: 30,
    colors: [A.accent, A.gold, A.rose, A.accent2, '#FFFFFF'],
    washOpacity: 0.16,
    riseBias: 0.25,
    totalMs: 1900,
  },
  warm: {
    orbCount: 14,
    reach: MAX_REACH * 0.7,
    durMin: 1100,
    durMax: 1700,
    sizeMin: 10,
    sizeMax: 26,
    colors: [A.gold, A.rose, A.accent, '#FFF2D6'],
    washOpacity: 0.1,
    riseBias: 0.5,
    totalMs: 2000,
  },
  gentle: {
    // Soothing, not a burst: few, large, slow, warm orbs rising gently.
    orbCount: 8,
    reach: MAX_REACH * 0.42,
    durMin: 1800,
    durMax: 2400,
    sizeMin: 22,
    sizeMax: 46,
    colors: [A.gold, A.rose, '#FFE8C7'],
    washOpacity: 0.08,
    riseBias: 0.85,
    totalMs: 2400,
  },
};

interface OrbParams {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  dur: number;
}

/**
 * Deterministic-per-fire orb field. A simple seeded LCG so a given `token`
 * always lays out the same (no fresh Math.random churn across renders).
 */
function buildOrbs(spec: TierSpec, token: number): OrbParams[] {
  let seed = (token * 9301 + 49297) % 233280;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const orbs: OrbParams[] = [];
  for (let i = 0; i < spec.orbCount; i++) {
    // Bias the launch angle upward per riseBias (−90° is straight up).
    const spread = Math.PI * 2;
    const base = rnd() * spread;
    const up = -Math.PI / 2;
    const angle = base * (1 - spec.riseBias) + up * spec.riseBias + (rnd() - 0.5) * 0.9;
    orbs.push({
      id: i,
      angle,
      distance: spec.reach * (0.45 + rnd() * 0.55),
      size: spec.sizeMin + rnd() * (spec.sizeMax - spec.sizeMin),
      color: spec.colors[Math.floor(rnd() * spec.colors.length)]!,
      delay: rnd() * (spec.orbCount > 16 ? 260 : 160),
      dur: spec.durMin + rnd() * (spec.durMax - spec.durMin),
    });
  }
  return orbs;
}

// ─── HOST ────────────────────────────────────────────────────────────

/** Mounted once at the app root; plays whatever showCelebration() fires. */
export function CelebrationHost(): JSX.Element | null {
  const token = useCelebrationStore((s) => s.token);
  const tier = useCelebrationStore((s) => s.tier);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);

  const spec = SPECS[tier];
  const orbs = useMemo(() => buildOrbs(spec, token), [spec, token]);

  useEffect(() => {
    if (token === 0) return; // nothing fired yet
    setActive(true);
    const t = setTimeout(() => setActive(false), spec.totalMs + 400);
    return () => clearTimeout(t);
    // Replay on every fire (token change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {/* Full-screen colour wash — a single soft pulse that touches the
          whole screen so the celebration reads as "everywhere". */}
      <Wash key={`wash-${token}`} tier={tier} spec={spec} reduce={reduce} />
      {/* Centre bloom + orbs. */}
      <View style={styles.center} pointerEvents="none">
        <Bloom key={`bloom-${token}`} tier={tier} reduce={reduce} />
        {orbs.map((o) => (
          <Orb key={`${token}-${o.id}`} {...o} reduce={reduce} />
        ))}
      </View>
    </View>
  );
}

// ─── PIECES ──────────────────────────────────────────────────────────

function Wash({
  tier,
  spec,
  reduce,
}: {
  tier: CelebrationTier;
  spec: TierSpec;
  reduce: boolean;
}): JSX.Element {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, {
      duration: tier === 'gentle' ? 2200 : 1500,
      easing: Easing.inOut(Easing.ease),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25, 0.7, 1], [0, spec.washOpacity, spec.washOpacity * 0.7, 0]),
  }));
  const color = tier === 'gentle' ? A.gold : A.accent;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: color }, style]}
    />
  );
}

function Bloom({ tier, reduce }: { tier: CelebrationTier; reduce: boolean }): JSX.Element {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, {
      duration: tier === 'gentle' ? 2000 : 1200,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = 260;
  const style = useAnimatedStyle(() => {
    const from = tier === 'gentle' ? 0.5 : 0.3;
    const to = tier === 'gentle' ? 1.6 : 2.2;
    return {
      transform: [{ scale: interpolate(p.value, [0, 1], [from, to]) }],
      opacity: interpolate(p.value, [0, 0.15, 0.6, 1], [0, 0.5, 0.28, 0]),
    };
  });
  const color = tier === 'gentle' ? A.gold : A.accent;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function Orb({
  angle,
  distance,
  size,
  color,
  delay,
  dur,
  reduce,
}: OrbParams & { reduce: boolean }): JSX.Element {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      // Reduce Motion: a still soft bloom instead of flying particles.
      p.value = withTiming(0.35, { duration: 500 });
      return;
    }
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const pr = p.value;
    const gravity = 60; // slight downward drift as they slow
    const tx = Math.cos(angle) * distance * pr;
    const ty = Math.sin(angle) * distance * pr + gravity * pr * pr;
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: interpolate(pr, [0, 0.2, 1], [0.2, 1, 0.5]) },
      ],
      opacity: interpolate(pr, [0, 0.12, 0.7, 1], [0, 1, 0.9, 0]),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200, // above tab bar + dialogs' backdrop siblings
    elevation: 1200,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
