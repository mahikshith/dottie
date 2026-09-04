/**
 * Dottie — Ghost Mode Store (Security + State)
 *
 * The single place that owns:
 *   - Reading / writing PIN hash + salt + panic PIN hash
 *   - Tracking failed attempts + cooldown
 *   - Verifying a typed PIN
 *   - Driving the LockState that the root layout reacts to
 *
 * ─── ARCHITECTURE ───────────────────────────────────────────────────
 *
 *  This is a Zustand store, like our other domain stores. The root
 *  layout subscribes to lockState and renders the lock screen overlay
 *  when needed. UI components (PIN pad, settings) call action methods.
 *
 *  Persistence lives in MMKV via the Storage module — secrets stay in
 *  the encrypted MMKV bucket, never in SQLite. The store stays
 *  in-memory only for transient state (failed attempts in a row,
 *  cooldown timer).
 *
 * ─── PANIC PIN ──────────────────────────────────────────────────────
 *
 *  An OPTIONAL second PIN that, when entered, silently wipes the app
 *  and shows the decoy. Used for high-coercion scenarios ("hand over
 *  the PIN" → user enters panic PIN → app appears empty).
 *
 *  MVP wipe = clearAll() on MMKV + drop all SQLite tables. This is a
 *  one-way destructive action — we make this VERY clear in the UI.
 *
 * ─── ROOT LAYOUT INTEGRATION ────────────────────────────────────────
 *
 *  After hydration, the root layout calls:
 *    const lockState = useGhostModeStore.getState().computeInitialLockState();
 *
 *  If lockState === 'locked', the layout renders the lock-screen
 *  modal full-screen over everything else. When the user enters the
 *  correct PIN, the store transitions to 'unlocked' and the modal
 *  dismisses, revealing the real app.
 */

import { create } from 'zustand';
import {
  DecoyTheme,
  GhostModeConfig,
  LockReason,
  LockState,
  MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN,
  COOLDOWN_MS,
  SetPinResult,
  VerifyPinResult,
} from '../types/ghost-mode.types';
import {
  compareHashes,
  generateSalt,
  hashPin,
  isValidPinShape,
} from './pin-hash';
import { Storage } from '../database/storage';
import { logSilentFailure } from '../diagnostics/silent-failure';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

export interface GhostModeStoreState {
  // ─── Public state read by UI ────────────────────────────────────
  lockState: LockState;
  /** Cooldown end time (ms epoch), null when not in cooldown. */
  cooldownEndsAt: number | null;
  /** Failed PIN attempts since the last successful unlock. */
  failedAttempts: number;
  /** Most recent reason the lock screen appeared (for analytics + copy). */
  lastLockReason: LockReason | null;

  /**
   * Monotonic counter that bumps whenever a config value changes
   * (panic toggle, disguise toggle, route-to-decoy toggle, PIN
   * (de)activation). Components that need to re-render on config
   * changes can subscribe to this counter via selectConfigVersion.
   *
   * Why not subscribe to MMKV directly? MMKV reads are synchronous
   * but don't trigger React renders on their own. Zustand selectors
   * fire on store state changes — so we use this counter as a
   * "config changed" beacon that React can observe.
   */
  configVersion: number;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Compute the lock state to use at app start. Reads MMKV
   * synchronously — safe to call from the root layout's render.
   */
  computeInitialLockState: (reason?: LockReason) => LockState;

  /**
   * Enable Ghost Mode by setting a PIN. Hashes + salts and writes
   * to encrypted storage. Returns success / detailed failure.
   */
  setPin: (pin: string) => SetPinResult;

  /**
   * Set (or clear) the optional panic PIN.
   * Pass `null` to remove it.
   */
  setPanicPin: (pin: string | null) => SetPinResult;

  /**
   * Verify a PIN against the stored hash. Handles:
   *   - Rate limiting (5 attempts → cooldown)
   *   - Panic PIN detection (separate hash check)
   *   - State transitions (unlock / decoy / wipe)
   *
   * Returns a detailed verification result for the UI to render.
   */
  verifyPin: (pin: string) => VerifyPinResult;

  /**
   * Manually lock the app right now (e.g., from settings or after
   * the long-press "boss walked in" gesture). Switches lock state
   * to either 'locked' or 'decoy' depending on the reason.
   */
  lockNow: (reason: LockReason) => void;

  /** Drop the user into the decoy view explicitly. */
  enterDecoy: () => void;

  /**
   * Leave the decoy "Garden Notes" view. This is the escape hatch the
   * hardware back button (Android) and the secret triple-tap use so the
   * owner is NEVER trapped in the decoy:
   *   - If Ghost Mode is still configured (PIN present) → back to the
   *     locked PIN screen, so the owner can type their PIN and get in.
   *   - If Ghost Mode is no longer configured (e.g. after a panic wipe
   *     cleared the PIN) → unlock straight through to the (now fresh) app,
   *     because there is nothing left to protect and staying in the decoy
   *     would be the trap all over again.
   */
  exitDecoy: () => void;

  /**
   * Disable Ghost Mode entirely. Clears PIN hash, salt, panic hash,
   * and all related flags. Used when the user opts out from settings.
   */
  disable: () => void;

  /**
   * Read the current config snapshot (for the settings screen).
   * Cheap — pure MMKV reads.
   */
  getConfig: () => GhostModeConfig;

  /**
   * Update panic-wipe and disguise toggles. Lightweight settings,
   * persisted to MMKV.
   */
  updateConfig: (patch: Partial<Pick<GhostModeConfig, 'panicWipeEnabled' | 'disguiseAppName' | 'routeToDecoyOnFailure' | 'decoyTheme'>>) => void;

  /** Reset everything (called by user.deleteAccount()). */
  reset: () => void;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  lockState: { kind: 'disabled' } as LockState,
  cooldownEndsAt: null as number | null,
  failedAttempts: 0,
  lastLockReason: null as LockReason | null,
  configVersion: 0,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useGhostModeStore = create<GhostModeStoreState>((set, get) => ({
  ...initialState,

  // ─── computeInitialLockState ────────────────────────────────────

  computeInitialLockState: (reason: LockReason = 'cold_start') => {
    const enabled = Storage.ghostModeActive.get();
    const hasPin = Boolean(Storage.ghostPinHash.get());

    // Ghost Mode counts as ENABLED only when both the flag is on AND
    // a PIN is actually set. Otherwise we silently fall back to
    // 'disabled' (heals weird half-configured states).
    const isReallyEnabled = enabled && hasPin;
    if (!isReallyEnabled) {
      set({ lockState: { kind: 'disabled' }, failedAttempts: 0, lastLockReason: null });
      return { kind: 'disabled' };
    }

    set({
      lockState: { kind: 'locked' },
      failedAttempts: 0, // reset on cold start — old failures don't carry over
      cooldownEndsAt: null,
      lastLockReason: reason,
    });
    return { kind: 'locked' };
  },

  // ─── setPin ─────────────────────────────────────────────────────

  setPin: (pin: string) => {
    const validity = isValidPinShape(pin);
    if (!validity.ok) {
      return { ok: false, reason: validity.reason };
    }

    // Fresh salt for each new PIN — prevents rainbow-table reuse
    const salt = generateSalt();
    const hash = hashPin(pin, salt);

    Storage.ghostPinSalt.set(salt);
    Storage.ghostPinHash.set(hash);
    Storage.ghostModeActive.set(true);

    // Default the auxiliary toggles to safe / friendly values on
    // first enablement; user can change them in settings.
    if (Storage.ghostDisguiseAppName.get() === undefined) {
      Storage.ghostDisguiseAppName.set(true);
    }
    if (Storage.ghostRouteToDecoyOnFailure.get() === undefined) {
      Storage.ghostRouteToDecoyOnFailure.set(true);
    }
    if (Storage.ghostPanicWipeEnabled.get() === undefined) {
      Storage.ghostPanicWipeEnabled.set(false);
    }
    if (Storage.ghostDecoyTheme.get() === undefined) {
      // Default to the aurora look so the decoy matches the rest of the
      // app out of the box; the user can switch to cream in settings.
      Storage.ghostDecoyTheme.set('aurora');
    }

    // Once a PIN is set, the app should be unlocked for the rest of
    // this session (the user is the one who set it). Bump
    // configVersion so subscribers (Profile tab, settings preview)
    // re-render with the new enabled state.
    set({
      lockState: { kind: 'unlocked' },
      failedAttempts: 0,
      cooldownEndsAt: null,
      lastLockReason: null,
      configVersion: get().configVersion + 1,
    });

    return { ok: true };
  },

  // ─── setPanicPin ────────────────────────────────────────────────

  setPanicPin: (pin: string | null) => {
    if (pin === null) {
      Storage.ghostPanicHash.clear();
      set({ configVersion: get().configVersion + 1 });
      return { ok: true };
    }

    const validity = isValidPinShape(pin);
    if (!validity.ok) {
      return { ok: false, reason: validity.reason };
    }

    // Panic PIN reuses the same salt as the main PIN so we can't tell
    // them apart from a stored-hash dump alone.
    const salt = Storage.ghostPinSalt.get();
    if (!salt) {
      // Should never happen — main PIN must be set first. UI prevents it.
      return { ok: false, reason: 'too_short' };
    }

    const hash = hashPin(pin, salt);
    Storage.ghostPanicHash.set(hash);
    set({ configVersion: get().configVersion + 1 });
    return { ok: true };
  },

  // ─── verifyPin ──────────────────────────────────────────────────

  verifyPin: (pin: string) => {
    // Cooldown check
    const cooldownEnd = get().cooldownEndsAt;
    if (cooldownEnd !== null && Date.now() < cooldownEnd) {
      return {
        ok: false,
        reason: 'in_cooldown',
        attemptsRemaining: 0,
        cooldownUntil: new Date(cooldownEnd).toISOString(),
      };
    }

    // Clear cooldown if it has expired
    if (cooldownEnd !== null && Date.now() >= cooldownEnd) {
      set({ cooldownEndsAt: null, failedAttempts: 0 });
    }

    const salt = Storage.ghostPinSalt.get();
    const storedHash = Storage.ghostPinHash.get();
    const panicHash = Storage.ghostPanicHash.get();

    if (!salt || !storedHash) {
      // Misconfigured — fail safe by silently treating as unlocked
      // so the user is never trapped by a broken state.
      set({ lockState: { kind: 'unlocked' }, failedAttempts: 0 });
      return { ok: true, isPanic: false };
    }

    const inputHash = hashPin(pin, salt);

    // Panic PIN — always evaluated FIRST (no time leak that "main" was tried first)
    if (panicHash && compareHashes(inputHash, panicHash)) {
      // Silent wipe path. Looks indistinguishable from a successful unlock
      // to anyone watching the screen, but everything is gone after.
      const panicWipeEnabled = Storage.ghostPanicWipeEnabled.get();
      if (panicWipeEnabled) {
        performPanicWipe();
      }
      // Land the user on the decoy app so they appear to be in a notes
      // app of some kind, not a freshly-wiped Dottie.
      set({
        lockState: { kind: 'decoy' },
        failedAttempts: 0,
        cooldownEndsAt: null,
      });
      return { ok: true, isPanic: true };
    }

    // Main PIN
    if (compareHashes(inputHash, storedHash)) {
      set({
        lockState: { kind: 'unlocked' },
        failedAttempts: 0,
        cooldownEndsAt: null,
        lastLockReason: null,
      });
      return { ok: true, isPanic: false };
    }

    // Wrong PIN — increment failures + maybe cooldown + maybe decoy
    const newFails = get().failedAttempts + 1;
    let newCooldownEnd: number | null = null;

    if (newFails >= MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN) {
      newCooldownEnd = Date.now() + COOLDOWN_MS;
    }

    // If the user has chosen "route to decoy on failure" (the default),
    // a wrong PIN drops them silently into the decoy app rather than
    // showing repeated red "WRONG" messages. This is the central
    // privacy promise: a snooper sees a plant journal, not a lock.
    const routeToDecoy = Storage.ghostRouteToDecoyOnFailure.get();
    if (routeToDecoy) {
      set({
        lockState: { kind: 'decoy' },
        failedAttempts: newFails,
        cooldownEndsAt: newCooldownEnd,
      });
    } else {
      set({
        failedAttempts: newFails,
        cooldownEndsAt: newCooldownEnd,
      });
    }

    return {
      ok: false,
      reason: 'wrong_pin',
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN - newFails),
      cooldownUntil: newCooldownEnd !== null ? new Date(newCooldownEnd).toISOString() : null,
    };
  },

  // ─── lockNow ────────────────────────────────────────────────────

  lockNow: (reason: LockReason) => {
    const enabled = Storage.ghostModeActive.get();
    const hasPin = Boolean(Storage.ghostPinHash.get());
    if (!enabled || !hasPin) return; // nothing to lock

    // Long-press "boss walked in" goes straight to decoy (no PIN pad
    // visible — that would itself reveal "this is locked"). All other
    // lock reasons show the PIN pad.
    const target: LockState =
      reason === 'long_press' ? { kind: 'decoy' } : { kind: 'locked' };

    set({
      lockState: target,
      failedAttempts: 0,
      cooldownEndsAt: null,
      lastLockReason: reason,
    });
  },

  // ─── enterDecoy ─────────────────────────────────────────────────

  enterDecoy: () => {
    set({ lockState: { kind: 'decoy' } });
  },

  // ─── exitDecoy ──────────────────────────────────────────────────

  exitDecoy: () => {
    const enabled = Storage.ghostModeActive.get();
    const hasPin = Boolean(Storage.ghostPinHash.get());
    if (enabled && hasPin) {
      // Back to the PIN screen so the owner can unlock. This is the fix
      // for the "trapped in the garden with no way back" report — the
      // hardware back button and the secret triple-tap both land here.
      set({
        lockState: { kind: 'locked' },
        failedAttempts: 0,
        cooldownEndsAt: null,
        lastLockReason: 'manual_lock',
      });
    } else {
      // Nothing left to protect (e.g. a panic wipe already cleared the
      // PIN) — reveal the app rather than keep the user stuck in the decoy.
      set({ lockState: { kind: 'unlocked' } });
    }
  },

  // ─── disable ────────────────────────────────────────────────────

  disable: () => {
    Storage.ghostModeActive.set(false);
    Storage.ghostPinHash.clear();
    Storage.ghostPinSalt.clear();
    Storage.ghostPanicHash.clear();
    // Keep the auxiliary toggles around so re-enabling later remembers
    // the user's preferences (disguise + decoy + panic wipe).

    set({
      lockState: { kind: 'disabled' },
      failedAttempts: 0,
      cooldownEndsAt: null,
      lastLockReason: null,
      configVersion: get().configVersion + 1,
    });
  },

  // ─── getConfig ──────────────────────────────────────────────────

  getConfig: (): GhostModeConfig => {
    const hasPin = Boolean(Storage.ghostPinHash.get());
    const enabled = Storage.ghostModeActive.get() && hasPin;
    return {
      enabled,
      panicWipeEnabled: Storage.ghostPanicWipeEnabled.get() ?? false,
      disguiseAppName: Storage.ghostDisguiseAppName.get() ?? true,
      routeToDecoyOnFailure: Storage.ghostRouteToDecoyOnFailure.get() ?? true,
      decoyTheme: coerceDecoyTheme(Storage.ghostDecoyTheme.get()),
      failedAttemptsInARow: get().failedAttempts,
      cooldownStartedAt:
        get().cooldownEndsAt !== null
          ? new Date(get().cooldownEndsAt! - COOLDOWN_MS).toISOString()
          : null,
    };
  },

  // ─── updateConfig ───────────────────────────────────────────────

  updateConfig: (patch) => {
    if (patch.panicWipeEnabled !== undefined) {
      Storage.ghostPanicWipeEnabled.set(patch.panicWipeEnabled);
    }
    if (patch.disguiseAppName !== undefined) {
      Storage.ghostDisguiseAppName.set(patch.disguiseAppName);
    }
    if (patch.routeToDecoyOnFailure !== undefined) {
      Storage.ghostRouteToDecoyOnFailure.set(patch.routeToDecoyOnFailure);
    }
    if (patch.decoyTheme !== undefined) {
      Storage.ghostDecoyTheme.set(patch.decoyTheme);
    }
    // Bump config version so React subscribers (Profile tab, settings
    // toggles) re-read the underlying MMKV flags. Without this, the
    // toggle in settings flips visually but other screens stay stale
    // until next mount.
    set({ configVersion: get().configVersion + 1 });
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    Storage.ghostModeActive.clear();
    Storage.ghostPinHash.clear();
    Storage.ghostPinSalt.clear();
    Storage.ghostPanicHash.clear();
    Storage.ghostPanicWipeEnabled.clear();
    Storage.ghostDisguiseAppName.clear();
    Storage.ghostRouteToDecoyOnFailure.clear();
    Storage.ghostDecoyTheme.clear();
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

export const selectLockState = (s: GhostModeStoreState): LockState => s.lockState;
export const selectIsLocked = (s: GhostModeStoreState): boolean => s.lockState.kind === 'locked';
export const selectIsDecoy = (s: GhostModeStoreState): boolean => s.lockState.kind === 'decoy';
export const selectFailedAttempts = (s: GhostModeStoreState): number => s.failedAttempts;
export const selectCooldownEndsAt = (s: GhostModeStoreState): number | null => s.cooldownEndsAt;

/**
 * Returns true when Ghost Mode is currently enabled (PIN set + active).
 *
 * Reads the MMKV flag inside the selector so changes to disable()
 * or setPin() that update lockState trigger this selector to re-run.
 * The configVersion dependency ensures it also re-runs when the user
 * just toggles the underlying flag.
 *
 * Use this in any component that wants to react to "is Ghost Mode on"
 * without subscribing to the whole lockState object (which changes
 * during normal unlock cycles).
 */
export const selectIsGhostEnabled = (s: GhostModeStoreState): boolean => {
  // Touch configVersion so changes via updateConfig/setPin/disable
  // re-trigger subscribers (Zustand only fires selectors on store
  // state changes; we use configVersion as our beacon).
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  s.configVersion;
  return s.lockState.kind !== 'disabled' && Boolean(Storage.ghostPinHash.get());
};

/**
 * Whether the lock screen should pose as "Garden Notes" instead of
 * Dottie. Reads MMKV via the configVersion beacon so toggling the
 * setting refreshes subscribers immediately.
 */
export const selectDisguiseAppName = (s: GhostModeStoreState): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  s.configVersion;
  return Storage.ghostDisguiseAppName.get() ?? true;
};

/**
 * Which skin the decoy wears ('aurora' | 'cream'). Reads MMKV through the
 * configVersion beacon so the decoy re-skins the instant the user flips the
 * appearance toggle in settings.
 */
export const selectDecoyTheme = (s: GhostModeStoreState): DecoyTheme => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  s.configVersion;
  return coerceDecoyTheme(Storage.ghostDecoyTheme.get());
};

/** Cheap counter for "config changed" change-detection. */
export const selectConfigVersion = (s: GhostModeStoreState): number => s.configVersion;

// ─── INTERNAL: DECOY THEME COERCION ──────────────────────────────────

/**
 * Coerce the loosely-typed MMKV string into the DecoyTheme union.
 * Anything that isn't exactly 'cream' resolves to 'aurora' (the default),
 * so a missing key or a corrupted value can never crash the decoy.
 */
function coerceDecoyTheme(raw: string | undefined): DecoyTheme {
  return raw === 'cream' ? 'cream' : 'aurora';
}

// ─── INTERNAL: PANIC WIPE ────────────────────────────────────────────

/**
 * Silently obliterate user data. MVP wipe = MMKV clearAll.
 *
 * Notes:
 *  - We don't try to drop the SQLite tables here because that requires
 *    awaiting the DB handle, and panic wipe must be SYNCHRONOUS
 *    (it's triggered from a PIN keypress and must complete before the
 *    next render). Instead we clear MMKV's `currentUserId` which
 *    causes the next hydration to treat the user as "no account yet"
 *    and route to onboarding.
 *  - The SQLite tables remain on disk but are orphaned (no user row
 *    points to them). A future "real wipe" feature can scrub them
 *    on background hydration.
 *  - This trade-off is documented in the settings UI so the user
 *    knows the limits.
 */
function performPanicWipe(): void {
  try {
    Storage.clearAll();
  } catch (err) {
    logSilentFailure('ghostMode.panicWipe', err);
  }
}
