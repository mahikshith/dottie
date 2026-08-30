/**
 * Dottie — Community Store
 *
 * The orchestration layer for The Circle:
 *   - Owns the feed cache (last-fetched posts per space)
 *   - Wires moderation → repository → state updates
 *   - Composes author snapshots from user + gamification stores
 *   - Awards XP/gems for community participation (engine-driven rates)
 *
 * ─── HOW ACTIONS FLOW ───────────────────────────────────────────────
 *
 *  Screen calls e.g. `createPost(spaceId, body, mode)`
 *    ↓
 *  Store runs local moderation pass (PII, harm, length)
 *    ↓ (if blocked) returns { ok: false, moderation: result }
 *    ↓ (if ok)
 *  Store composes AuthorSnapshot from useUserStore + useGamificationStore
 *    ↓
 *  Store calls communityRepository.createPost(input + snapshot)
 *    ↓
 *  Store optimistically prepends new post to feed cache
 *    ↓
 *  Store awards XP + gems for posting (gamification store actions)
 *    ↓
 *  UI sees new post immediately + celebration micro-animation
 *
 *  Engines stay pure. Repo handles persistence. Store coordinates.
 *
 * ─── FEED CACHING ───────────────────────────────────────────────────
 *
 *  We cache the most recent page of posts PER SPACE in memory. The
 *  feed screen reads from this cache for instant render, then triggers
 *  a refresh in the background. This makes tab switches feel native.
 *
 *  Cache invalidation:
 *    - New post created → prepend to relevant space's cache + 'all'
 *    - New reply → bump that post's repliesCount in cache
 *    - Hug toggle → update hugsCount in cache for the affected target
 *    - Pull-to-refresh → drop cache for that space and re-fetch
 */

import { create } from 'zustand';
import {
  CommunityPost,
  CommunityReply,
  CreatePostInput,
  CreateReplyInput,
  CreateReportInput,
  ModerationResult,
  AuthorSnapshot,
  AnonymousCredibility,
  SpaceId,
  POST_BODY_MIN,
  POST_BODY_MAX,
  REPLY_BODY_MIN,
  REPLY_BODY_MAX,
} from '../types/community.types';
import {
  communityRepository,
  SeedPostInput,
} from '../database/repositories/community.repo';
import { useUserStore } from './useUserStore';
import { useGamificationStore } from './useGamificationStore';
import { moderateContent } from '../engine/community/moderation';

// ─── STATE SHAPE ─────────────────────────────────────────────────────

/**
 * Cache key: the SpaceId or 'all' for the cross-space feed.
 * Each cache entry is the most recent page of posts for that filter.
 */
type FeedCacheKey = SpaceId | 'all';

export interface CommunityStoreState {
  /** Per-space feed cache (last fetched page) */
  feedCache: Partial<Record<FeedCacheKey, CommunityPost[]>>;
  /** Replies cache keyed by post ID */
  repliesCache: Record<string, CommunityReply[]>;
  /** Set of post/reply IDs the current user has hugged */
  huggedPostIds: Set<string>;
  huggedReplyIds: Set<string>;
  /** Set of target IDs the user has reported (UI hides report button) */
  reportedPostIds: Set<string>;
  reportedReplyIds: Set<string>;
  /** True while a feed fetch is in flight (for spinner display) */
  isFetchingFeed: boolean;
  /** True while creating a post (for button disable + spinner) */
  isCreatingPost: boolean;
  /** Whether seed data has been checked at least once this session */
  seedChecked: boolean;
  /** True once initial hydration has run */
  hydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────

  /**
   * Fetch the feed for a space (or 'all'). Updates cache and returns
   * the fresh list. UI usually reads from `feedCache[spaceId]` directly.
   */
  fetchFeed: (spaceId: FeedCacheKey, refresh?: boolean) => Promise<CommunityPost[]>;

  /** Fetch replies for a single post, populating the cache */
  fetchReplies: (postId: string, refresh?: boolean) => Promise<CommunityReply[]>;

  /**
   * Create a new post. Returns ModerationResult if blocked, or the
   * created post if successful.
   */
  createPost: (input: CreatePostInput) => Promise<CreatePostResult>;

  /** Create a reply to a post */
  createReply: (input: CreateReplyInput) => Promise<CreateReplyResult>;

  /** Toggle a hug on a post or reply */
  toggleHug: (targetType: 'post' | 'reply', targetId: string) => Promise<HugResult>;

  /** Submit a report on a post or reply */
  submitReport: (input: CreateReportInput) => Promise<ReportResult>;

  /**
   * Seed sample posts on first community tab open if DB is empty.
   * Idempotent — checks count first.
   */
  ensureSeeded: () => Promise<void>;

  /** Refresh user's hug/report sets from DB (called on hydrate) */
  refreshUserInteractions: () => Promise<void>;

  /** Reset all community state (called by user.deleteAccount) */
  reset: () => void;
}

// ─── RESULT TYPES ────────────────────────────────────────────────────

export type CreatePostResult =
  | { ok: true; post: CommunityPost; xpAwarded: number; gemsAwarded: number }
  | { ok: false; moderation: ModerationResult }
  | { ok: false; reason: 'no_user' | 'too_short' | 'too_long' | 'unknown'; message: string };

export type CreateReplyResult =
  | { ok: true; reply: CommunityReply; xpAwarded: number; gemsAwarded: number }
  | { ok: false; moderation: ModerationResult }
  | { ok: false; reason: 'no_user' | 'too_short' | 'too_long' | 'unknown'; message: string };

export interface HugResult {
  hugged: boolean;
  newCount: number;
}

export interface ReportResult {
  submitted: boolean;
  nowHidden: boolean;
  message: string;
}

// ─── INITIAL STATE ───────────────────────────────────────────────────

const initialState = {
  feedCache: {} as Partial<Record<FeedCacheKey, CommunityPost[]>>,
  repliesCache: {} as Record<string, CommunityReply[]>,
  huggedPostIds: new Set<string>(),
  huggedReplyIds: new Set<string>(),
  reportedPostIds: new Set<string>(),
  reportedReplyIds: new Set<string>(),
  isFetchingFeed: false,
  isCreatingPost: false,
  seedChecked: false,
  hydrated: false,
};

// ─── STORE ──────────────────────────────────────────────────────────

export const useCommunityStore = create<CommunityStoreState>((set, get) => ({
  ...initialState,

  // ─── fetchFeed ──────────────────────────────────────────────────

  fetchFeed: async (spaceId, refresh = false) => {
    // If we already have a fresh cache and the caller didn't force a
    // refresh, return what's in memory.
    if (!refresh) {
      const cached = get().feedCache[spaceId];
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    set({ isFetchingFeed: true });
    try {
      const posts = await communityRepository.getFeed({ spaceId });
      set(state => ({
        feedCache: { ...state.feedCache, [spaceId]: posts },
        isFetchingFeed: false,
      }));
      return posts;
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] fetchFeed failed:', err);
      set({ isFetchingFeed: false });
      return [];
    }
  },

  // ─── fetchReplies ───────────────────────────────────────────────

  fetchReplies: async (postId, refresh = false) => {
    if (!refresh) {
      const cached = get().repliesCache[postId];
      if (cached && cached.length > 0) {
        return cached;
      }
    }

    try {
      const replies = await communityRepository.getRepliesForPost(postId);
      set(state => ({
        repliesCache: { ...state.repliesCache, [postId]: replies },
      }));
      return replies;
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] fetchReplies failed:', err);
      return [];
    }
  },

  // ─── createPost ─────────────────────────────────────────────────

  createPost: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      return { ok: false, reason: 'no_user', message: 'Please complete onboarding first 🌸' };
    }

    const trimmed = input.body.trim();
    if (trimmed.length < POST_BODY_MIN) {
      return {
        ok: false,
        reason: 'too_short',
        message: `Could you share a few more words? (at least ${POST_BODY_MIN} characters)`,
      };
    }
    if (trimmed.length > POST_BODY_MAX) {
      return {
        ok: false,
        reason: 'too_long',
        message: `That's a lot to share — could you trim to ${POST_BODY_MAX} characters? 💛`,
      };
    }

    // Run moderation pass
    const moderation = moderateContent(trimmed);
    if (!moderation.ok) {
      return { ok: false, moderation };
    }

    set({ isCreatingPost: true });

    try {
      // Compose author snapshot from current user state
      const snapshot = buildAuthorSnapshot(input.mode);

      const post = await communityRepository.createPost({
        ...input,
        body: trimmed,
        authorUserId: userId,
        authorSnapshot: snapshot,
      });

      // Optimistically prepend to feed caches
      set(state => {
        const newCache = { ...state.feedCache };
        const spacePosts = newCache[input.spaceId] ?? [];
        newCache[input.spaceId] = [post, ...spacePosts];
        const allPosts = newCache.all ?? [];
        newCache.all = [post, ...allPosts];
        return {
          feedCache: newCache,
          isCreatingPost: false,
        };
      });

      // Award XP + gems for community participation. We use generic
      // 'engagement' sources because community posting wasn't in the
      // original gamification rate table. The gamification store will
      // gracefully skip if the source isn't in XP_RATES.
      const xpResult = await useGamificationStore
        .getState()
        .awardXp('daily_checkin', { overrideAmount: 5 });
      const gemResult = await useGamificationStore
        .getState()
        .earnGems('daily_checkin');

      return {
        ok: true,
        post,
        xpAwarded: xpResult.xpAwarded,
        gemsAwarded: gemResult.gemsAwarded,
      };
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] createPost failed:', err);
      set({ isCreatingPost: false });
      return {
        ok: false,
        reason: 'unknown',
        message: 'Something went wrong saving your post. Try again? 💛',
      };
    }
  },

  // ─── createReply ────────────────────────────────────────────────

  createReply: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      return { ok: false, reason: 'no_user', message: 'Please complete onboarding first 🌸' };
    }

    const trimmed = input.body.trim();
    if (trimmed.length < REPLY_BODY_MIN) {
      return {
        ok: false,
        reason: 'too_short',
        message: `A few more words? (at least ${REPLY_BODY_MIN} characters)`,
      };
    }
    if (trimmed.length > REPLY_BODY_MAX) {
      return {
        ok: false,
        reason: 'too_long',
        message: `Could you trim that to ${REPLY_BODY_MAX} characters? 💛`,
      };
    }

    const moderation = moderateContent(trimmed);
    if (!moderation.ok) {
      return { ok: false, moderation };
    }

    try {
      const snapshot = buildAuthorSnapshot(input.mode);

      const reply = await communityRepository.createReply({
        ...input,
        body: trimmed,
        authorUserId: userId,
        authorSnapshot: snapshot,
      });

      // Update caches: append reply, bump post's replies count
      set(state => {
        const updatedRepliesCache = { ...state.repliesCache };
        const existing = updatedRepliesCache[input.postId] ?? [];
        updatedRepliesCache[input.postId] = [...existing, reply];

        const updatedFeedCache = bumpPostInAllCaches(
          state.feedCache,
          input.postId,
          post => ({ ...post, repliesCount: post.repliesCount + 1 })
        );

        return {
          repliesCache: updatedRepliesCache,
          feedCache: updatedFeedCache,
        };
      });

      const xpResult = await useGamificationStore
        .getState()
        .awardXp('daily_checkin', { overrideAmount: 3 });
      const gemResult = await useGamificationStore
        .getState()
        .earnGems('daily_checkin');

      return {
        ok: true,
        reply,
        xpAwarded: xpResult.xpAwarded,
        gemsAwarded: gemResult.gemsAwarded,
      };
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] createReply failed:', err);
      return {
        ok: false,
        reason: 'unknown',
        message: 'Something went wrong sending your reply. Try again? 💛',
      };
    }
  },

  // ─── toggleHug ──────────────────────────────────────────────────

  toggleHug: async (targetType, targetId) => {
    const userId = useUserStore.getState().userId;
    if (!userId) return { hugged: false, newCount: 0 };

    try {
      const result = await communityRepository.toggleHug(targetType, targetId, userId);

      set(state => {
        const updatedHuggedPostIds = new Set(state.huggedPostIds);
        const updatedHuggedReplyIds = new Set(state.huggedReplyIds);

        if (targetType === 'post') {
          if (result.hugged) updatedHuggedPostIds.add(targetId);
          else updatedHuggedPostIds.delete(targetId);
        } else {
          if (result.hugged) updatedHuggedReplyIds.add(targetId);
          else updatedHuggedReplyIds.delete(targetId);
        }

        // Update the count in any cached representation of this target
        let updatedFeedCache = state.feedCache;
        let updatedRepliesCache = state.repliesCache;

        if (targetType === 'post') {
          updatedFeedCache = bumpPostInAllCaches(
            state.feedCache,
            targetId,
            post => ({ ...post, hugsCount: result.newCount })
          );
        } else {
          updatedRepliesCache = bumpReplyInCache(
            state.repliesCache,
            targetId,
            reply => ({ ...reply, hugsCount: result.newCount })
          );
        }

        return {
          huggedPostIds: updatedHuggedPostIds,
          huggedReplyIds: updatedHuggedReplyIds,
          feedCache: updatedFeedCache,
          repliesCache: updatedRepliesCache,
        };
      });

      return result;
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] toggleHug failed:', err);
      return { hugged: false, newCount: 0 };
    }
  },

  // ─── submitReport ───────────────────────────────────────────────

  submitReport: async (input) => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      return {
        submitted: false,
        nowHidden: false,
        message: 'Please complete onboarding first 🌸',
      };
    }

    try {
      const result = await communityRepository.submitReport({
        ...input,
        reporterUserId: userId,
      });

      set(state => {
        const updatedReportedPostIds = new Set(state.reportedPostIds);
        const updatedReportedReplyIds = new Set(state.reportedReplyIds);

        if (input.targetType === 'post') updatedReportedPostIds.add(input.targetId);
        else updatedReportedReplyIds.add(input.targetId);

        // If auto-hidden, remove from feed caches
        let updatedFeedCache = state.feedCache;
        let updatedRepliesCache = state.repliesCache;
        if (result.nowHidden) {
          if (input.targetType === 'post') {
            updatedFeedCache = removePostFromAllCaches(state.feedCache, input.targetId);
          } else {
            updatedRepliesCache = removeReplyFromCache(state.repliesCache, input.targetId);
          }
        }

        return {
          reportedPostIds: updatedReportedPostIds,
          reportedReplyIds: updatedReportedReplyIds,
          feedCache: updatedFeedCache,
          repliesCache: updatedRepliesCache,
        };
      });

      return {
        submitted: result.submitted,
        nowHidden: result.nowHidden,
        message: result.submitted
          ? 'Thanks for keeping The Circle safe. 💛'
          : 'You&apos;ve already reported this. We&apos;re on it. 💛',
      };
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] submitReport failed:', err);
      return {
        submitted: false,
        nowHidden: false,
        message: 'Something went wrong. Try again? 💛',
      };
    }
  },

  // ─── ensureSeeded ───────────────────────────────────────────────

  ensureSeeded: async () => {
    if (get().seedChecked) return;
    const userId = useUserStore.getState().userId;
    if (!userId) {
      set({ seedChecked: true });
      return;
    }

    try {
      const count = await communityRepository.getTotalPostCount();
      if (count === 0) {
        await communityRepository.seedSamplePosts(userId, SAMPLE_SEED_POSTS);
      }
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] seed failed:', err);
    } finally {
      set({ seedChecked: true });
    }
  },

  // ─── refreshUserInteractions ────────────────────────────────────

  refreshUserInteractions: async () => {
    const userId = useUserStore.getState().userId;
    if (!userId) {
      set({ hydrated: true });
      return;
    }

    try {
      const [huggedPosts, huggedReplies, reportedPosts, reportedReplies] = await Promise.all([
        communityRepository.getHuggedTargetIds(userId, 'post'),
        communityRepository.getHuggedTargetIds(userId, 'reply'),
        communityRepository.getReportedTargetIds(userId, 'post'),
        communityRepository.getReportedTargetIds(userId, 'reply'),
      ]);
      set({
        huggedPostIds: huggedPosts,
        huggedReplyIds: huggedReplies,
        reportedPostIds: reportedPosts,
        reportedReplyIds: reportedReplies,
        hydrated: true,
      });
    } catch (err) {
      if (__DEV__) console.warn('[CommunityStore] refresh interactions failed:', err);
      set({ hydrated: true });
    }
  },

  // ─── reset ──────────────────────────────────────────────────────

  reset: () => {
    set(initialState);
  },
}));

// ─── SELECTORS ───────────────────────────────────────────────────────

// Stable empty fallbacks. A selector that returns a FRESH [] each render makes
// Zustand see "new" state every time → infinite re-render ("Maximum update depth
// exceeded"). Share one reference so empty state stays referentially equal.
const EMPTY_POSTS: CommunityPost[] = [];
const EMPTY_REPLIES: CommunityReply[] = [];

export const selectFeedForSpace = (spaceId: FeedCacheKey) =>
  (s: CommunityStoreState): CommunityPost[] =>
    s.feedCache[spaceId] ?? EMPTY_POSTS;

export const selectRepliesForPost = (postId: string) =>
  (s: CommunityStoreState): CommunityReply[] =>
    s.repliesCache[postId] ?? EMPTY_REPLIES;

export const selectIsHugged = (targetType: 'post' | 'reply', targetId: string) =>
  (s: CommunityStoreState): boolean =>
    targetType === 'post'
      ? s.huggedPostIds.has(targetId)
      : s.huggedReplyIds.has(targetId);

export const selectIsReported = (targetType: 'post' | 'reply', targetId: string) =>
  (s: CommunityStoreState): boolean =>
    targetType === 'post'
      ? s.reportedPostIds.has(targetId)
      : s.reportedReplyIds.has(targetId);

export const selectIsFetchingFeed = (s: CommunityStoreState): boolean => s.isFetchingFeed;
export const selectIsCreatingPost = (s: CommunityStoreState): boolean => s.isCreatingPost;

// ─── INTERNAL HELPERS ────────────────────────────────────────────────

/**
 * Compose an AuthorSnapshot from the current user + gamification state.
 *
 * For named mode: pull displayName + companion from user store.
 * For anonymous mode: build the credibility strip from gamification
 * state. (Spirit alias is filled in by the repo using the row ID for
 * deterministic stability.)
 */
function buildAuthorSnapshot(mode: 'named' | 'anonymous'): AuthorSnapshot {
  const userState = useUserStore.getState();
  const gamState = useGamificationStore.getState();

  if (mode === 'named') {
    return {
      mode: 'named',
      displayName: userState.user?.displayName ?? 'A Dottie friend',
      companionType: userState.companionConfig?.type ?? 'blossom',
      spiritAlias: null,
      spiritEmoji: null,
      credibility: null,
    };
  }

  // Anonymous — assemble credibility from gamification + user data
  const credibility: AnonymousCredibility = {
    streak: gamState.streak.currentStreak,
    xpTotal: gamState.xpTotal,
    memberSince: userState.user?.createdAt ?? new Date().toISOString(),
    // Posts/replies counts are computed at render time from the user's
    // own counts (the credibility strip pulls them lazily). For the
    // snapshot, we capture 0 — UI overrides with live counts when
    // showing your own posts.
    postsCount: 0,
    repliesCount: 0,
    badgesCount: gamState.badgesEarned.length,
  };

  return {
    mode: 'anonymous',
    displayName: null,
    companionType: null,
    spiritAlias: null, // Repo fills this in with deterministic alias
    spiritEmoji: null,
    credibility,
  };
}

/** Apply a transformer to a post in every feed cache it appears in */
function bumpPostInAllCaches(
  cache: Partial<Record<FeedCacheKey, CommunityPost[]>>,
  postId: string,
  transform: (post: CommunityPost) => CommunityPost
): Partial<Record<FeedCacheKey, CommunityPost[]>> {
  const updated: Partial<Record<FeedCacheKey, CommunityPost[]>> = {};
  for (const key of Object.keys(cache) as FeedCacheKey[]) {
    const posts = cache[key];
    if (!posts) continue;
    updated[key] = posts.map(p => (p.id === postId ? transform(p) : p));
  }
  return updated;
}

/** Apply a transformer to a reply in the replies cache */
function bumpReplyInCache(
  cache: Record<string, CommunityReply[]>,
  replyId: string,
  transform: (reply: CommunityReply) => CommunityReply
): Record<string, CommunityReply[]> {
  const updated: Record<string, CommunityReply[]> = {};
  for (const postId of Object.keys(cache)) {
    const replies = cache[postId];
    if (!replies) continue;
    updated[postId] = replies.map(r => (r.id === replyId ? transform(r) : r));
  }
  return updated;
}

/** Remove a post from every feed cache it appears in */
function removePostFromAllCaches(
  cache: Partial<Record<FeedCacheKey, CommunityPost[]>>,
  postId: string
): Partial<Record<FeedCacheKey, CommunityPost[]>> {
  const updated: Partial<Record<FeedCacheKey, CommunityPost[]>> = {};
  for (const key of Object.keys(cache) as FeedCacheKey[]) {
    const posts = cache[key];
    if (!posts) continue;
    updated[key] = posts.filter(p => p.id !== postId);
  }
  return updated;
}

/** Remove a reply from the replies cache */
function removeReplyFromCache(
  cache: Record<string, CommunityReply[]>,
  replyId: string
): Record<string, CommunityReply[]> {
  const updated: Record<string, CommunityReply[]> = {};
  for (const postId of Object.keys(cache)) {
    const replies = cache[postId];
    if (!replies) continue;
    updated[postId] = replies.filter(r => r.id !== replyId);
  }
  return updated;
}

// ─── SAMPLE SEED POSTS ───────────────────────────────────────────────

/**
 * Warm, supportive sample posts shown on first community open so users
 * don't see an empty space. These are seeded under the current user but
 * presented with diverse named/anonymous modes to model the community
 * vibe.
 */
const SAMPLE_SEED_POSTS: SeedPostInput[] = [
  {
    spaceId: 'first_period',
    body: 'I got my first period this week and honestly? I&apos;m so glad I had Dottie. The little Daily Decode card explaining what was happening made me feel so much calmer. To anyone scared — you&apos;ve got this. 🌸',
    mode: 'named',
    displayName: 'Riya',
    companionType: 'blossom',
  },
  {
    spaceId: 'first_period',
    body: 'My mom never really talked to me about periods. Just wanted to say it&apos;s okay to feel weird about it. You&apos;re not alone here.',
    mode: 'anonymous',
    credibility: {
      streak: 12,
      xpTotal: 340,
      memberSince: '2025-09-14T00:00:00.000Z',
      postsCount: 3,
      repliesCount: 8,
      badgesCount: 2,
    },
  },
  {
    spaceId: 'pcos_warriors',
    body: 'Three months into inositol and my cycles are actually starting to get more predictable. Sharing because I needed to read posts like this when I started. Healing isn&apos;t linear, but it happens. 🌿',
    mode: 'anonymous',
    credibility: {
      streak: 47,
      xpTotal: 1820,
      memberSince: '2025-04-22T00:00:00.000Z',
      postsCount: 11,
      repliesCount: 34,
      badgesCount: 5,
    },
  },
  {
    spaceId: 'fitness_phases',
    body: 'Just learned that strength training feels EASIER in my follicular phase and now I&apos;m never going back. Stopped beating myself up for "slow" weeks. Listen to your body, friends. 💪',
    mode: 'named',
    displayName: 'Sana',
    companionType: 'fox',
  },
  {
    spaceId: 'mental_health',
    body: 'Anyone else feel like a totally different person in luteal phase? I&apos;m starting to track my mood with my cycle and the pattern is so clear. It&apos;s such a relief to know it&apos;s not just me.',
    mode: 'anonymous',
    credibility: {
      streak: 23,
      xpTotal: 690,
      memberSince: '2025-07-30T00:00:00.000Z',
      postsCount: 5,
      repliesCount: 14,
      badgesCount: 3,
    },
  },
  {
    spaceId: 'nutrition_cravings',
    body: 'Chocolate cravings before my period = my body asking for magnesium, apparently! Started eating more almonds and dark leafy greens and the cravings are noticeably softer. Body is so smart. 🍫',
    mode: 'named',
    displayName: 'Maya',
    companionType: 'bunny',
  },
  {
    spaceId: 'general_support',
    body: 'Just had a really rough day. Cramps + work stress + tired. Not looking for solutions — just needed to say it out loud somewhere. Sending hugs to anyone else having a tough one. 🫂',
    mode: 'anonymous',
    credibility: {
      streak: 8,
      xpTotal: 210,
      memberSince: '2025-11-02T00:00:00.000Z',
      postsCount: 2,
      repliesCount: 5,
      badgesCount: 1,
    },
  },
];