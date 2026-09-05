/**
 * Dottie — App State Hydration
 *
 * The one-shot bootstrap that runs on cold start. Called from
 * `app/_layout.tsx` BEFORE the first screen renders.
 *
 * ─── WHAT IT DOES ───────────────────────────────────────────────────
 *
 *  1. Open the SQLite database + run migrations
 *  2. Read MMKV flags (onboarded? current user ID?)
 *  3. If onboarded: load the user, cycle data, gamification state
 *  4. If new day detected: clear question caches, reset daily flags,
 *     and invalidate Phase Weather + Dottie Predicts so a fresh
 *     snapshot/deck is generated for the new day
 *  5. Initialize engines with shared providers (including bundled
 *     lesson + quiz content providers — chunk 6)
 *  6. Populate all stores (incl. Phase Weather — chunk 10 B2,
 *     and Dottie Predicts — chunk 10 B3)
 *  7. Warm the community store's hug/report sets (chunk 7) so the
 *     first community tab open doesn't flicker
 *
 *  After this returns, every store has its initial state ready and
 *  the home screen can render without awaiting anything.
 *
 * ─── PERFORMANCE BUDGET ─────────────────────────────────────────────
 *
 *  Target: <500ms cold start, <100ms warm start
 *
 *  Cold path:
 *    - SQLite open + migrate:     ~80ms
 *    - User + companion read:     ~10ms
 *    - Cycle history (12 records):~15ms
 *    - Gamification state:        ~10ms
 *    - Recent symptoms (7d):      ~15ms
 *    - Lesson progress:           ~20ms
 *    - Quiz attempts:             ~20ms
 *    - Community interactions:    ~10ms (chunk 7)
 *    - Phase Weather snapshot:    <2ms  (pure local aggregation)
 *    - Dottie Predicts deck:      ~30ms (parallel repo reads + engine)
 *    - Store population (sync):   <5ms
 *    - Total:                     ~217ms (well under budget)
 *
 *  The Predicts deck is fired-and-forgotten — we don't await it so
 *  it never gates first paint. The home card shows a friendly loading
 *  state until the deck arrives a few frames later.
 *
 *  Warm path: most reads hit OS file cache, much faster.
 *
 * ─── DAILY ROLLOVER ─────────────────────────────────────────────────
 *
 *  If `lastDailyResetDate` in MMKV is older than today, we:
 *    - Clear the question engine's answered set
 *    - Reset cramp_freeze_used_today flag
 *    - Evict expired Daily Decode cache entries
 *    - Invalidate Phase Weather (so the new day brings new weather)
 *    - Invalidate Dottie Predicts (so insights re-rank for today)
 *    - Update `lastDailyResetDate` to today
 *
 *  This means cross-midnight users get a clean slate without an app
 *  restart needed.
 */

import { getDatabase } from '../database/client';
import { runMigrations } from '../database/migrations';
import { Storage } from '../database/storage';
import { userRepository } from '../database/repositories/user.repo';
import { cycleRepository } from '../database/repositories/cycle.repo';
import { checkinRepository } from '../database/repositories/checkin.repo';
import { gamificationRepository } from '../database/repositories/gamification.repo';
import { contentRepository } from '../database/repositories/content.repo';
import { betaFeedbackRepository } from '../database/repositories/beta-feedback.repo';
import { IS_BETA_BUILD } from '../constants/build-info';
import { todayISO } from '../utils/date.utils';
import {
  ContentResolver,
  InMemoryCohortProvider,
  DailyDecodeEngine,
  QuestionEngine,
  LessonEngine,
  QuizEngine,
  buildBundledLessonProvider,
  buildBundledQuizProvider,
} from '../engine/content';
import { buildMergedLessonProvider, buildMergedQuizProvider } from '../content/remote/merged-providers';
import { useUserStore } from './useUserStore';
import { explanationFingerprint, useCycleStore } from './useCycleStore';
import { useGamificationStore } from './useGamificationStore';
import { useContentStore } from './useContentStore';
import { useCommunityStore } from './useCommunityStore';
import { usePhaseWeatherStore } from './usePhaseWeatherStore';
import { usePredictsStore } from './usePredictsStore';
import { logSilentFailure } from '../diagnostics/silent-failure';
import type { PredictionExplanation } from '../engine/prediction/explain-prediction';

// ─── PUBLIC API ──────────────────────────────────────────────────────

export interface HydrationResult {
  /** True if a user exists and was loaded successfully */
  hasUser: boolean;
  /** True if the migration runner did any work */
  migrationApplied: boolean;
  /** True if cross-midnight rollover happened during this hydration */
  dailyRolloverHappened: boolean;
  /** Total hydration time in milliseconds */
  durationMs: number;
  /** Error message if hydration failed partially (still continues) */
  error: string | null;
}

let hydrated = false;
let hydrationPromise: Promise<HydrationResult> | null = null;

/**
 * Check whether app state has been hydrated. Useful for splash screens
 * that want to gate rendering on a known initialized state.
 */
export function isAppHydrated(): boolean {
  return hydrated;
}

/**
 * Bootstrap the app. Safe to call multiple times — subsequent calls
 * return the same promise. Idempotent.
 */
export async function hydrateAppState(): Promise<HydrationResult> {
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = doHydrate()
    .then(result => {
      hydrated = true;
      return result;
    })
    .catch(err => {
      // Reset so a retry can happen on next call
      hydrationPromise = null;
      throw err;
    });

  return hydrationPromise;
}

// ─── INTERNAL: THE ACTUAL HYDRATION ──────────────────────────────────

async function doHydrate(): Promise<HydrationResult> {
  const start = Date.now();
  let error: string | null = null;

  // ─── 1. Database open + migrations ──────────────────────────────
  const db = await getDatabase();
  const migrationResult = await runMigrations(db);

  // Mark DB initialized if first time
  if (!Storage.dbInitializedAt.get()) {
    Storage.dbInitializedAt.set(new Date().toISOString());
  }
  Storage.lastOpenedAt.set(new Date().toISOString());

  // ─── 2. Build the shared content engine layer ───────────────────
  //
  // The InMemoryCohortProvider is empty for MVP — content authoring
  // will register state_keys later. The engines have built-in
  // fallback content so the UI is never empty.
  //
  // Bundled lesson + quiz providers come from the static content
  // modules. They're constructed once here and shared across the
  // app session.
  const cohortProvider = new InMemoryCohortProvider();
  const contentResolver = new ContentResolver(cohortProvider);
  const dailyDecodeEngine = new DailyDecodeEngine(contentResolver);
  const questionEngine = new QuestionEngine(contentResolver);
  // Wrap bundled providers so any downloaded OTA content is preferred (merges on
  // top). With no bundle cached these are identical to the bundled providers.
  const bundledLessonProvider = buildMergedLessonProvider(buildBundledLessonProvider());
  const bundledQuizProvider = buildMergedQuizProvider(buildBundledQuizProvider());

  // ─── 3. Load user (or signal "needs onboarding") ────────────────
  const userId = Storage.currentUserId.get();
  let hasUser = false;
  const today = todayISO();

  if (userId) {
    try {
      // Try MMKV-known ID first; fall back to "any user on device"
      let user = await userRepository.getUser(userId);
      if (!user) {
        user = await userRepository.getCurrentUser();
        if (user) {
          // Re-mirror the right ID into MMKV (heal the inconsistency)
          Storage.currentUserId.set(user.id);
        }
      }

      if (user) {
        hasUser = true;
        await populateStoresForUser(
          user.id,
          today,
          contentResolver,
          dailyDecodeEngine,
          questionEngine,
          bundledLessonProvider,
          bundledQuizProvider
        );
      }
    } catch (err) {
      // Hydration is best-effort: a corrupt user row shouldn't crash
      // the app — let onboarding take over and rebuild state.
      error = err instanceof Error ? err.message : String(err);
      if (__DEV__) {
        console.warn('[Hydration] User load failed:', err);
      }
    }
  } else {
    // No user yet — likely first launch. Initialize content store with
    // empty engines so screens still mount; user store stays empty so
    // the layout redirects to onboarding.
    useContentStore.setState({
      contentResolver,
      dailyDecodeEngine,
      questionEngine,
      lessonEngine: null,
      quizEngine: null,
      todaysCard: null,
      todaysQuestions: [],
      answeredQuestionIds: [],
      hydrated: true,
    });
  }

  // ─── 4. Daily rollover check ────────────────────────────────────
  const dailyRolloverHappened = await maybeRunDailyRollover(today, userId);

  // ─── 5. Warm community interaction state (chunk 7) ──────────────
  //
  // The community store's hug/report sets need to be loaded so the
  // tab can render "you hugged this" / "you reported this" state
  // without a flicker on first open. Fire-and-forget — if it fails,
  // the store falls back to empty sets (worst case: user can hug a
  // post they already hugged, which is a no-op on the repo side).
  //
  // We don't await this — it doesn't gate the splash screen. The
  // community store guards against being read before hydration.
  if (hasUser) {
    void useCommunityStore.getState().refreshUserInteractions();
  } else {
    useCommunityStore.setState({ hydrated: true });
  }

  // ─── 6. Warm Phase Weather (chunk 10 B2) ────────────────────────
  //
  // Cheap (<2ms), deterministic per date. Generating it here means the
  // home card renders instantly on the very first paint instead of
  // popping in a frame later. Safe to run even when there's no user —
  // the snapshot has no user-specific data.
  try {
    usePhaseWeatherStore.getState().ensureToday();
  } catch (err) {
    logSilentFailure('hydration.phaseWeatherWarm', err);
  }

  // ─── 7. Warm Dottie Predicts (chunk 10 B3) ──────────────────────
  //
  // Fire-and-forget — the engine runs a couple of small repo reads
  // and a pure ranking pass. Awaiting would gate first paint, but the
  // Predicts card has a friendly loading state, so we deliberately
  // don't await. The deck typically lands well before the user can
  // scroll past the streak row.
  //
  // No-user case: ensureToday() exits early and marks hydrated:true.
  if (hasUser) {
    void usePredictsStore.getState().ensureToday();
  } else {
    usePredictsStore.setState({ hydrated: true });
  }

  // ─── 7.4 Warm the PREDICTION + EXPLANATION (device-test-20) ─────
  //
  //  The owner: "the scientific information under the calendar loads a bit
  //  late — is the prediction engine taking time in the background?" It was,
  //  and it was doing it at the worst possible moment.
  //
  //  `PredictionExplainerCard` prefers `latestExplanation` from this store and
  //  falls back to computing one ITSELF when the store has none. Nothing ever
  //  populated it on a cold start — `recomputePrediction` ran only after a
  //  cycle-data mutation — so on the first visit to the Cycle tab every one of
  //  those cards ran the full Bayesian predictor inline, in the render path,
  //  on the JS thread, while the user watched.
  //
  //  Warming it here is the right answer to "why don't we load the other
  //  screens in the background": the expensive thing is not the screen, it is
  //  this computation, and it can be done once while the user is still reading
  //  Today. Fire-and-forget — nothing on Today needs it, and the Cycle tab now
  //  finds it already waiting.
  if (hasUser) {
    // ─── SHOW THE LAST ANSWER WHILE COMPUTING THE NEW ONE ─────────
    //
    //  Owner, device-test-20: "if the user hasn't logged their period, or it
    //  hasn't been updated, why don't we show the previous graphs?" Exactly
    //  right, with one condition: only while it is still TRUE.
    //
    //  The cache carries a fingerprint of the inputs it came from. If nothing
    //  that matters has changed — same last period, same cycle count — the
    //  cached explanation IS the current explanation, so it is restored here
    //  and the Cycle tab has its science before it is ever opened.
    //
    //  If the fingerprint has moved, the cached numbers are about to be wrong.
    //  They are NOT shown. `explanationStale` goes up instead, and the card
    //  says it is updating. Showing yesterday's predicted date to someone who
    //  logged a period this morning would be the app being confidently wrong,
    //  which rule 1 forbids more strongly than it forbids being slow.
    const cycle = useCycleStore.getState();
    const uid = useUserStore.getState().userId;
    if (uid && cycle.lastPeriodStart) {
      try {
        const cached = Storage.lastExplanation.get(uid);
        const fresh =
          explanationFingerprint(uid, cycle.lastPeriodStart, cycle.cycleHistory.length);
        if (cached && cached.fingerprint === fresh) {
          useCycleStore.setState({
            latestExplanation: cached.explanation as PredictionExplanation,
            explanationStale: false,
          });
        } else {
          useCycleStore.setState({ explanationStale: true });
        }
      } catch (err) {
        logSilentFailure('hydration.explanationCache', err);
      }
    }

    void useCycleStore
      .getState()
      .recomputePrediction()
      .catch((err) => logSilentFailure('hydration.predictionWarm', err));
  }

  // ─── 7.5 Warm the beta-feedback table (chunk 12) ────────────────
  //
  // The beta_feedback table is created lazily via ensureTables() on the
  // repo's first DB call. If we wait until the user first taps 💌, the
  // very first CREATE TABLE + first INSERT race in the same tick — and a
  // force-quit mid-create can leave a half-applied table. Warming it now
  // (fire-and-forget, gated to beta builds so production never creates
  // the table) guarantees the table exists well before any tap.
  //
  // `count()` is the cheapest public method that routes through getDb()
  // → ensureTables(); we ignore the returned number.
  if (IS_BETA_BUILD) {
    void betaFeedbackRepository.count().catch((err) => {
      logSilentFailure('hydration.feedbackTableWarm', err);
    });
  }

  // ─── 8. Mark stores hydrated ────────────────────────────────────
  useUserStore.setState({ hydrated: true });
  useCycleStore.setState({ hydrated: true });
  useGamificationStore.setState({ hydrated: true });
  // Content store gets hydrated inside populateStoresForUser
  // Phase Weather + Dottie Predicts self-hydrate via their warmers

  return {
    hasUser,
    // `MigrationResult` has no `didMigrate` field — it reports the list
    // of versions actually applied. A non-empty list means work was done.
    migrationApplied: migrationResult.appliedVersions.length > 0,
    dailyRolloverHappened,
    durationMs: Date.now() - start,
    error,
  };
}

// ─── INTERNAL: POPULATE STORES FOR EXISTING USER ─────────────────────

async function populateStoresForUser(
  userId: string,
  today: string,
  contentResolver: ContentResolver,
  dailyDecodeEngine: DailyDecodeEngine,
  questionEngine: QuestionEngine,
  bundledLessonProvider: ReturnType<typeof buildBundledLessonProvider>,
  bundledQuizProvider: ReturnType<typeof buildBundledQuizProvider>
): Promise<void> {
  // Run independent reads in parallel for speed
  const [
    user,
    companionConfig,
    cycleHistory,
    lastPeriodStart,
    cycleCount,
    latestPrediction,
    predictionErrors,
    recentSymptoms,
    todayCheckIn,
    gamificationState,
    lessonProgress,
    quizAttempts,
    answeredToday,
  ] = await Promise.all([
    userRepository.getUser(userId),
    userRepository.getCompanionConfig(userId),
    cycleRepository.getCycleHistory(userId, 12),
    cycleRepository.getLastPeriodStart(userId),
    cycleRepository.getCycleCount(userId),
    cycleRepository.getLatestPrediction(userId),
    cycleRepository.getPredictionErrors(userId, 10),
    checkinRepository.getRecentSymptoms(userId, 7, today),
    checkinRepository.getCheckIn(userId, today),
    gamificationRepository.getState(userId),
    contentRepository.getAllLessonProgress(userId),
    contentRepository.getAllAttempts(userId),
    checkinRepository.getAnsweredQuestionIds(userId, today),
  ]);

  // ─── User store ─────────────────────────────────────────────────
  useUserStore.setState({
    userId,
    user,
    companionConfig,
    hydrated: true,
  });

  // Mirror the companion type into MMKV so the splash screen on next
  // launch can render the right mascot before any DB read finishes.
  if (companionConfig?.type) {
    Storage.companionType.set(companionConfig.type);
  }

  // ─── Cycle store ────────────────────────────────────────────────
  useCycleStore.setState({
    lastPeriodStart,
    cycleHistory,
    cycleCount,
    latestPrediction,
    predictionErrors,
    recentSymptoms,
    todayCheckIn,
    hydrated: true,
  });

  // ─── Gamification store ─────────────────────────────────────────
  if (gamificationState) {
    useGamificationStore.setState({
      streak: gamificationState.streak,
      xpTotal: gamificationState.xpTotal,
      currentLevel: gamificationState.currentLevel,
      gemsBalance: gamificationState.gemsBalance,
      badgesEarned: gamificationState.badgesEarned,
      hydrated: true,
    });
  } else {
    // User exists but no gamification state — initialize one
    const fresh = await gamificationRepository.initializeState(userId);
    useGamificationStore.setState({
      streak: fresh.streak,
      xpTotal: fresh.xpTotal,
      currentLevel: fresh.currentLevel,
      gemsBalance: fresh.gemsBalance,
      badgesEarned: fresh.badgesEarned,
      hydrated: true,
    });
  }

  // ─── Content store ──────────────────────────────────────────────
  // Build sync providers from the rows we just loaded
  const lessonProgressProvider = contentRepository.bindLessonProgressProvider(
    userId,
    lessonProgress
  );
  const quizAttemptProvider = contentRepository.bindQuizAttemptProvider(
    userId,
    quizAttempts
  );

  // Wire up the lesson + quiz engines with bundled content providers
  // and the persistence-backed providers we just bound.
  const lessonEngine = new LessonEngine(
    contentResolver,
    lessonProgressProvider,
    bundledLessonProvider
  );
  const quizEngine = new QuizEngine(
    contentResolver,
    quizAttemptProvider,
    bundledQuizProvider
  );

  // Seed the question engine with answers already submitted today
  for (const qid of answeredToday) {
    questionEngine.markAnswered(qid, today);
  }

  useContentStore.setState({
    contentResolver,
    dailyDecodeEngine,
    questionEngine,
    lessonEngine,
    quizEngine,
    todaysCard: null,
    todaysQuestions: [],
    answeredQuestionIds: answeredToday,
    hydrated: true,
  });
}

// ─── INTERNAL: DAILY ROLLOVER ────────────────────────────────────────

/**
 * Detect "we crossed midnight since the last reset" and run the
 * lightweight cleanup. Idempotent — calling on the same day is a no-op.
 */
async function maybeRunDailyRollover(
  today: string,
  userId: string | null
): Promise<boolean> {
  const lastReset = Storage.lastDailyResetDate.get();
  if (lastReset === today) return false;

  // Reset gamification's "used today" flags if we have a user
  if (userId) {
    try {
      await gamificationRepository.resetDailyFlags(userId);
    } catch (err) {
      logSilentFailure('hydration.resetDailyFlags', err);
    }
  }

  // Evict stale entries from content engines
  const contentState = useContentStore.getState();
  contentState.dailyDecodeEngine?.evictOldEntries(today);
  contentState.questionEngine?.evictOldEntries(today);

  // Invalidate Phase Weather so the new day brings fresh weather.
  // ensureToday() will regenerate on the very next read.
  try {
    usePhaseWeatherStore.getState().invalidate();
  } catch (err) {
    logSilentFailure('hydration.phaseWeatherInvalidate', err);
  }

  // Invalidate Dottie Predicts so insights re-rank for today.
  // ensureToday() will regenerate when the home screen mounts.
  try {
    usePredictsStore.getState().invalidate();
  } catch (err) {
    logSilentFailure('hydration.dottiePredictsInvalidate', err);
  }

  Storage.lastDailyResetDate.set(today);
  return true;
}
