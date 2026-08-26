/**
 * Dottie — Aurora ThemeProvider + useAurora() (design-v2)
 *
 * Holds the ACTIVE mood palette for the whole app and exposes it via context.
 * Every aurora component reads its colours from `useAurora().palette`, so a
 * mood change re-themes the entire UI from one place.
 *
 * ─── HOW IT DRIVES ──────────────────────────────────────────────────
 *
 *  - Default palette is Nocturne (calm) — the pre-check-in state.
 *  - `applyMood(score)` maps a check-in mood (1–5) → palette and swaps it.
 *  - Wire it once, near the root, to the latest check-in:
 *
 *      const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
 *      const { applyMood } = useAurora();
 *      useEffect(() => { applyMood(todayCheckIn?.moodScore); },
 *        [todayCheckIn?.moodScore, applyMood]);
 *
 *    (Kept OUT of the provider so the theme layer stays decoupled from the
 *     cycle store — the provider is pure state.)
 *
 * ─── CROSS-FADE ─────────────────────────────────────────────────────
 *
 *  The token swap here is instantaneous (React re-render with new colours).
 *  The visible cross-fade lives in <AuroraBackground>, which owns the
 *  dominant colour on screen and animates between palettes on change — the
 *  same trick as the mockups (dip the aurora, swap, bring it back), which
 *  masks the instant swap of the smaller tokens. Animating every colour
 *  token across every component is deliberately NOT done: it's a lot of
 *  machinery for motion the background already sells.
 *
 *  ⚠️ design-v2 / UNVERIFIED: written without a device. Verify render +
 *  the background cross-fade on a Node machine.
 */

import {
  createContext,
  useCallback,
  useContext,
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

// ─── CONTEXT ─────────────────────────────────────────────────────────

interface AuroraContextValue {
  /** The active palette's full token set. */
  palette: AuroraPalette;
  /** The active palette id. */
  paletteId: MoodPaletteId;
  /** Force a specific palette (e.g. a manual theme setting). */
  setPaletteId: (id: MoodPaletteId) => void;
  /** Set the palette from a check-in mood score (null → default). */
  applyMood: (moodScore: number | null | undefined) => void;
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

  const applyMood = useCallback((moodScore: number | null | undefined) => {
    setPaletteId(paletteForMood(moodScore));
  }, []);

  const palette = useMemo(() => getPalette(paletteId), [paletteId]);

  const value = useMemo<AuroraContextValue>(
    () => ({ palette, paletteId, setPaletteId, applyMood }),
    [palette, paletteId, applyMood]
  );

  return <AuroraContext.Provider value={value}>{children}</AuroraContext.Provider>;
}

// ─── HOOK ────────────────────────────────────────────────────────────

export function useAurora(): AuroraContextValue {
  const ctx = useContext(AuroraContext);
  if (!ctx) {
    throw new Error('useAurora() must be used inside <AuroraProvider>');
  }
  return ctx;
}

/**
 * Escape hatch: read a palette's tokens. Pass an `id` to read a fixed palette
 * without needing the provider (previews, tests); omit it to read the active
 * palette from context. `useContext` is called unconditionally either way, so
 * this stays rules-of-hooks compliant.
 */
export function useAuroraPalette(id?: MoodPaletteId): AuroraPalette {
  const ctx = useContext(AuroraContext);
  if (id) return AURORA_PALETTES[id];
  if (!ctx) {
    throw new Error('useAuroraPalette() without an id must be used inside <AuroraProvider>');
  }
  return ctx.palette;
}
