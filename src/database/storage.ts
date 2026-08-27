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

// ─── INTERNAL MMKV INSTANCE ──────────────────────────────────────────

/**
 * The actual MMKV instance. Single instance for the whole app —
 * MMKV is thread-safe and there's no benefit to splitting into
 * multiple namespaces at this scale.
 *
 * The encryption key is a placeholder; rotate when we wire up
 * proper key derivation (see file header note).
 */
const mmkv = new MMKV({
  id: 'dottie-storage-v1',
  encryptionKey: 'dottie-mvp-static-key-rotate-before-prod',
});

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
} as const;

// ─── LOW-LEVEL HELPERS ───────────────────────────────────────────────

/**
 * Get a JSON value, returning null on missing or parse error.
 * Wrapped here so callers never deal with JSON.parse exceptions.
 */
function getJson<T>(key: string): T | null {
  const raw = mmkv.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted value — clean it up so it doesn't keep failing
    mmkv.delete(key);
    return null;
  }
}

function setJson<T>(key: string, value: T): void {
  mmkv.set(key, JSON.stringify(value));
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
    get: (): boolean => mmkv.getBoolean(Keys.HAS_ONBOARDED) ?? false,
    set: (value: boolean): void => mmkv.set(Keys.HAS_ONBOARDED, value),
    clear: (): void => mmkv.delete(Keys.HAS_ONBOARDED),
  },

  onboardedAt: {
    get: (): string | null => mmkv.getString(Keys.ONBOARDED_AT) ?? null,
    set: (iso: string): void => mmkv.set(Keys.ONBOARDED_AT, iso),
    clear: (): void => mmkv.delete(Keys.ONBOARDED_AT),
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
    clear: (): void => mmkv.delete(Keys.ONBOARDING_DRAFT),
  },

  // ─── Current user ───────────────────────────────────────────────

  currentUserId: {
    get: (): string | null => mmkv.getString(Keys.CURRENT_USER_ID) ?? null,
    set: (id: string): void => mmkv.set(Keys.CURRENT_USER_ID, id),
    clear: (): void => mmkv.delete(Keys.CURRENT_USER_ID),
  },

  // ─── Feature flags ──────────────────────────────────────────────

  ghostModeActive: {
    get: (): boolean => mmkv.getBoolean(Keys.GHOST_MODE_ACTIVE) ?? false,
    set: (value: boolean): void => mmkv.set(Keys.GHOST_MODE_ACTIVE, value),
    clear: (): void => mmkv.delete(Keys.GHOST_MODE_ACTIVE),
  },

  adhdModeOn: {
    get: (): boolean => mmkv.getBoolean(Keys.ADHD_MODE_ON) ?? false,
    set: (value: boolean): void => mmkv.set(Keys.ADHD_MODE_ON, value),
    clear: (): void => mmkv.delete(Keys.ADHD_MODE_ON),
  },

  discreteNotifications: {
    get: (): boolean => mmkv.getBoolean(Keys.DISCRETE_NOTIFICATIONS) ?? true,
    set: (value: boolean): void => mmkv.set(Keys.DISCRETE_NOTIFICATIONS, value),
    clear: (): void => mmkv.delete(Keys.DISCRETE_NOTIFICATIONS),
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
    get: (): string | null => mmkv.getString(Keys.GHOST_PIN_HASH) ?? null,
    set: (value: string): void => mmkv.set(Keys.GHOST_PIN_HASH, value),
    clear: (): void => mmkv.delete(Keys.GHOST_PIN_HASH),
  },

  ghostPinSalt: {
    get: (): string | null => mmkv.getString(Keys.GHOST_PIN_SALT) ?? null,
    set: (value: string): void => mmkv.set(Keys.GHOST_PIN_SALT, value),
    clear: (): void => mmkv.delete(Keys.GHOST_PIN_SALT),
  },

  ghostPanicHash: {
    get: (): string | null => mmkv.getString(Keys.GHOST_PANIC_HASH) ?? null,
    set: (value: string): void => mmkv.set(Keys.GHOST_PANIC_HASH, value),
    clear: (): void => mmkv.delete(Keys.GHOST_PANIC_HASH),
  },

  ghostPanicWipeEnabled: {
    get: (): boolean | undefined => mmkv.getBoolean(Keys.GHOST_PANIC_WIPE_ENABLED),
    set: (value: boolean): void => mmkv.set(Keys.GHOST_PANIC_WIPE_ENABLED, value),
    clear: (): void => mmkv.delete(Keys.GHOST_PANIC_WIPE_ENABLED),
  },

  ghostDisguiseAppName: {
    get: (): boolean | undefined => mmkv.getBoolean(Keys.GHOST_DISGUISE_APP_NAME),
    set: (value: boolean): void => mmkv.set(Keys.GHOST_DISGUISE_APP_NAME, value),
    clear: (): void => mmkv.delete(Keys.GHOST_DISGUISE_APP_NAME),
  },

  ghostRouteToDecoyOnFailure: {
    get: (): boolean | undefined => mmkv.getBoolean(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE),
    set: (value: boolean): void => mmkv.set(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE, value),
    clear: (): void => mmkv.delete(Keys.GHOST_ROUTE_TO_DECOY_ON_FAILURE),
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
    get: (): boolean => mmkv.getBoolean(Keys.BETA_PIONEER_AWARDED) ?? false,
    set: (value: boolean): void => mmkv.set(Keys.BETA_PIONEER_AWARDED, value),
    clear: (): void => mmkv.delete(Keys.BETA_PIONEER_AWARDED),
  },

  betaPioneerAwardedAt: {
    get: (): string | null => mmkv.getString(Keys.BETA_PIONEER_AWARDED_AT) ?? null,
    set: (iso: string): void => mmkv.set(Keys.BETA_PIONEER_AWARDED_AT, iso),
    clear: (): void => mmkv.delete(Keys.BETA_PIONEER_AWARDED_AT),
  },

  // ─── App state ──────────────────────────────────────────────────

  lastOpenedAt: {
    get: (): string | null => mmkv.getString(Keys.LAST_OPENED_AT) ?? null,
    set: (iso: string): void => mmkv.set(Keys.LAST_OPENED_AT, iso),
    clear: (): void => mmkv.delete(Keys.LAST_OPENED_AT),
  },

  /**
   * Tracks the last date we ran the "new day" reset (clears question
   * answered set, evicts old caches, etc.). Compared against today
   * on each cold start.
   */
  lastDailyResetDate: {
    get: (): string | null => mmkv.getString(Keys.LAST_DAILY_RESET_DATE) ?? null,
    set: (date: string): void => mmkv.set(Keys.LAST_DAILY_RESET_DATE, date),
    clear: (): void => mmkv.delete(Keys.LAST_DAILY_RESET_DATE),
  },

  contentVersion: {
    get: (): number => mmkv.getNumber(Keys.CONTENT_VERSION) ?? 1,
    set: (version: number): void => mmkv.set(Keys.CONTENT_VERSION, version),
    clear: (): void => mmkv.delete(Keys.CONTENT_VERSION),
  },

  dbInitializedAt: {
    get: (): string | null => mmkv.getString(Keys.DB_INITIALIZED_AT) ?? null,
    set: (iso: string): void => mmkv.set(Keys.DB_INITIALIZED_AT, iso),
    clear: (): void => mmkv.delete(Keys.DB_INITIALIZED_AT),
  },

  // ─── UI preferences ─────────────────────────────────────────────

  themeOverride: {
    get: (): ThemeOverride | null =>
      (mmkv.getString(Keys.THEME_OVERRIDE) as ThemeOverride | undefined) ?? null,
    set: (theme: ThemeOverride): void => mmkv.set(Keys.THEME_OVERRIDE, theme),
    clear: (): void => mmkv.delete(Keys.THEME_OVERRIDE),
  },

  reducedMotion: {
    get: (): boolean => mmkv.getBoolean(Keys.REDUCED_MOTION) ?? false,
    set: (value: boolean): void => mmkv.set(Keys.REDUCED_MOTION, value),
    clear: (): void => mmkv.delete(Keys.REDUCED_MOTION),
  },

  hapticsEnabled: {
    get: (): boolean => mmkv.getBoolean(Keys.HAPTICS_ENABLED) ?? true,
    set: (value: boolean): void => mmkv.set(Keys.HAPTICS_ENABLED, value),
    clear: (): void => mmkv.delete(Keys.HAPTICS_ENABLED),
  },

  // ─── Companion (hot copy for instant render) ────────────────────

  /**
   * Companion type is duplicated here so the splash → home transition
   * doesn't need to await a SQLite read to know which mascot to show.
   * SQLite remains the source of truth; this is a read-optimized mirror.
   */
  companionType: {
    get: (): CompanionType | null =>
      (mmkv.getString(Keys.COMPANION_TYPE) as CompanionType | undefined) ?? null,
    set: (type: CompanionType): void => mmkv.set(Keys.COMPANION_TYPE, type),
    clear: (): void => mmkv.delete(Keys.COMPANION_TYPE),
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
    clear: (): void => mmkv.delete(Keys.DAY_PLANS),
  },

  // ─── Learn placement / pace (design-v2 path-map) ────────────────
  //
  // The user's chosen learning pace. 'new' = guided (sequential locks stay on);
  // 'basics'/'deep' = self-directed (the trail unlocks). null until they pick —
  // the UI treats null as guided by default (safest for a first-timer).

  learnLevel: {
    get: (): LearnLevel | null =>
      (mmkv.getString(Keys.LEARN_LEVEL) as LearnLevel | undefined) ?? null,
    set: (level: LearnLevel): void => mmkv.set(Keys.LEARN_LEVEL, level),
    clear: (): void => mmkv.delete(Keys.LEARN_LEVEL),
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
    clear: (): void => mmkv.delete(Keys.REMOTE_CONTENT_BUNDLE),
  },

  // ─── Reminder preferences (design-v2 notification scheduler) ────
  //
  // All local, all opt-in. Defaults to everything OFF so we never schedule a
  // notification the user didn't ask for (and never prompt for permission
  // unprompted). The Reminders settings screen reads/writes this.

  reminderPrefs: {
    get: (): ReminderPrefs => ({ ...DEFAULT_REMINDER_PREFS, ...(getJson<Partial<ReminderPrefs>>(Keys.REMINDER_PREFS) ?? {}) }),
    set: (prefs: ReminderPrefs): void => setJson(Keys.REMINDER_PREFS, prefs),
    clear: (): void => mmkv.delete(Keys.REMINDER_PREFS),
  },

  // ─── Medication / birth-control plans (design-v2) ───────────────
  //
  // A local list of things the user wants a daily reminder for (the pill, a
  // ring change, etc). All on-device; scheduled via the notification scheduler.

  medications: {
    get: (): MedicationPlan[] => getJson<MedicationPlan[]>(Keys.MEDICATIONS) ?? [],
    set: (plans: MedicationPlan[]): void => setJson(Keys.MEDICATIONS, plans),
    clear: (): void => mmkv.delete(Keys.MEDICATIONS),
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
  clearAll: (): void => mmkv.clearAll(),

  /**
   * Clear only onboarding state. Used to send the user back through
   * onboarding without nuking their cycle data (admin/debug action).
   */
  clearOnboarding: (): void => {
    mmkv.delete(Keys.HAS_ONBOARDED);
    mmkv.delete(Keys.ONBOARDED_AT);
    mmkv.delete(Keys.ONBOARDING_DRAFT);
  },

  /**
   * Get a snapshot of all keys for debugging. Don't expose to users.
   */
  debugSnapshot: (): Record<string, unknown> => {
    const snapshot: Record<string, unknown> = {};
    for (const [, key] of Object.entries(Keys)) {
      // Try each value type until one returns a non-null result
      const str = mmkv.getString(key);
      if (str !== undefined) {
        snapshot[key] = str;
        continue;
      }
      const num = mmkv.getNumber(key);
      if (num !== undefined) {
        snapshot[key] = num;
        continue;
      }
      const bool = mmkv.getBoolean(key);
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
export type LearnLevel = 'new' | 'basics' | 'deep';

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
  startedAt?: string; // ISO timestamp
}
