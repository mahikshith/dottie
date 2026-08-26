/**
 * Dottie — Aurora ThemeProvider + useAurora() (design-v2)
 *
 * Holds the ACTIVE mood palette for the whole app and exposes it via context.
 * Every aurora component reads `useAurora().palette`, so a mood change re-themes
 * the entire UI — all screens — from one place.
 *
 * ─── THE MOOD REVEAL (user request) ─────────────────────────────────
 *
 *  When a mood is logged, the new colour should NOT snap in — it should
 *  RADIATE OUT from the tapped mood button at a medium pace, a soothing
 *  circular reveal. `applyMood(score, origin)` drives it:
 *
 *   1. A circle grows from `origin` {x,y}, filled with the NEW palette's
 *      colour, until it covers the screen (~520ms, strong ease-out).
 *   2. The palette is committed underneath the cover (so the permanent
 *      background is now the new palette).
 *   3. The cover fades out (~340ms), revealing the settled aurora — and
 *      AuroraBackground plays its own gentle re-bloom.
 *
 *  Call `applyMood(score)` with NO origin (or under Reduce Motion) for an
 *  instant swap. Origin-aware reveal is Apple's "hint in the direction of the
 *  gesture / animate from the source" principle made literal.
 *
 *  Wire it from the check-in: pass the mood button's touch point —
 *    onPress={(e) => applyMood(score, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Feel-check the reveal pace + the
 *  hand-off into the settled aurora on a release build.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AURORA_PALETTES,
  DEFAULT_PALETTE_ID,
  getPalette,
  type AuroraPalette,
  type MoodPaletteId,
} from './palettes';
import { paletteForMood } from './mood-palette';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1); // animate-expo strong ease-out

export interface RevealOrigin {
  x: number;
  y: number;
}

interface RevealState {
  toId: MoodPaletteId;
  x: number;
  y: number;
  /** changes every call so the effect re-fires even for the same palette */
  nonce: number;
}

interface AuroraContextValue {
  palette: AuroraPalette;
  paletteId: MoodPaletteId;
  setPaletteId: (id: MoodPaletteId) => void;
  /** Set palette from a mood score; pass `origin` for the radiate-from-tap reveal. */
  applyMood: (moodScore: number | null | undefined, origin?: RevealOrigin) => void;
}

const AuroraContext = createContext<AuroraContextValue | null>(null);

// ─── PROVIDER ────────────────────────────────────────────────────────

export function AuroraProvider({
  children,
  initialId = DEFAULT_PALETTE_ID,
}: {
  children: ReactNode;
  initialId?: MoodPaletteId;
}): JSX.Element {
  const [paletteId, setPaletteId] = useState<MoodPaletteId>(initialId);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const reduce = useReducedMotion();

  const applyMood = useCallback(
    (moodScore: number | null | undefined, origin?: RevealOrigin) => {
      const toId = paletteForMood(moodScore);
      if (!origin || reduce) {
        setPaletteId(toId);
        return;
      }
      setReveal({ toId, x: origin.x, y: origin.y, nonce: Date.now() });
    },
    [reduce]
  );

  const commit = useCallback((id: MoodPaletteId) => setPaletteId(id), []);
  const finish = useCallback(() => setReveal(null), []);

  const palette = useMemo(() => getPalette(paletteId), [paletteId]);

  const value = useMemo<AuroraContextValue>(
    () => ({ palette, paletteId, setPaletteId, applyMood }),
    [palette, paletteId, applyMood]
  );

  return (
    <AuroraContext.Provider value={value}>
      {children}
      <MoodReveal reveal={reveal} onCommit={commit} onFinish={finish} />
    </AuroraContext.Provider>
  );
}

// ─── THE REVEAL OVERLAY ──────────────────────────────────────────────

function MoodReveal({
  reveal,
  onCommit,
  onFinish,
}: {
  reveal: RevealState | null;
  onCommit: (id: MoodPaletteId) => void;
  onFinish: () => void;
}): JSX.Element | null {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!reveal) return;
    const toId = reveal.toId;
    scale.value = 0;
    opacity.value = 1;
    // 1) grow to cover → 2) commit palette underneath → 3) fade the cover out
    scale.value = withTiming(1, { duration: 520, easing: EASE_OUT }, (finished) => {
      if (!finished) return;
      runOnJS(onCommit)(toId);
      opacity.value = withTiming(0, { duration: 340, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(onFinish)();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!reveal) return null;

  const palette = AURORA_PALETTES[reveal.toId];
  // radius that reaches the farthest screen corner from the origin
  const maxR = Math.hypot(
    Math.max(reveal.x, width - reveal.x),
    Math.max(reveal.y, height - reveal.y)
  );
  const d = maxR * 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.circle,
        { width: d, height: d, borderRadius: maxR, left: reveal.x - maxR, top: reveal.y - maxR },
        style,
      ]}
    >
      <LinearGradient
        colors={[palette.accent, palette.ground] as const}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 9999,
  },
});

// ─── HOOKS ───────────────────────────────────────────────────────────

export function useAurora(): AuroraContextValue {
  const ctx = useContext(AuroraContext);
  if (!ctx) {
    throw new Error('useAurora() must be used inside <AuroraProvider>');
  }
  return ctx;
}

/**
 * Read a palette's tokens. Pass an `id` for a fixed palette without needing the
 * provider (previews/tests); omit it for the active palette. `useContext` is
 * called unconditionally so this stays rules-of-hooks compliant.
 */
export function useAuroraPalette(id?: MoodPaletteId): AuroraPalette {
  const ctx = useContext(AuroraContext);
  if (id) return AURORA_PALETTES[id];
  if (!ctx) {
    throw new Error('useAuroraPalette() without an id must be used inside <AuroraProvider>');
  }
  return ctx.palette;
}
