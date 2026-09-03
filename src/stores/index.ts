/**
 * Dottie — Stores Public API
 *
 * Barrel export for the Zustand store layer. Screens and components
 * import from here, never from individual store files.
 *
 *   import { useUserStore, useCycleStore } from '@/stores';
 *
 * Plus the one-shot `hydrateAppState()` entry point used by `app/_layout`
 * to bootstrap everything on cold start.
 */

// ─── STORE HOOKS ─────────────────────────────────────────────────────

export {
  useUserStore,
  selectUserId,
  selectUserMode,
  selectCompanionType,
  selectHealthProfile,
  selectIsOnboarded,
} from './useUserStore';
export type { UserStoreState } from './useUserStore';

export {
  useCycleStore,
  selectCurrentPhase,
  selectDayInCycle,
  selectDayInPhase,
  selectLastPeriodStart,
  selectHasCycleData,
  selectPredictionMessage,
  selectPredictionExplanation,
  selectRecentSymptoms,
} from './useCycleStore';
export type { CycleStoreState } from './useCycleStore';

export {
  useGamificationStore,
  selectStreak,
  selectGemsBalance,
  selectXpTotal,
  selectCurrentLevel,
  selectLevelProgress,
} from './useGamificationStore';
export type { GamificationStoreState } from './useGamificationStore';

export {
  useContentStore,
  selectTodaysCard,
  selectTodaysQuestions,
  selectAnsweredQuestionIds,
} from './useContentStore';
export type { ContentStoreState } from './useContentStore';

export {
  useCommunityStore,
  selectFeedForSpace,
  selectRepliesForPost,
  selectIsHugged,
  selectIsReported,
  selectIsFetchingFeed,
  selectIsCreatingPost,
} from './useCommunityStore';
export type { CommunityStoreState } from './useCommunityStore';

export {
  useSisterhoodStore,
  selectCircle,
  selectMemberCount,
  selectMembersOrdered,
  selectMemberViewsOrdered,
  selectMemberById,
  selectMemberViewById,
  selectNudgesForMember,
  selectPendingPhaseSyncs,
  selectIsLoadingSisterhood,
  selectHasAnyMembers,
} from './useSisterhoodStore';
export type { SisterhoodStoreState } from './useSisterhoodStore';

export {
  useReportStore,
  selectCachedReport,
  selectIsGeneratingReport,
  selectReportError,
} from './useReportStore';
export type { ReportStoreState } from './useReportStore';

export {
  usePhaseWeatherStore,
  selectWeatherSnapshot,
  selectIsWeatherHydrated,
} from './usePhaseWeatherStore';
export type { PhaseWeatherStoreState } from './usePhaseWeatherStore';

export {
  usePredictsStore,
  selectPredictsDeck,
  selectIsPredictsHydrated,
  selectIsPredictsGenerating,
  selectPredictsError,
} from './usePredictsStore';
export type { PredictsStoreState } from './usePredictsStore';

// ─── BETA FEEDBACK (Chunk 12) ────────────────────────────────────────

export {
  useBetaFeedbackStore,
  selectFeedbackDraft,
  selectFeedbackHistory,
  selectIsSendingFeedback,
  selectFeedbackValidationError,
  selectLastDelivery,
  selectFeedbackHistoryCount,
} from './useBetaFeedbackStore';
export type {
  BetaFeedbackStoreState,
  SendContext as BetaFeedbackSendContext,
} from './useBetaFeedbackStore';

// ─── HYDRATION (called once at app startup) ──────────────────────────

export {
  hydrateAppState,
  isAppHydrated,
} from './hydrate';
export type { HydrationResult } from './hydrate';
