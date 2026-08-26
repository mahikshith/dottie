/**
 * Dottie — Companion Lottie Manifest (design-v2)
 *
 * The single source of truth mapping each spirit companion (and each shared
 * "moment") to an illustrated Lottie animation. This is the seam that makes the
 * illustrated art **drop-in**: screens render `<CompanionLottie type state />`
 * and never touch file paths. Until a `.json` is dropped into
 * `assets/lottie/` and wired here, every lookup returns `null` and
 * `CompanionLottie` falls back to the animated **emoji** spirit-animal — so the
 * whole Learn/Calendar experience ships today and upgrades to real characters
 * with ZERO call-site changes.
 *
 * ─── HOW TO ADD ART (one line each) ─────────────────────────────────
 *
 *   1. Drop the file, e.g. `assets/lottie/fox-idle.json`.
 *   2. Reference it here:
 *        fox: {
 *          idle:      require('../../assets/lottie/fox-idle.json'),
 *          celebrate: require('../../assets/lottie/fox-celebrate.json'),
 *        },
 *   3. Done. `CompanionLottie` picks it up automatically.
 *
 *   ⚠️ Never `require()` a path that doesn't exist yet — Metro fails the build.
 *   Only add a line once the file is actually in `assets/lottie/`.
 *
 * ─── LICENSING ──────────────────────────────────────────────────────
 *
 *   LottieFiles free assets ship under the **Lottie Simple License** (commercial
 *   use OK, no attribution required, but modifications are derivative works under
 *   the same license). `lottie-react-native` itself is Apache-2.0. See
 *   `docs/LOTTIE-SOURCING.md` for the full brief, the asset inventory, and the
 *   attribution ledger to fill in per file.
 */

import type { CompanionType } from '../types/content.types';

// ─── ANIMATION STATES ────────────────────────────────────────────────

/**
 * The companion's animation states. These map onto the existing
 * COMPANION_PHASE_MOODS vocabulary (happy/celebrating/supportive/cozy/proud)
 * plus a couple of interaction actions.
 *   - idle       → standing on the path map / hero, gentle loop
 *   - celebrate  → correct answer, lesson/quiz win (one-shot)
 *   - encourage  → start of an exercise / "you've got this"
 *   - cozy       → menstrual/luteal care moments, hydration nudge
 *   - proud      → streak / level-up / badge
 *   - sad        → wrong answer / broken streak (soft, never punishing)
 */
export type CompanionAnim = 'idle' | 'celebrate' | 'encourage' | 'cozy' | 'proud' | 'sad';

/** Shared, companion-agnostic animations for big moments. */
export type MomentAnim =
  | 'confetti'
  | 'hydration'
  | 'heart'
  | 'streak_flame'
  | 'level_up'
  | 'quiz_perfect';

/**
 * A Lottie asset is either a bundled module id (what `require('./x.json')`
 * returns — a number) or a remote `{ uri }` source. `null` = not sourced yet.
 */
export type LottieAsset = number | { uri: string };

// ─── THE MANIFEST (empty until art is dropped in) ───────────────────

/**
 * Per-companion animation sets. Intentionally empty right now — each entry is
 * added the moment its file lands in `assets/lottie/` (see header). Keeping the
 * six keys present (not the values) documents the intended set for content.
 */
export const COMPANION_LOTTIE: Record<CompanionType, Partial<Record<CompanionAnim, LottieAsset>>> = {
  fox: {},
  bunny: {},
  butterfly: {},
  cat: {},
  owl: {},
  blossom: {},
};

/** Shared moment animations (confetti, hydration, etc.). Empty until sourced. */
export const MOMENT_LOTTIE: Partial<Record<MomentAnim, LottieAsset>> = {};

// ─── LOOKUPS ─────────────────────────────────────────────────────────

/** Returns the companion's asset for a state, or null → emoji fallback. */
export function getCompanionLottie(type: CompanionType, anim: CompanionAnim): LottieAsset | null {
  return COMPANION_LOTTIE[type]?.[anim] ?? null;
}

/** Returns a shared moment asset, or null → the screen's non-Lottie fallback. */
export function getMomentLottie(anim: MomentAnim): LottieAsset | null {
  return MOMENT_LOTTIE[anim] ?? null;
}

/** True once at least one companion animation has been wired (art has landed). */
export function hasCompanionArt(): boolean {
  return Object.values(COMPANION_LOTTIE).some((set) => Object.keys(set).length > 0);
}
