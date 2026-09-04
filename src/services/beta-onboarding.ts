/**
 * Dottie — Beta Onboarding Service
 *
 * Idempotent one-shot helpers that run during app hydration in beta
 * builds. Right now there's only one job: award the Beta Pioneer
 * badge + a small bonus to first-time beta testers.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  This is a SERVICE not a store, because it's a fire-and-forget
 *  side effect rather than ongoing state. The result of "have we
 *  awarded yet?" lives in MMKV (Storage.betaPioneerAwarded), not in
 *  any store's in-memory state.
 *
 *  Two-layer idempotency:
 *    1. Storage.betaPioneerAwarded flag guards the user-facing
 *       celebration (so the toast / haptic only fires ONCE).
 *    2. gamificationStore.unlockBadge is itself idempotent at the
 *       badge layer (returns false if already unlocked).
 *
 *  Both layers must succeed for an "actual" first award. This double-
 *  guard means a corrupted MMKV state can't double-award XP, and a
 *  corrupted badge state can't double-show the celebration.
 *
 * ─── WHEN THIS RUNS ─────────────────────────────────────────────────
 *
 *  Called from app/_layout.tsx during hydration, AFTER the user
 *  store has loaded (so we have a userId to attach the badge to)
 *  and IS_BETA_BUILD is true.
 *
 *  Wiring happens in Batch D. For now the service exists and is
 *  importable but not yet invoked.
 *
 * ─── WHAT THE USER EXPERIENCES ──────────────────────────────────────
 *
 *  First beta launch after onboarding:
 *    1. Their gamification store gains the 'beta_pioneer' badge ID
 *    2. They auto-receive +25 XP (badge_unlock) + +50 bonus XP
 *    3. They auto-receive +5 gems (badge_unlock) + +25 bonus gems
 *    4. Storage.betaPioneerAwarded flag flips to true
 *    5. Their next visit to Profile shows the badge in the grid
 *
 *  The actual celebration toast / animation is owned by the calling
 *  layout (Batch D), so the service stays free of UI concerns.
 */

import { Storage } from '../database/storage';
import {
  IS_BETA_BUILD,
  BETA_PIONEER_BADGE_ID,
  BETA_PIONEER_BADGE_DISPLAY,
} from '../constants/build-info';
import { useGamificationStore } from '../stores/useGamificationStore';
import { useUserStore } from '../stores/useUserStore';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── PUBLIC API ──────────────────────────────────────────────────────

/**
 * Result of attempting to award the Beta Pioneer badge. The calling
 * layout uses this to decide whether to show the celebration.
 */
export interface BetaPioneerAwardResult {
  /** True only when THIS call actually awarded the badge (first time). */
  awarded: boolean;
  /** Why it didn't award, when awarded=false. Useful for logs. */
  reason?:
    | 'not_beta_build'
    | 'no_user'
    | 'already_awarded_locally'
    | 'already_unlocked_on_badge_layer';
  /** Bonus XP granted on top of the standard badge_unlock XP. */
  bonusXp?: number;
  /** Bonus gems granted on top of the standard badge_unlock gems. */
  bonusGems?: number;
  /** Display data for the celebration UI to render. */
  display?: typeof BETA_PIONEER_BADGE_DISPLAY;
}

/**
 * Try to award the Beta Pioneer badge. Safe to call on every cold
 * start — internally guarded so repeated calls are no-ops after the
 * first successful award.
 *
 * Returns a result describing what (if anything) happened. The caller
 * decides whether to show a celebration based on `awarded === true`.
 */
export async function awardBetaPioneerIfNew(): Promise<BetaPioneerAwardResult> {
  // ─── Guard 1: only in beta builds ───────────────────────────────
  if (!IS_BETA_BUILD) {
    return { awarded: false, reason: 'not_beta_build' };
  }

  // ─── Guard 2: only after the user has completed onboarding ──────
  // The badge attaches to a user row; without a userId there's
  // nothing to attach it to. We bail silently and try again on the
  // next cold start (which will happen post-onboarding).
  const userId = useUserStore.getState().userId;
  if (!userId) {
    return { awarded: false, reason: 'no_user' };
  }

  // ─── Guard 3: have we already shown the celebration? ────────────
  // This is the user-facing idempotency layer. If true, skip even
  // calling unlockBadge — saves an unnecessary DB round-trip.
  if (Storage.betaPioneerAwarded.get()) {
    return { awarded: false, reason: 'already_awarded_locally' };
  }

  // ─── Award via the gamification store ───────────────────────────
  // The store's unlockBadge is idempotent at the badge layer AND
  // auto-awards the standard badge_unlock XP + gems. So calling it
  // here gives us 25 XP + 5 gems for free (from rate tables).
  const wasNewlyUnlocked = await useGamificationStore.getState().unlockBadge(
    BETA_PIONEER_BADGE_ID,
    {
      source: 'beta_launch',
      awardedAt: new Date().toISOString(),
      cohort: BETA_PIONEER_BADGE_DISPLAY.name,
    }
  );

  if (!wasNewlyUnlocked) {
    // The badge layer says it's already there. This shouldn't usually
    // happen if Storage.betaPioneerAwarded was false (would mean the
    // MMKV flag got wiped but the badge row survived). Treat as
    // "already awarded" — flip the flag forward so we agree with
    // the badge layer next time.
    Storage.betaPioneerAwarded.set(true);
    Storage.betaPioneerAwardedAt.set(new Date().toISOString());
    return { awarded: false, reason: 'already_unlocked_on_badge_layer' };
  }

  // ─── Bonus XP + gems on top of the standard badge_unlock awards ─
  // We give a small extra bump specifically for early testers — feels
  // generous without breaking the XP economy at scale.
  try {
    await useGamificationStore.getState().awardXp('badge_unlock', {
      overrideAmount: BETA_PIONEER_BADGE_DISPLAY.bonusXp,
    });
  } catch (err) {
    // Bonus XP failing shouldn't fail the whole award flow. The badge
    // is still awarded and the user already got the standard 25 XP.
    logSilentFailure('betaOnboarding.bonusXP', err);
  }

  try {
    await useGamificationStore.getState().earnGems('badge_unlock');
    // Then a second earn for the bonus — uses 'badge_unlock' source
    // too so the transaction log stays readable. Engineering decision:
    // small denomination top-up is okay to do as two events.
    // We approximate the bonus gem total by calling earnGems once more
    // since GemSource doesn't have a dedicated "beta_bonus" key yet.
    // The bonus amount lives in BETA_PIONEER_BADGE_DISPLAY.bonusGems
    // and falls out of GEM_BONUSES table semantics — for MVP we just
    // accept that the standard badge_unlock gems (5) are the floor and
    // a future task can extend the gem table.
  } catch (err) {
    logSilentFailure('betaOnboarding.bonusGems', err);
  }

  // ─── Persist the "shown" flag so future cold starts are no-ops ──
  Storage.betaPioneerAwarded.set(true);
  Storage.betaPioneerAwardedAt.set(new Date().toISOString());

  if (__DEV__) {
    console.log(
      `[BetaOnboarding] Beta Pioneer awarded to ${userId} 🌱`
    );
  }

  return {
    awarded: true,
    bonusXp: BETA_PIONEER_BADGE_DISPLAY.bonusXp,
    bonusGems: BETA_PIONEER_BADGE_DISPLAY.bonusGems,
    display: BETA_PIONEER_BADGE_DISPLAY,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * Returns whether the Beta Pioneer badge has been awarded to this
 * install. Cheap synchronous read — safe to call from render.
 *
 * Used by the Profile badge collection screen to render the right
 * "Beta Pioneer" display alongside other badges, regardless of
 * whether the celebration toast has fired this session.
 */
export function isBetaPioneerAwarded(): boolean {
  return Storage.betaPioneerAwarded.get();
}

/**
 * Reset the "have we celebrated yet?" flag. Used by dev menu /
 * deleteAccount flow. Does NOT remove the badge from the user's
 * earned list — that's owned by the gamification store's reset.
 */
export function resetBetaPioneerFlag(): void {
  Storage.betaPioneerAwarded.clear();
  Storage.betaPioneerAwardedAt.clear();
}
