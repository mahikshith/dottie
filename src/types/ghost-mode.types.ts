/**
 * Dottie — Ghost Mode Types (Canonical)
 *
 * Ghost Mode is Dottie's safety-first feature for users whose phones
 * might be seen by other people — teens in conservative households,
 * partners who shouldn't see, workplace browsers, controlling spouses.
 *
 * ─── DESIGN GOALS ───────────────────────────────────────────────────
 *
 *  1. NEVER reveal that Dottie is a period-tracking app to a snooper.
 *     - Lock screen says "Garden Notes" (not "Dottie") if disguise on
 *     - Wrong PIN routes to a DECOY app that looks like a plant journal
 *     - App icon stays Dottie on the home screen (icon swapping needs
 *       a separate native module — out of MVP scope), but everything
 *       inside the app can pretend to be something else
 *
 *  2. The user with the PIN gets to Dottie in a single warm tap.
 *     No friction for the actual owner.
 *
 *  3. A user can DISABLE Ghost Mode at any time. We never trap
 *     anyone in this feature.
 *
 *  4. If Ghost Mode is OFF, the lock screen never appears. Zero cost
 *     to users who don't want it.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  - The PIN is HASHED (PBKDF2-like; see pin-hash.ts) with a per-user
 *    salt. The plaintext PIN never touches storage.
 *  - The hash lives in MMKV's encrypted store — at-rest encryption
 *    bound to the device's secure enclave when available.
 *  - We rate-limit attempts (5 failed PINs → 30s cooldown) to defeat
 *    brute force on a small key space.
 *
 * ─── SINGLE SOURCE OF TRUTH ─────────────────────────────────────────
 *
 *  Every Ghost Mode shape lives here. The security module, the lock
 *  screen, the decoy app, and the settings UI all import from this
 *  file. If we ever need to evolve (e.g. biometric unlock), shapes
 *  evolve here first.
 */

// ─── PIN CONFIGURATION ───────────────────────────────────────────────

/** Minimum and maximum allowed PIN length (4-6 digits). */
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 6;

/** After this many failed attempts, we lock out for COOLDOWN_MS. */
export const MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN = 5;
export const COOLDOWN_MS = 30_000; // 30 seconds

/**
 * Length of the per-user salt prepended to the PIN before hashing.
 * Long enough that a stolen hash is useless without the device.
 */
export const PIN_SALT_LENGTH = 16;

/**
 * Number of hash iterations. Tuned for ~50ms on a modern phone — fast
 * enough to feel instant, slow enough to make brute force impractical.
 */
export const PIN_HASH_ITERATIONS = 4_000;

// ─── DOMAIN TYPES ────────────────────────────────────────────────────

/** Result of attempting to set / change the PIN. */
export type SetPinResult =
  | { ok: true }
  | { ok: false; reason: 'too_short' | 'too_long' | 'non_numeric' };

/** Result of attempting to verify a PIN. */
export type VerifyPinResult =
  | { ok: true; isPanic: boolean }
  | {
      ok: false;
      reason: 'wrong_pin' | 'in_cooldown';
      attemptsRemaining: number;
      /** ISO timestamp when cooldown lifts, if `reason === 'in_cooldown'`. */
      cooldownUntil: string | null;
    };

/**
 * Which visual skin the "Garden Notes" decoy (and its lock screen) wears.
 *  - 'aurora' → dark liquid-glass, matches the rest of Dottie (default)
 *  - 'cream'  → the classic warm plant-journal palette
 * The owner picks this in Ghost Mode settings — "give the control to the user."
 */
export type DecoyTheme = 'aurora' | 'cream';

/** Snapshot of Ghost Mode's current configuration. */
export interface GhostModeConfig {
  /** True when the user has enabled Ghost Mode (PIN is set). */
  enabled: boolean;
  /**
   * True when wrong PIN should silently wipe the app after a SECOND
   * wrong attempt (configurable safety: off by default).
   */
  panicWipeEnabled: boolean;
  /**
   * True when the lock screen should pose as "Garden Notes" instead
   * of "Dottie". Default: true (the whole point of Ghost Mode).
   */
  disguiseAppName: boolean;
  /**
   * True when wrong PIN routes to a DECOY home instead of just
   * showing an error. Default: true.
   */
  routeToDecoyOnFailure: boolean;
  /**
   * Which look the decoy "Garden Notes" app wears. Default: 'aurora'.
   * The user toggles this in settings so they control the disguise's
   * appearance (some prefer the classic cream journal, some the dark app).
   */
  decoyTheme: DecoyTheme;
  /** Total failed attempts since the last successful unlock. */
  failedAttemptsInARow: number;
  /** ISO timestamp of the most recent cooldown start, if any. */
  cooldownStartedAt: string | null;
}

/** App-level lock state during runtime. */
export type LockState =
  /** Ghost Mode is off — lock screen never appears. */
  | { kind: 'disabled' }
  /** Ghost Mode is on AND we're currently locked (need PIN to enter). */
  | { kind: 'locked' }
  /** Ghost Mode is on, PIN verified, real Dottie is showing. */
  | { kind: 'unlocked' }
  /** User is viewing the decoy "Garden Notes" app. */
  | { kind: 'decoy' };

/** Reasons the lock screen should appear (drives copy + analytics). */
export type LockReason =
  | 'cold_start'      // app just opened
  | 'foreground'      // app came back from background
  | 'manual_lock'     // user tapped "Lock Now" in settings
  | 'long_press';     // user did the "boss walked in" gesture

// ─── DECOY APP CONFIG ────────────────────────────────────────────────

/**
 * The decoy app is intentionally plausible-but-boring: a calm green
 * "Garden Notes" plant journaling app. Anyone glancing over the user's
 * shoulder sees what looks like a notes app, not a period tracker.
 */
export interface DecoyPlantNote {
  id: string;
  emoji: string;
  /** The plant's name ("Pothos", "Snake Plant", "Lavender"). */
  name: string;
  /** Last "watering" date — calm, fake, deterministic per user. */
  lastWatered: string; // ISO YYYY-MM-DD
  /** Next watering reminder — pure decoration. */
  nextWatering: string; // ISO YYYY-MM-DD
  /** A one-line "care note" the user supposedly wrote. */
  note: string;
}

/**
 * The complete decoy view model. We generate it once on cold start
 * and cache so it doesn't visibly change between unlocks.
 */
export interface DecoyAppState {
  /** Header greeting ("Good morning · 3 plants thirsty"). */
  greeting: string;
  /** Calm sky/leaf-tinted accent color the decoy renders with. */
  accentColor: string;
  /** The notes list to render. */
  plants: DecoyPlantNote[];
  /** Deterministic ISO timestamp for the decoy's "last saved" footer. */
  lastSavedAt: string;
}
