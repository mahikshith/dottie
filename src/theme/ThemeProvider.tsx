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
import {
  AURORA_PALETTES,
  DEFAULT_PALETTE_ID,
  getPalette,
  type AuroraPalette,
  type MoodPaletteId,
} from './palettes';
import { paletteForMood } from './mood-palette';


/**
 * The wash's own curve. Deliberately NOT the strong ease-out above: that puts
 * most of the distance in the first fifth of the duration, which is right when
 * you want a control to feel instant and wrong when the motion IS the point.
 * This one eases in gently and out softly, so the colour reads as travelling
 * across the screen rather than snapping to fill it.
 */



export interface RevealOrigin {
  x: number;
  y: number;
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

  /**
   * ─── THE MOOD REVEAL OVERLAY IS GONE (device-test-19) ─────────────
   *
   *  Picking a mood put a full-screen white sheet over the app that the user
   *  could not dismiss. They had to force-quit, and the new colour was only
   *  visible after relaunching.
   *
   *  THE MECHANISM. `MoodReveal` chained the whole sequence through Reanimated
   *  completion callbacks: spread → `if (finished)` commit the palette →
   *  `if (done)` clear the overlay. Reanimated reports `finished: false` for
   *  any interrupted animation, and committing the palette re-rendered every
   *  consumer of this context — so an interrupt anywhere in that ~1.5s window
   *  cancelled the chain, `onFinish` never ran, `reveal` was never cleared, and
   *  an `absoluteFill` view at `zIndex: 9999 / elevation: 9999` stayed on top
   *  of the entire app permanently. A stuck overlay was not an edge case of
   *  that design; it was one dropped callback away at all times.
   *
   *  It is not repaired, it is removed. A timeout to force-clear it would only
   *  have bounded how long the app was unusable. The palette change is still
   *  visible — `AuroraBackground` already dips and re-blooms its field when the
   *  palette changes — and the owner had already said the liquid-glass
   *  direction was not wanted and that a white flash is unacceptable in any
   *  condition. `origin` stays in the signature so no call site breaks; it is
   *  deliberately ignored.
   */
  const applyMood = useCallback((moodScore: number | null | undefined, _origin?: RevealOrigin) => {
    setPaletteId(paletteForMood(moodScore));
  }, []);

  const palette = useMemo(() => getPalette(paletteId), [paletteId]);

  const value = useMemo<AuroraContextValue>(
    () => ({ palette, paletteId, setPaletteId, applyMood }),
    [palette, paletteId, applyMood]
  );

  return (
    <AuroraContext.Provider value={value}>
      {children}
    </AuroraContext.Provider>
  );
}



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
