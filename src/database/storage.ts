/**
 * Dottie — MMKV Key-Value Storage
 *
 * Tiny, synchronous, encrypted-by-default storage for app preferences
 * and flags that DON'T belong in SQLite:
 *
 *   - Onboarding completion flag (read on every cold start)
 *   - Current user ID (so we don't have to query SQLite to find it)
 *   - Feature toggles (Ghost Mode active, ADHD mode on, etc.)
 *   - Last-seen content version (for OTA updates)
 *   - UI preferences (theme override, reduced motion)
 *
 *   - Ghost Mode secrets (PIN hash, salt, panic PIN hash) — chunk 11
 *   - Beta Pioneer celebration shown flag — chunk 12
 *
 * ─── WHY MMKV (NOT ASYNCSTORAGE) ────────────────────────────────────
 *
 *  AsyncStorage is async, slow, and doesn't encrypt. MMKV is:
 *    - 30x faster than AsyncStorage (microseconds, not milliseconds)
 *    - Synchronous — no await needed for flag reads
 *    - Built-in encryption (we use it for sensitive flags)
 *    - Tiny footprint (~50KB)
 *
 *  These properties matter for app startup: we read the onboarding
 *  flag on the splash screen, and AsyncStorage would add a visible
 *  delay before the first frame.
 *
 * ─── ENCRYPTION ─────────────────────────────────────────────────────
 *
 *  We use a static encryption key for MVP. It's stored in source —
 *  good enough to obfuscate values on a rooted device, NOT good enough
 *  for security-critical data. That's why the Ghost Mode PIN HASH and
 *  health data still live in SQLite, not here.
 *
 *  Future: derive the key from expo-secure-store with biometric gate.
 *
 * ─── KEY NAMESPACING ────────────────────────────────────────────────
 *
 *  We use typed accessors instead of raw string keys. This makes
 *  refactoring safer (find-all-references works) and prevents typos
 *  from silently creating ghost keys that never get cleared.
 *
 *    ❌  storage.getString('hasOnboarded')   ← typo-prone
 *    ✅  Storage.hasOnboarded.get()           ← type-safe
 */

import { MMKV } from 'react-native-mmkv';
import {
  getOrCreateMasterKey,
  isStorageMigrated,
  markStorageMigrated,
} from '../security/keychain';

// ─── INTERNAL MMKV INSTANCE ──────────────────────────────────────────

const STORE_ID = 'dottie-storage-v1';

/**
 * The legacy, hardcoded key. Kept ONLY so we can open a pre-B2 store once and
 * re-encrypt it to the hardware-backed key. New installs never persist under
 * it (they migrate on first boot before any data is written).
 */
const LEGACY_KEY = 'dottie-mvp-static-key-rotate-before-prod';

/**
 * The MMKV instance. Constructed LAZILY by `initEncryptedStorage()` with the
 * hardware-backed key (see keychain.ts) — NOT at module load, because that
 * key is fetched asynchronously from the secure enclave.
 *
 * Safe because every `Storage.*` read/write happens inside functions called
 * during or after `hydrateAppState()`, and `initEncryptedStorage()` runs
 * before hydration in the root layout's bootstrap. `db()` throws loudly if
 * that ordering is ever violated, so a regression fails fast instead of
 * silently reading with the wrong key.
 */
let mmkv: MMKV | null = null;

/** Access the store, or throw if used before initialization. */
function db(): MMKV {
  if (!mmkv) {
    throw new Error(
      '[Storage] accessed before initEncryptedStorage() — call it first in the app bootstrap.'
    );
  }
  return mmkv;
}

/**
 * One-time async setup: fetch (or create) the hardware-backed key and, on the
 * first run after upgrading from the legacy key, re-encrypt the existing store
 * in place so NO data is lost. Idempotent; safe to call more than once.
 *
 * Never throws — if the secure store is unavailable we fall back to opening
 * with the legacy key so the app still works (no worse than before B2), rather
 * than bricking. The migration flag is NOT set on the fallback path, so the
 * migration is retried on the next boot.
 */
export async function initEncryptedStorage(): Promise<void> {
  if (mmkv) return;
  try {
    const hardwareKey = await getOrCreateMasterKey();
    if (await isStorageMigrated()) {
      // Already re-keyed on a prior boot — open directly with the hardware key.
      mmkv = new MMKV({ id: STORE_ID, encryptionKey: hardwareKey });
    } else {
      // First run under B2: open the legacy store (existing data) and
      // re-encrypt it in place to the hardware key. On a fresh install the
      // legacy store is empty, so this just keys a new empty store.
      const store = new MMKV({ id: STORE_ID, encryptionKey: LEGACY_KEY });
      store.recrypt(hardwareKey);
      mmkv = store;
      await markStorageMigrated();
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[Storage] hardware-key init failed; falling back to legacy key:', err);
    }
    // Never brick: fall back to the legacy key. Migration flag stays unset so
    // we retry next launch.
    if (!mmkv) {
      mmkv = new MMKV({ id: STORE_ID, encryptionKey: LEGACY_KEY });
    }
  }
}

// ─── KEY NAMES (private — accessed only via typed wrappers below) ────

const Keys = {
  // Onboarding & user
  HAS_ONBOARDED: 'onboarding.complete',
  CURRENT_USER_ID: 'user.current_id',
  ONBOARDED_AT: 'onboarding.completed_at',

  // Feature flags
  GHOST_MODE_ACTIVE: 'features.ghost_mode_active',
  ADHD_MODE_ON: 'features.adhd_mode',
  DISCRETE_NOTIFICATIONS: 'features.discrete_notifications',

  // Ghost Mode secrets + auxiliary toggles (chunk 11)
  GHOST_PIN_HASH: 'ghost.pin_hash',
  GHOST_PIN_SALT: 'ghost.pin_salt',
  GHOST_PANIC_HASH: 'ghost.panic_hash',
  GHOST_PANIC_WIPE_ENABLED: 'ghost.panic_wipe_enabled',
  GHOST_DISGUISE_APP_NAME: 'ghost.disguise_app_name',
  GHOST_ROUTE_TO_DECOY_ON_FAILURE: 'ghost.route_to_decoy_on_failure',
  GHOST_DECOY_THEME: 'ghost.decoy_theme',

  // Beta tester pack (chunk 12)
  BETA_PIONEER_AWARDED: 'beta.pioneer_awarded',
  BETA_PIONEER_AWARDED_AT: 'beta.pioneer_awarded_at',

  // App state
  LAST_OPENED_AT: 'app.last_opened_at',
  LAST_DAILY_RESET_DATE: 'app.last_daily_reset_date',
  CONTENT_VERSION: 'app.content_version',
  DB_INITIALIZED_AT: 'app.db_initialized_at',

  // UI preferences
  THEME_OVERRIDE: 'ui.theme_override',
  REDUCED_MOTION: 'ui.reduced_motion',
  HAPTICS_ENABLED: 'ui.haptics_enabled',

  // Companion (denormalized hot copy — source of truth is SQLite)
  COMPANION_TYPE: 'companion.type',

  // Onboarding scratchpad (cleared after onboarding completes)
  ONBOARDING_DRAFT: 'onboarding.draft',

  // Calendar day plans/notes (design-v2 — the planner popover). A JSON map of
  // dateISO → DayPlan. Lives in MMKV (not SQLite) because it's small, local,
  // per-device planning scratch — no schema migration needed for an additive
  // feature (per project conventions).
  DAY_PLANS: 'calendar.day_plans',

  // Learn placement / pace (design-v2 — the path-map). 'new' keeps the guided
  // sequential locks; 'basics'/'deep' unlock the trail for self-directed learners.
  LEARN_LEVEL: 'learn.level',

  // Gentle Rhythm (design-v2 Phase 4). A rolling 30-day list of visited days
  // for the Learn tab. NOT a streak — see src/engine/learn/gentle-rhythm.ts.
  LEARN_RHYTHM: 'learn.rhythm',

  // Over-the-air content bundle (design-v2 — updatable lessons). The last
  // validated ContentBundle downloaded from the network, cached so new lessons
  // survive restarts and work offline. Bundled content is always the baseline;
  // this is merged ON TOP. See docs/CONTENT-UPDATES.md.
  REMOTE_CONTENT_BUNDLE: 'content.remote_bundle',

  // Reminder preferences (design-v2 — the notification scheduler). Which local
  // reminders are on + when. Drives NotificationScheduler; all opt-in, on-device.
  REMINDER_PREFS: 'notifications.reminder_prefs',

  // Medication / birth-control plans (design-v2). A JSON array of MedicationPlan.
  // Local-only; drives daily medication reminders via the scheduler.
  MEDICATIONS: 'meds.plans',

  // One-shot "seen the explainer" flags — surface a gentle first-time popup
  // so a new feature isn't a mystery on the first tap, then never again.
  SISTERHOOD_EXPLAINER_SEEN: 'ux.sisterhood_explainer_seen',

  // First-run walkthrough — the coach-mark tour launched on first Home
  // landing. Seen = true suppresses auto-launch; the Profile "Show me
  // around again" row clears it to replay.
  WALKTHROUGH_SEEN: 'ux.walkthrough_seen',
} as const;

// ─── LOW-LEVEL HELPERS ───────────────────────────────────────────────

/**
 * Get a JSON value, returning null on missing or parse error.
 * Wrapped here so callers never deal with JSON.parse exceptions.
 */
function getJson<T>(key: string): T | null {
  const raw = db().getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted value — clean it up so it doesn't keep failing
    db().delete(key);
    return null;
  }
}

function setJson<T>(key: string, value: T): void {
  db().set(key, JSON.stringify(value));
}

// ─── TYPED ACCESSORS ─────────────────────────────────────────────────

/**
 * The public Storage API. Each accessor exposes get/set/clear so
 * callers can be explicit about intent without juggling raw key strings.
 *
 * Synchronous everywhere — these are designed to be safe at render time.
 */
export const Storage = {
  // ─── Onboarding ─────────────────────────────────────────────────

  hasOnboarded: {
    get: (): boolean => db().getBoolean(Keys.HAS_ONBOARDED) ?? false,
    set: (value: boolean): void => db().set(Keys.HAS_ONBOARDED, value),
    clear: (): void => db().delete(Keys.HAS_ONBOARDED),
  },

  onboardedAt: {
    get: (): string | null => db().getString(Keys.ONBOARDED_AT) ?? null,
    set: (iso: string): void => db().set(Keys.ONBOARDED_AT, iso),
    clear: (): void => db().delete(Keys.ONBOARDED_AT),
  },

  /**
   * The onboarding draft is a partial profile being built across the
   * onboarding screens. Cleared on completion or restart. Lives here
   * (not SQLite) so onboarding works before the user row exists.
   */
  onboardingDraft: {
    get: <T = OnboardingDraft>(): T | null => getJson<T>(Keys.ONBOARDING_DRAFT),
    set: <T = OnboardingDraft>(value: T): void => setJson(Keys.ONBOARDING_DRAFT, value),
    merge: <T = OnboardingDraft>(patch: Partial<T>): T => {
      const current = (getJson<T>(Keys.ONBOARDING_DRAFT) ?? {}) as T;
      const next = { ...current, ...patch };
      setJson(Keys.ONBOARDING_DRAFT, next);
      return next;
    },
    clear: (): void => db().delete(Keys.ONBOARDING_DRAFT),
  },

  // ─── Current user ───────────────────────────────────────────────

  currentUserId: {
    get: (): string | null => db().getString(Keys.CURRENT_USER_ID) ?? null,
    set: (id: string): void => db().set(Keys.CURRENT_USER_ID, id),
    clear: (): void => db().delete(Keys.CURRENT_USER_ID),
  },

  // ─── Feature flags ──────────────────────────────────────────────

  ghostModeActive: {
    get: (): boolean => db().getBoolean(Keys.GHOST_MODE_ACTIVE) ?? false,
    set: (value: boolean): void => db().set(Keys.GHOST_MODE_ACTIVE, value),
    clear: (): void => db().delete(Keys.GHOST_MODE_ACTIVE),
  },

  adhdModeOn: {
    get: (): boolean => db().getBoolean(Keys.ADHD_MODE_ON) ?? false,
    set: (value: boolean): void => db().set(Keys.ADHD_MODE_ON, value),
    clear: (): void => db().delete(Keys.ADHD_MODE_ON),
  },

  discreteNotifications: {
    get: (): boolean => db().getBoolean(Keys.DISCRETE_NOTIFICATIONS) ?? true,
    set: (value: boolean): void => db().set(Keys.DISCRETE_NOTIFICATIONS, value),
    clear: (): void => db().delete(Keys.DISCRETE_NOTIFICATIONS),
  },

  // ─── Ghost Mode secrets (chunk 11) ──────────────────────────────
  //
  // These accessors are deliberately shaped like the others — get/set/
  // clear — so the security store treats them exactly the same way as
  // the rest. Each is encrypted at rest by MMKV's bucket encryption.
  //
  // We expose `undefined` (not null) from get() for the boolean toggle
  // keys so the security store can distinguish "never been set" from
  // "explicitly set to false" — important for first-time defaults.

  ghostPinHash: {
    get: (): string | null => db().getString(Keys.GHOST_PIN_HASH) ?? null,
    set: (value: string): void => db().set(Keys.GHOST_PIN_HASH, value),
    clear: (): void => db().delete(Keys.GHOST_PIN_HASH),
  },

  ghostPinSalt: {
    get: (): string | null => db().getString(Keys.GHOST_PIN_SALT) ?? null,
    set: (value: string): void => db().set(Keys.GHOST_PIN_SALT, value),
    clear: (): void => db().delete(Keys.GHOST_PIN_SALT),
  },

  ghostPanicHash: {
    get: (): string | null => db().getString(Keys.GHOST_PANIC_HASH) ?? null,
    set: (value: string): void => db().set(Keys.GHOST_PANIC_HASH, value),
    clear: (): void => db().delete(Keys.GHOST_PANIC_HASH),
  },

  ghostPanicWipeEnabled: {
    get: (): boolean | undefined => db().getBoolean(Keys.GHOST_PANIC_WIPE_ENABLED),
    set: (value: boolean): void => db().set(Keys.GHOST_PANIC_WIPE_ENABLED, value),
    clear: (): void => db().delete(Keys.GHOST_PANIC_WIPE_ENABLED),
  },

  ghostDisguiseAppName: {
    get: (): boolean | undefined => db().getBoolean(Keys.GHOST_DISGUISE_APP_NAME),
    set: (value: boolean): void => db().set(Keys.GHOST_DISGUISE_APP_NAME, value),
    clear: (): void => db().delete(Keys.GHOST_DISGUISE_APP_NAME),
  },

  ghostRouteToDecoyOnFailure: {
    get: (): boolean | undefined => db().getBoolean(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE),
    set: (value: boolean): void => db().set(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE, value),
    clear: (): void => db().delete(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE),
  },

  // Which look the "Garden Notes" decoy wears: 'aurora' (dark glass, the
  // default that matches the rest of the app) or 'cream' (the classic warm
  // plant-journal palette). Stored as a plain string; the store coerces it
  // to the DecoyTheme union and defaults to 'aurora' when unset. Owner asked
  // for a user-facing toggle so THEY choose the disguise's appearance.
  ghostDecoyTheme: {
    get: (): string | undefined => db().getString(Keys.GHOST_DECOY_THEME),
    set: (value: string): void => db().set(Keys.GHOST_DECOY_THEME, value),
    clear: (): void => db().delete(Keys.GHOST_DECOY_THEME),
  },

  // ─── Beta tester pack (chunk 12) ────────────────────────────────
  //
  // Tracks whether we've already awarded the Beta Pioneer badge +
  // shown its celebration. The gamification store's unlockBadge call
  // is idempotent at the badge layer, but the user-facing celebration
  // (XP popup, gems splash, companion toast) must only fire ONCE per
  // install — these flags gate that side effect.
  //
  // Cleared by Storage.clearAll() so a deleted account / panic wipe
  // forgets the pioneer status and would re-award if the user comes
  // back in a future beta build (which is correct — fresh start).

  betaPioneerAwarded: {
    get: (): boolean => db().getBoolean(Keys.BETA_PIONEER_AWARDED) ?? false,
    set: (value: boolean): void => db().set(Keys.BETA_PIONEER_AWARDED, value),
    clear: (): void => db().delete(Keys.BETA_PIONEER_AWARDED),
  },

  betaPioneerAwardedAt: {
    get: (): string | null => db().getString(Keys.BETA_PIONEER_AWARDED_AT) ?? null,
    set: (iso: string): void => db().set(Keys.BETA_PIONEER_AWARDED_AT, iso),
    clear: (): void => db().delete(Keys.BETA_PIONEER_AWARDED_AT),
  },

  // ─── App state ──────────────────────────────────────────────────

  lastOpenedAt: {
    get: (): string | null => db().getString(Keys.LAST_OPENED_AT) ?? null,
    set: (iso: string): void => db().set(Keys.LAST_OPENED_AT, iso),
    clear: (): void => db().delete(Keys.LAST_OPENED_AT),
  },

  /**
   * Tracks the last date we ran the "new day" reset (clears question
   * answered set, evicts old caches, etc.). Compared against today
   * on each cold start.
   */
  lastDailyResetDate: {
    get: (): string | null => db().getString(Keys.LAST_DAILY_RESET_DATE) ?? null,
    set: (date: string): void => db().set(Keys.LAST_DAILY_RESET_DATE, date),
    clear: (): void => db().delete(Keys.LAST_DAILY_RESET_DATE),
  },

  contentVersion: {
    get: (): number => db().getNumber(Keys.CONTENT_VERSION) ?? 1,
    set: (version: number): void => db().set(Keys.CONTENT_VERSION, version),
    clear: (): void => db().delete(Keys.CONTENT_VERSION),
  },

  dbInitializedAt: {
    get: (): string | null => db().getString(Keys.DB_INITIALIZED_AT) ?? null,
    set: (iso: string): void => db().set(Keys.DB_INITIALIZED_AT, iso),
    clear: (): void => db().delete(Keys.DB_INITIALIZED_AT),
  },

  // ─── UI preferences ─────────────────────────────────────────────

  themeOverride: {
    get: (): ThemeOverride | null =>
      (db().getString(Keys.THEME_OVERRIDE) as ThemeOverride | undefined) ?? null,
    set: (theme: ThemeOverride): void => db().set(Keys.THEME_OVERRIDE, theme),
    clear: (): void => db().delete(Keys.THEME_OVERRIDE),
  },

  reducedMotion: {
    get: (): boolean => db().getBoolean(Keys.REDUCED_MOTION) ?? false,
    set: (value: boolean): void => db().set(Keys.REDUCED_MOTION, value),
    clear: (): void => db().delete(Keys.REDUCED_MOTION),
  },

  hapticsEnabled: {
    get: (): boolean => db().getBoolean(Keys.HAPTICS_ENABLED) ?? true,
    set: (value: boolean): void => db().set(Keys.HAPTICS_ENABLED, value),
    clear: (): void => db().delete(Keys.HAPTICS_ENABLED),
  },

  // ─── Companion (hot copy for instant render) ────────────────────

  /**
   * Companion type is duplicated here so the splash → home transition
   * doesn't need to await a SQLite read to know which mascot to show.
   * SQLite remains the source of truth; this is a read-optimized mirror.
   */
  companionType: {
    get: (): CompanionType | null =>
      (db().getString(Keys.COMPANION_TYPE) as CompanionType | undefined) ?? null,
    set: (type: CompanionType): void => db().set(Keys.COMPANION_TYPE, type),
    clear: (): void => db().delete(Keys.COMPANION_TYPE),
  },

  // ─── Calendar day plans / notes (design-v2 planner) ─────────────
  //
  // A per-day planning scratchpad backing the calendar popover: an optional
  // note and a "planned" flag (which drives the little dot on the month grid).
  // Stored as one JSON map so a month's worth of reads is a single MMKV hit.
  // A day with neither a note nor planned=true is removed, so `hasPlan` stays
  // honest and the map doesn't accumulate empty entries.

  dayPlans: {
    getAll: (): Record<string, DayPlan> => getJson<Record<string, DayPlan>>(Keys.DAY_PLANS) ?? {},
    get: (dateISO: string): DayPlan | null => {
      const all = getJson<Record<string, DayPlan>>(Keys.DAY_PLANS) ?? {};
      return all[dateISO] ?? null;
    },
    set: (dateISO: string, plan: DayPlan): void => {
      const all = getJson<Record<string, DayPlan>>(Keys.DAY_PLANS) ?? {};
      const empty = !plan.note?.trim() && !plan.planned;
      if (empty) {
        delete all[dateISO];
      } else {
        all[dateISO] = { ...plan, updatedAt: new Date().toISOString() };
      }
      setJson(Keys.DAY_PLANS, all);
    },
    remove: (dateISO: string): void => {
      const all = getJson<Record<string, DayPlan>>(Keys.DAY_PLANS) ?? {};
      delete all[dateISO];
      setJson(Keys.DAY_PLANS, all);
    },
    clear: (): void => db().delete(Keys.DAY_PLANS),
  },

  // ─── Learn placement / pace (design-v2 path-map) ────────────────
  //
  // The user's chosen learning pace. 'new' = guided (sequential locks stay on);
  // 'basics'/'deep' = self-directed (the trail unlocks). null until they pick —
  // the UI treats null as guided by default (safest for a first-timer).

  learnLevel: {
    get: (): LearnLevel => {
      const raw = db().getString(Keys.LEARN_LEVEL);
      // Migrate the legacy 3-way values in place: 'new' meant guided, while
      // 'basics'/'deep' both meant "let me explore freely" → 'phase'.
      if (raw === 'phase' || raw === 'basics' || raw === 'deep') return 'phase';
      return 'guided';
    },
    set: (level: LearnLevel): void => db().set(Keys.LEARN_LEVEL, level),
    clear: (): void => db().delete(Keys.LEARN_LEVEL),
  },

  // ─── Gentle Rhythm state (design-v2 Phase 4 — Learn cadence) ────
  //
  // A rolling window of dates the user visited the Learn tab. Stored as
  // { visitedDays: string[] } (YYYY-MM-DD, sorted, deduped, pruned to the
  // last RHYTHM_WINDOW_DAYS by the engine). Deliberately NOT a streak —
  // rest days count, absence is silent, no negative language. See
  // src/engine/learn/gentle-rhythm.ts.

  learnRhythm: {
    get: (): { visitedDays: string[] } =>
      getJson<{ visitedDays: string[] }>(Keys.LEARN_RHYTHM) ?? { visitedDays: [] },
    set: (state: { visitedDays: string[] }): void => setJson(Keys.LEARN_RHYTHM, state),
    clear: (): void => db().delete(Keys.LEARN_RHYTHM),
  },

  // ─── OTA content bundle (design-v2 — updatable lessons) ─────────
  //
  // The last validated content bundle pulled from the network (paths, lessons,
  // quizzes, exercises). Stored as JSON; typed via <T> so this module doesn't
  // depend on the content types (kept in src/content/remote). Merged ON TOP of
  // the always-present bundled content — the app is fully usable offline with
  // zero network. See docs/CONTENT-UPDATES.md.

  remoteContentBundle: {
    get: <T>(): T | null => getJson<T>(Keys.REMOTE_CONTENT_BUNDLE),
    set: <T>(bundle: T): void => setJson(Keys.REMOTE_CONTENT_BUNDLE, bundle),
    clear: (): void => db().delete(Keys.REMOTE_CONTENT_BUNDLE),
  },

  // ─── Reminder preferences (design-v2 notification scheduler) ────
  //
  // All local, all opt-in. Defaults to everything OFF so we never schedule a
  // notification the user didn't ask for (and never prompt for permission
  // unprompted). The Reminders settings screen reads/writes this.

  reminderPrefs: {
    get: (): ReminderPrefs => ({ ...DEFAULT_REMINDER_PREFS, ...(getJson<Partial<ReminderPrefs>>(Keys.REMINDER_PREFS) ?? {}) }),
    set: (prefs: ReminderPrefs): void => setJson(Keys.REMINDER_PREFS, prefs),
    clear: (): void => db().delete(Keys.REMINDER_PREFS),
  },

  // ─── Medication / birth-control plans (design-v2) ───────────────
  //
  // A local list of things the user wants a daily reminder for (the pill, a
  // ring change, etc). All on-device; scheduled via the notification scheduler.

  medications: {
    get: (): MedicationPlan[] => getJson<MedicationPlan[]>(Keys.MEDICATIONS) ?? [],
    set: (plans: MedicationPlan[]): void => setJson(Keys.MEDICATIONS, plans),
    clear: (): void => db().delete(Keys.MEDICATIONS),
  },

  sisterhoodExplainerSeen: {
    get: (): boolean => db().getBoolean(Keys.SISTERHOOD_EXPLAINER_SEEN) === true,
    set: (): void => db().set(Keys.SISTERHOOD_EXPLAINER_SEEN, true),
    clear: (): void => db().delete(Keys.SISTERHOOD_EXPLAINER_SEEN),
  },

  walkthroughSeen: {
    get: (): boolean => db().getBoolean(Keys.WALKTHROUGH_SEEN) === true,
    set: (): void => db().set(Keys.WALKTHROUGH_SEEN, true),
    clear: (): void => db().delete(Keys.WALKTHROUGH_SEEN),
  },

  // ─── Bulk operations ────────────────────────────────────────────

  /**
   * Clear EVERYTHING. Used by the "Delete all my data" privacy action
   * and by tests. Combine with deleteDatabase() in client.ts for a
   * truly fresh state.
   *
   * Also used by Ghost Mode's panic wipe (chunk 11) — wiping MMKV
   * clears the `currentUserId` pointer, so the next hydration treats
   * the user as fresh and routes to onboarding.
   */
  clearAll: (): void => db().clearAll(),

  /**
   * Clear only onboarding state. Used to send the user back through
   * onboarding without nuking their cycle data (admin/debug action).
   */
  clearOnboarding: (): void => {
    db().delete(Keys.HAS_ONBOARDED);
    db().delete(Keys.ONBOARDED_AT);
    db().delete(Keys.ONBOARDING_DRAFT);
  },

  /**
   * Get a snapshot of all keys for debugging. Don't expose to users.
   */
  debugSnapshot: (): Record<string, unknown> => {
    const snapshot: Record<string, unknown> = {};
    for (const [, key] of Object.entries(Keys)) {
      // Try each value type until one returns a non-null result
      const str = db().getString(key);
      if (str !== undefined) {
        snapshot[key] = str;
        continue;
      }
      const num = db().getNumber(key);
      if (num !== undefined) {
        snapshot[key] = num;
        continue;
      }
      const bool = db().getBoolean(key);
      if (bool !== undefined) {
        snapshot[key] = bool;
      }
    }
    return snapshot;
  },
};

// ─── TYPES ──────────────────────────────────────────────────────────

export type ThemeOverride = 'light' | 'dark' | 'auto';

/** The user's chosen Learn pace (see Storage.learnLevel). 'new' = guided. */
/**
 * Learn pacing. Reduced from the old three-way New/Basics/Deep chooser to the
 * two modes the owner actually wants (device-test-6):
 *   'guided' — start from the very beginning, unlocked step by step.
 *   'phase'  — jump straight to what's relevant to the user's current cycle
 *              phase and health conditions; nothing is locked.
 */
export type LearnLevel = 'guided' | 'phase';

/** Preset times of day for the daily check-in reminder. */
export type ReminderTime = 'morning' | 'midday' | 'evening';

/** Local reminder preferences (see Storage.reminderPrefs). All opt-in. */
export interface ReminderPrefs {
  /** Daily nudge to check in. */
  checkIn: boolean;
  /** When the daily check-in reminder fires. */
  checkInTime: ReminderTime;
  /** A gentle heads-up a few days before the predicted period. */
  periodHeadsUp: boolean;
  /** A midday "sip some water" nudge. */
  hydration: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  checkIn: false,
  checkInTime: 'evening',
  periodHeadsUp: false,
  hydration: false,
};

/** Kinds of medication / birth control a plan can be for. */
export type MedicationKind = 'pill' | 'ring' | 'patch' | 'injection' | 'iud' | 'implant' | 'other';

/** A single medication/BC daily reminder plan (see Storage.medications). */
export interface MedicationPlan {
  id: string;
  /** User-facing name, e.g. "The pill" or a brand. */
  name: string;
  kind: MedicationKind;
  /** Preset time of day the daily reminder fires. */
  time: ReminderTime;
  /** Whether this reminder is currently on. */
  active: boolean;
}

/** A per-day planning entry backing the calendar popover (see Storage.dayPlans). */
export interface DayPlan {
  /** Free-text note the user jotted for the day. */
  note?: string;
  /** User flagged the day as planned → shows a dot on the month grid. */
  planned?: boolean;
  /** ISO timestamp of the last edit (set by Storage.dayPlans.set). */
  updatedAt?: string;
}

export type CompanionType = 'fox' | 'bunny' | 'butterfly' | 'cat' | 'owl' | 'blossom';

/**
 * Shape of the onboarding draft that's built up across screens.
 * Every field is optional because the user fills them in gradually.
 */
export interface OnboardingDraft {
  mode?: 'teen' | 'adult' | 'endocrine';
  companionType?: CompanionType;
  age?: number;
  lastPeriodStart?: string; // ISO YYYY-MM-DD
  averageCycleLength?: number;
  averagePeriodLength?: number;
  healthConditions?: string[];
  /**
   * Optional reminder preferences the user opted into during onboarding.
   * When present, `completeOnboarding` persists them AND runs the scheduler
   * so notifications start firing without needing a trip to settings.
   * When absent, reminders stay off (the default) — the user can always
   * enable them later from Profile → Reminders.
   */
  reminderPrefs?: {
    checkIn: boolean;
    checkInTime: 'morning' | 'midday' | 'evening';
    periodHeadsUp: boolean;
    hydration: boolean;
  };
  startedAt?: string; // ISO timestamp
}
