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
// Google Noto Animated Emoji — CC BY 4.0. See assets/lottie/ATTRIBUTION.md.
// One file per companion: each is a single looping PERFORMANCE, not a set of
// expressions, so the same asset backs every state. Emotional range is carried
// around it (tempo, scale, halo, and a MOMENT overlay) — see CompanionLottie.
// When per-emotion art is commissioned, give a state its own file here and it
// takes over with no screen changes.
const FOX = require('../../assets/lottie/companions/fox.json') as LottieAsset;
const BUNNY = require('../../assets/lottie/companions/bunny.json') as LottieAsset;
const BUTTERFLY = require('../../assets/lottie/companions/butterfly.json') as LottieAsset;
const CAT = require('../../assets/lottie/companions/cat.json') as LottieAsset;
const OWL = require('../../assets/lottie/companions/owl.json') as LottieAsset;
const BLOSSOM = require('../../assets/lottie/companions/blossom.json') as LottieAsset;

/** Every state maps to the companion's performance file. */
function allStates(asset: LottieAsset): Record<CompanionAnim, LottieAsset> {
  return { idle: asset, celebrate: asset, encourage: asset, cozy: asset, proud: asset, sad: asset };
}

export const COMPANION_LOTTIE: Record<CompanionType, Partial<Record<CompanionAnim, LottieAsset>>> = {
  fox: allStates(FOX),
  bunny: allStates(BUNNY),
  butterfly: allStates(BUTTERFLY),
  cat: allStates(CAT),
  owl: allStates(OWL),
  blossom: allStates(BLOSSOM),
};

/** Shared moment animations — these carry the BIG emotion over the character. */
export const MOMENT_LOTTIE: Partial<Record<MomentAnim, LottieAsset>> = {
  confetti: require('../../assets/lottie/moments/party.json') as LottieAsset,
  quiz_perfect: require('../../assets/lottie/moments/mindblown.json') as LottieAsset,
  level_up: require('../../assets/lottie/moments/sparkles.json') as LottieAsset,
  streak_flame: require('../../assets/lottie/moments/fire.json') as LottieAsset,
  heart: require('../../assets/lottie/moments/heart.json') as LottieAsset,
  hydration: require('../../assets/lottie/moments/sparkles.json') as LottieAsset,
};

/** The gentle overlay for a low-mood day. */
export const HUG_LOTTIE = require('../../assets/lottie/moments/hug.json') as LottieAsset;

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

/**
 * A check-in mood score (1..5) → the companion performance to play.
 *
 * Deliberately gentle at the bottom: a low day gets the SLOW, quiet performance
 * ('sad' plays at 0.55x), never a bouncing animal. Someone who just logged
 * "rough" and gets celebrated at is being talked over.
 */
export function animForMood(moodScore: number | null): CompanionAnim {
  if (moodScore === null || !Number.isFinite(moodScore)) return 'idle';
  if (moodScore <= 2) return 'sad';
  if (moodScore === 3) return 'idle';
  if (moodScore === 4) return 'encourage';
  return 'celebrate';
}
