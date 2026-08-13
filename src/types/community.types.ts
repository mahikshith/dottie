/**
 * Dottie — Community Types ("The Circle")
 *
 * Type definitions for the community / social plane.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  The Circle is Dottie's safe, supportive community layer. Two
 *  posting modes are supported on every post:
 *
 *    NAMED      — visible display name + companion avatar
 *    ANONYMOUS  — display name hidden, random "spirit alias" assigned,
 *                 but a CREDIBILITY STRIP is shown (streak, points,
 *                 member since, posts count, replies count, badges)
 *
 *  Anonymous mode prevents trolling without exposing identity: high-
 *  credibility users are visibly trustworthy, brand-new throwaways are
 *  visibly less so. Identity stays hidden either way.
 *
 *  Phase 1 (this chunk) is LOCAL-ONLY — posts and replies are stored
 *  in SQLite. The repository interface is shaped to match a future
 *  Supabase backend so the migration is mechanical (swap the repo
 *  implementation; the store and screens don't change).
 *
 *  Safety baseline for MVP:
 *    - No DMs, no image uploads, no links rendered
 *    - Report action visible on every post and reply
 *    - Local pre-publish moderation pass (PII patterns + harm keywords)
 *    - 3+ reports auto-hides content for review
 *
 * ─── NAMING CONVENTION ──────────────────────────────────────────────
 *
 *  This file is the SINGLE SOURCE OF TRUTH for community shapes. The
 *  repository and store import from here. UI components also import
 *  from here so we never disagree on a field name.
 */

import { CompanionType } from './content.types';

// ─── SPACES ──────────────────────────────────────────────────────────

/**
 * Community spaces (topical channels).
 *
 * Spaces are intentionally bounded — too many spaces fragments the
 * community. New spaces only added when there's clear demand from
 * existing post traffic.
 */
export type SpaceId =
  | 'first_period'
  | 'pcos_warriors'
  | 'fitness_phases'
  | 'mental_health'
  | 'nutrition_cravings'
  | 'general_support';

/** Metadata describing a community space (for filter chips + headers) */
export interface CommunitySpace {
  id: SpaceId;
  title: string;
  description: string;
  emoji: string;
  /** Whether this space is age-restricted (filtered out for Teen Mode) */
  teenSafe: boolean;
  /** Soft suggestion shown to first-time posters in this space */
  postingHint: string;
}

// ─── POSTING MODE ────────────────────────────────────────────────────

/** How an author chose to identify themselves on a post or reply */
export type PostingMode = 'named' | 'anonymous';

// ─── POSTS ───────────────────────────────────────────────────────────

/** A community post — the top-level item shown in space feeds */
export interface CommunityPost {
  id: string;
  /** The local user who authored this post (always stored, never shown when anonymous) */
  authorUserId: string;
  /** The space this post lives in */
  spaceId: SpaceId;
  /** Post body text — moderation passes ensure no PII / harmful content */
  body: string;
  /** Whether the author chose anonymous mode */
  mode: PostingMode;
  /** Snapshot of the author's display info AT POST TIME (decoupled from live profile) */
  authorSnapshot: AuthorSnapshot;
  /** Aggregate counts (denormalized for fast feed reads) */
  hugsCount: number;
  repliesCount: number;
  reportsCount: number;
  /** Hidden by moderation when reportsCount >= AUTO_HIDE_THRESHOLD */
  isHidden: boolean;
  /** ISO timestamp of creation (sortable lexicographically) */
  createdAt: string;
  /** ISO timestamp of last edit, null if never edited */
  editedAt: string | null;
}

/** A reply to a post — flat replies only (no nested threads in MVP) */
export interface CommunityReply {
  id: string;
  postId: string;
  authorUserId: string;
  body: string;
  mode: PostingMode;
  authorSnapshot: AuthorSnapshot;
  hugsCount: number;
  reportsCount: number;
  isHidden: boolean;
  createdAt: string;
  editedAt: string | null;
}

// ─── AUTHOR SNAPSHOT ─────────────────────────────────────────────────

/**
 * A snapshot of the author's display info at post-time.
 *
 * We snapshot rather than join-on-read because:
 *   1. Privacy: deleting your account zeroes your identity but preserves
 *      the helpful content for the community
 *   2. Stability: anonymous spirit aliases stay consistent per-post even
 *      if the user later changes companion
 *   3. Performance: no join needed for feed rendering
 *
 * Named mode populates `displayName` + `companionType`.
 * Anonymous mode populates `spiritAlias` + `credibility` instead.
 */
export interface AuthorSnapshot {
  /** Posting mode at the time of creation */
  mode: PostingMode;
  /** Named mode: the user's chosen display name (or "A Dottie friend" fallback) */
  displayName: string | null;
  /** Named mode: companion shown next to the name */
  companionType: CompanionType | null;
  /** Anonymous mode: deterministic-per-post spirit alias (e.g. "Anonymous Fox") */
  spiritAlias: string | null;
  /** Anonymous mode: random emoji for the alias avatar */
  spiritEmoji: string | null;
  /** Anonymous mode: trust indicators visible on the card */
  credibility: AnonymousCredibility | null;
}

/**
 * Credibility indicators shown on anonymous posts.
 * Identity stays hidden — these prove "real engaged person, not a bot".
 */
export interface AnonymousCredibility {
  streak: number;
  xpTotal: number;
  /** ISO date string of when this user joined Dottie */
  memberSince: string;
  postsCount: number;
  repliesCount: number;
  badgesCount: number;
}

// ─── HUGS ────────────────────────────────────────────────────────────

/**
 * A hug given on a post or reply.
 *
 * Stored as separate rows (not just a counter) so we can:
 *   - Prevent the same user from hugging twice (idempotent)
 *   - Show "you hugged this" state in the UI
 *   - One day display "your hugs" history for warm-fuzzies
 */
export interface CommunityHug {
  id: string;
  /** The post or reply being hugged */
  targetType: 'post' | 'reply';
  targetId: string;
  /** Who gave the hug */
  userId: string;
  createdAt: string;
}

// ─── REPORTS ─────────────────────────────────────────────────────────

/** Reasons a user can pick when reporting content */
export type ReportReason =
  | 'medical_advice'
  | 'personal_info'
  | 'bullying_harassment'
  | 'pro_ana_self_harm'
  | 'spam'
  | 'other';

/** A report on a post or reply */
export interface CommunityReport {
  id: string;
  targetType: 'post' | 'reply';
  targetId: string;
  reporterUserId: string;
  reason: ReportReason;
  /** Optional free-text note from the reporter */
  notes: string | null;
  createdAt: string;
}

// ─── MODERATION ──────────────────────────────────────────────────────

/** Result of running content through the local moderation filter */
export interface ModerationResult {
  ok: boolean;
  /** Categories the content was flagged for (empty if ok) */
  flags: ModerationFlag[];
  /** Friendly message to show the user if blocked */
  message: string | null;
}

export type ModerationFlag =
  | 'phone_number'
  | 'email_address'
  | 'url_link'
  | 'medical_prescription'
  | 'self_harm_language'
  | 'profanity_severe'
  | 'too_short'
  | 'too_long';

// ─── INPUT TYPES ─────────────────────────────────────────────────────

/** What the "create post" screen sends to the store */
export interface CreatePostInput {
  spaceId: SpaceId;
  body: string;
  mode: PostingMode;
}

/** What the reply input on a post sends to the store */
export interface CreateReplyInput {
  postId: string;
  body: string;
  mode: PostingMode;
}

/** What the report flow sends */
export interface CreateReportInput {
  targetType: 'post' | 'reply';
  targetId: string;
  reason: ReportReason;
  notes?: string;
}

// ─── FEED QUERY OPTIONS ──────────────────────────────────────────────

/** Filters + pagination for fetching the feed */
export interface FeedQuery {
  spaceId: SpaceId | 'all';
  /** ISO timestamp — return posts created strictly BEFORE this */
  beforeTimestamp?: string;
  /** Max posts to return (default 20) */
  limit?: number;
  /** Whether to include hidden posts (false by default — only mods see them) */
  includeHidden?: boolean;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────

/** Auto-hide threshold for reports (3+ reports = hidden for review) */
export const AUTO_HIDE_THRESHOLD = 3;

/** Min/max body length for posts */
export const POST_BODY_MIN = 8;
export const POST_BODY_MAX = 1200;

/** Min/max body length for replies */
export const REPLY_BODY_MIN = 2;
export const REPLY_BODY_MAX = 600;

/** Default page size for feed queries */
export const FEED_PAGE_SIZE = 20;

// ─── SPACE CATALOG ───────────────────────────────────────────────────

/**
 * The seeded list of community spaces.
 * Add new spaces here — repository auto-uses them on init.
 *
 * Naming convention for descriptions: warm, inviting, never clinical.
 */
export const COMMUNITY_SPACES: CommunitySpace[] = [
  {
    id: 'first_period',
    title: 'First Period Support',
    description: 'A gentle place for first-timers and the people who love them. 🌸',
    emoji: '🌸',
    teenSafe: true,
    postingHint: 'No question is too small here. Everyone started somewhere.',
  },
  {
    id: 'pcos_warriors',
    title: 'PCOS Warriors',
    description: 'Living with PCOS together — questions, wins, and everything in between. 💪',
    emoji: '🩺',
    teenSafe: false,
    postingHint: 'Share your story. Someone else might be feeling the exact same way.',
  },
  {
    id: 'fitness_phases',
    title: 'Fitness & Phases',
    description: 'Move with your cycle. Workout wins, energy dips, and rest days. 🏋️',
    emoji: '🏋️',
    teenSafe: true,
    postingHint: 'Whether you ran a marathon or took a walk — all movement counts. 💛',
  },
  {
    id: 'mental_health',
    title: 'Cycle & Mental Health',
    description: 'Mood, anxiety, PMDD — the mind/cycle conversation we all need. 🧠',
    emoji: '🧠',
    teenSafe: true,
    postingHint: 'Your feelings are real. This is a space to be heard, not fixed.',
  },
  {
    id: 'nutrition_cravings',
    title: 'Nutrition & Cravings',
    description: 'Food, cravings, and how your body talks to you. 🍫',
    emoji: '🍫',
    teenSafe: true,
    postingHint: 'No judgment, no diet talk. Just real bodies and real food.',
  },
  {
    id: 'general_support',
    title: 'General Support',
    description: 'Anything goes. Vent, celebrate, ask — we&apos;re here. 💛',
    emoji: '💛',
    teenSafe: true,
    postingHint: 'Sometimes you just need someone to listen. We&apos;re listening.',
  },
];

/** Lookup helper for space metadata by ID */
export function getSpaceById(id: SpaceId): CommunitySpace {
  const space = COMMUNITY_SPACES.find(s => s.id === id);
  // This should never happen since SpaceId is the union of valid IDs,
  // but TypeScript can't prove it — fallback to general_support.
  return space ?? COMMUNITY_SPACES[COMMUNITY_SPACES.length - 1]!;
}

/** All spaces visible in Teen Mode (filtered by teenSafe flag) */
export function getTeenSafeSpaces(): CommunitySpace[] {
  return COMMUNITY_SPACES.filter(s => s.teenSafe);
}

// ─── SPIRIT ALIAS GENERATION ─────────────────────────────────────────

/**
 * Pool of spirit alias names for anonymous mode.
 * Chosen for warmth — animals + adjectives that feel friendly, never
 * intimidating. Kept short so the credibility strip has room to breathe.
 */
export const SPIRIT_ALIAS_POOL: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Anonymous Fox', emoji: '🦊' },
  { name: 'Anonymous Bunny', emoji: '🐰' },
  { name: 'Anonymous Owl', emoji: '🦉' },
  { name: 'Anonymous Cat', emoji: '🐱' },
  { name: 'Anonymous Butterfly', emoji: '🦋' },
  { name: 'Anonymous Blossom', emoji: '🌸' },
  { name: 'Anonymous Panda', emoji: '🐼' },
  { name: 'Anonymous Deer', emoji: '🦌' },
  { name: 'Anonymous Hedgehog', emoji: '🦔' },
  { name: 'Anonymous Otter', emoji: '🦦' },
  { name: 'Anonymous Bee', emoji: '🐝' },
  { name: 'Anonymous Star', emoji: '✨' },
  { name: 'Anonymous Moon', emoji: '🌙' },
  { name: 'Anonymous Cloud', emoji: '☁️' },
  { name: 'Anonymous Sunflower', emoji: '🌻' },
];

/**
 * Deterministically pick a spirit alias from a seed string (the post ID).
 *
 * Why deterministic? So if a user scrolls past the same anonymous post
 * twice, the alias is identical. Random-each-render would be jarring.
 *
 * Why seeded by post ID and not user ID? Because the same user posting
 * twice anonymously should NOT obviously be the same author across
 * posts — that would defeat anonymity in low-traffic spaces.
 */
export function pickSpiritAlias(seed: string): { name: string; emoji: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % SPIRIT_ALIAS_POOL.length;
  return SPIRIT_ALIAS_POOL[index]!;
}