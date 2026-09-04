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
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';
import { buildBlobPath, maxRadiusFrom } from './liquid-reveal';
import {
  AURORA_PALETTES,
  DEFAULT_PALETTE_ID,
  getPalette,
  type AuroraPalette,
  type MoodPaletteId,
} from './palettes';
import { paletteForMood } from './mood-palette';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1); // animate-expo strong ease-out

/**
 * The wash's own curve. Deliberately NOT the strong ease-out above: that puts
 * most of the distance in the first fifth of the duration, which is right when
 * you want a control to feel instant and wrong when the motion IS the point.
 * This one eases in gently and out softly, so the colour reads as travelling
 * across the screen rather than snapping to fill it.
 */
const EASE_LIQUID = Easing.bezier(0.4, 0.05, 0.2, 1);

/**
 * How long the wash takes to cross the screen, and how long it then takes to
 * hand over to the settled palette.
 *
 * ~1s is very long for UI — and correct here. Changing your mood repaints the
 * whole app, it happens about once a day, and the owner asked for it slower and
 * more liquid. This is the one place in Dottie with a delight budget. Tune
 * SPREAD_MS alone to change the pace; nothing else depends on it.
 */
const SPREAD_MS = 1050;
const SETTLE_MS = 420;

/** Reanimated-driven <Path> — the `d` string is rebuilt on the UI thread. */
const AnimatedPath = Animated.createAnimatedComponent(Path);

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
  const t = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!reveal) return;
    const toId = reveal.toId;
    t.value = 0;
    opacity.value = 1;
    // 1) spread to cover → 2) commit the palette underneath → 3) fade out.
    //
    // SLOWER THAN A UI TRANSITION, ON PURPOSE. This is the app's signature
    // moment — the entire palette changes because of one tap — and it happens
    // about once a day, so it sits in the delight budget rather than the
    // "must be imperceptible" budget. The easing is gentler than the usual
    // strong ease-out precisely so you can WATCH it travel; a hard ease-out
    // would put most of the distance in the first 200ms and there would be
    // nothing to see.
    t.value = withTiming(1, { duration: SPREAD_MS, easing: EASE_LIQUID }, (finished) => {
      if (!finished) return;
      runOnJS(onCommit)(toId);
      opacity.value = withTiming(0, { duration: SETTLE_MS, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(onFinish)();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // The blob outline, rebuilt on the UI thread each frame. Measured at
  // ~0.014ms per rebuild (npm run test:liquid), so this is nowhere near the
  // frame budget even on a slow device.
  const originX = reveal?.x ?? 0;
  const originY = reveal?.y ?? 0;
  const maxR = maxRadiusFrom(originX, originY, width, height);
  const pathProps = useAnimatedProps(() => ({
    d: buildBlobPath(originX, originY, t.value, maxR),
  }));

  if (!reveal) return null;

  const palette = AURORA_PALETTES[reveal.toId];

  return (
    <Animated.View pointerEvents="none" style={[styles.cover, fadeStyle]}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Same accent → ground wash the circular version used, so only the
              SHAPE of the reveal changed, not its colour story. */}
          <SvgLinearGradient id="moodWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.accent} />
            <Stop offset="1" stopColor={palette.ground} />
          </SvgLinearGradient>
        </Defs>
        <AnimatedPath animatedProps={pathProps} fill="url(#moodWash)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Full-screen host; the SVG inside it draws the shape, so this never needs a
  // borderRadius or its own transform any more.
  cover: {
    ...StyleSheet.absoluteFillObject,
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
