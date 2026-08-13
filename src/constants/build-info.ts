/**
 * Dottie — Build Info Constants
 *
 * Single source of truth for app/build identity. Used by:
 *   - FeedbackSheet (attaches version + build to every feedback email)
 *   - VersionBadge (tiny corner indicator visible in beta builds)
 *   - Beta onboarding service (decides whether to award Beta Pioneer)
 *   - Future analytics tagging
 *
 * ─── WHY A SEPARATE FILE ────────────────────────────────────────────
 *
 *  We could read these from app.json via expo-constants, but:
 *    1. expo-constants requires a runtime import that bloats the
 *       Metro bundle slightly even when we don't read it
 *    2. Hardcoding here gives us a clear "what beta build is this?"
 *       record that lives in git history
 *    3. Easier to swap to a build-time injected value later if we
 *       add EAS Build pipelines that auto-bump the number
 *
 *  When you ship a new beta build:
 *    1. Bump APP_VERSION here (e.g., 0.12.0 → 0.12.1)
 *    2. Bump BUILD_NUMBER here (e.g., '1' → '2')
 *    3. Optionally bump app.json's version too (for stores)
 *
 * ─── BETA FLAG ──────────────────────────────────────────────────────
 *
 *  IS_BETA_BUILD gates visibility of beta-only UI:
 *    - Feedback bubble visible on all tabs ONLY when true
 *    - Version badge visible ONLY when true
 *    - Beta Pioneer badge awarded ONLY when true
 *
 *  Set to false when shipping to App Store / Play Store production.
 *  Leave true for internal testing / TestFlight / Expo Go QR.
 */

// ─── APP VERSION ─────────────────────────────────────────────────────

/**
 * Semantic version string shown in feedback emails + version badge.
 * Bump on every beta build so testers can pin bugs to a specific
 * snapshot of the app.
 */
export const APP_VERSION = '0.12.0';

/**
 * Build number — increments on every code change shipped to testers.
 * String type because Expo treats both iOS buildNumber + Android
 * versionCode as strings in info plists. Treat it as opaque.
 */
export const BUILD_NUMBER = '1';

/**
 * Human-readable build label used in the version badge and feedback
 * emails. Combines version + build for a glance-friendly tag.
 *
 * Example: "Beta 0.12.0 · build 1"
 */
export const BUILD_LABEL = `Beta ${APP_VERSION} · build ${BUILD_NUMBER}`;

// ─── BETA FLAGS ──────────────────────────────────────────────────────

/**
 * True when the app is currently running as a beta build. Drives
 * visibility of feedback affordances, version badge, beta pioneer
 * reward, and any "this is unfinished" UI nudges.
 *
 * KEEP TRUE during Chunk 12 testing. Flip to false ONLY when
 * shipping a true production build.
 */
export const IS_BETA_BUILD = true;

/**
 * Codename for the current beta cohort. Lets us segment "early early"
 * testers from "second wave" testers in feedback analytics. Optional
 * but a nice signal in subject lines.
 */
export const BETA_COHORT_NAME = 'Wildflower';

// ─── FEEDBACK ────────────────────────────────────────────────────────

/**
 * Where beta feedback emails are addressed. Used by the feedback
 * transport layer (src/services/feedback-transport.ts).
 *
 * If you ever rotate this address, update it HERE — every email
 * composer call reads from this constant.
 */
export const FEEDBACK_TO_EMAIL = 'mahikshith97@gmail.com';

/**
 * Subject-line prefix for beta feedback emails. Makes filtering /
 * search in your inbox trivial:
 *
 *   from:somebody [Dottie Beta] feedback from priya@gmail.com
 *
 * Pulled from a constant so the prefix is consistent across all
 * transport variants (mail composer, share sheet).
 */
export const FEEDBACK_SUBJECT_PREFIX = '[Dottie Beta]';

// ─── BADGE IDs ───────────────────────────────────────────────────────

/**
 * The Beta Pioneer badge — automatically awarded on first launch in a
 * beta build. Not in BADGE_DEFINITIONS because it's not condition-
 * evaluated (it's event-driven on cold start).
 *
 * The Profile screen's badge display handles this ID with a friendly
 * fallback render so testers see "🌱 Beta Pioneer" instead of a raw ID.
 */
export const BETA_PIONEER_BADGE_ID = 'beta_pioneer';

/**
 * Display metadata for the Beta Pioneer badge. Imported by:
 *   - beta-onboarding.ts (passes metadata to unlockBadge call)
 *   - badge collection screen (renders this badge when present)
 */
export const BETA_PIONEER_BADGE_DISPLAY = {
  id: BETA_PIONEER_BADGE_ID,
  name: 'Beta Pioneer',
  emoji: '🌱',
  description: 'You were here when Dottie was just starting to bloom 💛',
  /** Bonus XP awarded alongside the badge unlock (in addition to the
   *  standard badge_unlock XP that the gamification store already gives). */
  bonusXp: 50,
  /** Bonus gems awarded — a small celebration deposit for early testers. */
  bonusGems: 25,
} as const;

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * Get a structured snapshot of build info — handy for logging,
 * analytics events, and crash diagnostics.
 */
export function getBuildInfo() {
  return {
    appVersion: APP_VERSION,
    buildNumber: BUILD_NUMBER,
    isBeta: IS_BETA_BUILD,
    cohort: BETA_COHORT_NAME,
    label: BUILD_LABEL,
  } as const;
}

/**
 * Format a clipboard-friendly build string for testers to paste into
 * bug reports. Multi-line so it's readable when shared.
 */
export function getBuildInfoClipboardText(): string {
  return [
    `Dottie ${APP_VERSION} (build ${BUILD_NUMBER})`,
    `Cohort: ${BETA_COHORT_NAME}`,
    `Captured: ${new Date().toLocaleString()}`,
  ].join('\n');
}
