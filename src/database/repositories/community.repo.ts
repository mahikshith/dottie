/**
 * Dottie — Community Repository ("The Circle")
 *
 * Owns the social plane tables:
 *   - community_posts        Top-level posts in each space
 *   - community_replies      Flat replies (no nested threads in MVP)
 *   - community_hugs         One row per (user, target) — prevents double-hugs
 *   - community_reports      One row per report submitted
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Local-first for MVP. The schema and method signatures are shaped to
 *  match a future Supabase backend — when we flip the switch, only the
 *  implementation changes (the store and screens stay identical).
 *
 *  Schema-on-write for author snapshots: every post stores the author's
 *  display info AT POST TIME as a JSON column. This means:
 *    - Deleting your account zeroes your identity but preserves content
 *    - Anonymous aliases stay consistent per-post (deterministic seed)
 *    - No JOIN to users table needed for feed rendering (fast)
 *
 *  Denormalized counts: hugs_count, replies_count, reports_count live on
 *  the post/reply rows for fast feed reads. We bump them transactionally
 *  whenever a related row is inserted/deleted.
 *
 *  Auto-hide moderation: when reports_count hits AUTO_HIDE_THRESHOLD
 *  the is_hidden flag flips. Hidden posts disappear from default feed
 *  queries.
 *
 * ─── TABLES (created lazily on first use) ───────────────────────────
 *
 *  These tables are NOT in the main schema.ts because they were added
 *  in chunk 7. The repo runs CREATE TABLE IF NOT EXISTS on first call
 *  rather than requiring a full migration runner change. This keeps
 *  chunk 7 self-contained and avoids a schema version bump.
 */

import {
  Database,
  getDatabase,
  withTransaction,
  trackQuery,
  trackWrite,
} from '../client';
import {
  CommunityPost,
  CommunityReply,
  CommunityHug,
  CommunityReport,
  CreatePostInput,
  CreateReplyInput,
  CreateReportInput,
  FeedQuery,
  AuthorSnapshot,
  AnonymousCredibility,
  ReportReason,
  SpaceId,
  PostingMode,
  AUTO_HIDE_THRESHOLD,
  FEED_PAGE_SIZE,
  pickSpiritAlias,
} from '../../types/community.types';
import { CompanionType } from '../../types/content.types';

// ─── ROW TYPES ───────────────────────────────────────────────────────

interface CommunityPostRow {
  id: string;
  author_user_id: string;
  space_id: string;
  body: string;
  mode: string;
  author_snapshot: string; // JSON
  hugs_count: number;
  replies_count: number;
  reports_count: number;
  is_hidden: number; // 0 | 1
  created_at: string;
  edited_at: string | null;
}

interface CommunityReplyRow {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  mode: string;
  author_snapshot: string;
  hugs_count: number;
  reports_count: number;
  is_hidden: number;
  created_at: string;
  edited_at: string | null;
}

interface CommunityHugRow {
  id: string;
  target_type: string;
  target_id: string;
  user_id: string;
  created_at: string;
}

interface CommunityReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reporter_user_id: string;
  reason: string;
  notes: string | null;
  created_at: string;
}

// ─── INPUT TYPES (with author context from the store) ────────────────

/**
 * What the store passes when creating a post.
 * Author context (snapshot fields) is computed by the store and
 * passed in — the repo doesn't reach into other stores to assemble it.
 */
export interface CreatePostRepoInput extends CreatePostInput {
  authorUserId: string;
  authorSnapshot: AuthorSnapshot;
}

export interface CreateReplyRepoInput extends CreateReplyInput {
  authorUserId: string;
  authorSnapshot: AuthorSnapshot;
}

export interface CreateReportRepoInput extends CreateReportInput {
  reporterUserId: string;
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class CommunityRepository {
  private initialized = false;

  private async getDb(): Promise<Database> {
    const db = await getDatabase();
    if (!this.initialized) {
      await this.ensureTables(db);
      this.initialized = true;
    }
    return db;
  }

  // ─── SCHEMA INITIALIZATION ──────────────────────────────────────

  /**
   * Lazily create the community tables on first use.
   *
   * Why lazy and not part of the main migration runner? Because the
   * community feature is additive and we want chunk 7 to land without
   * touching the migration version. Once chunk 7 is in production, a
   * future cleanup PR can fold these into SCHEMA_V2.
   */
  private async ensureTables(db: Database): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY NOT NULL,
        author_user_id TEXT NOT NULL,
        space_id TEXT NOT NULL,
        body TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('named', 'anonymous')),
        author_snapshot TEXT NOT NULL DEFAULT '{}',
        hugs_count INTEGER NOT NULL DEFAULT 0,
        replies_count INTEGER NOT NULL DEFAULT 0,
        reports_count INTEGER NOT NULL DEFAULT 0,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        edited_at TEXT,
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_community_posts_space_created
        ON community_posts(space_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_community_posts_visible
        ON community_posts(is_hidden, created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS community_replies (
        id TEXT PRIMARY KEY NOT NULL,
        post_id TEXT NOT NULL,
        author_user_id TEXT NOT NULL,
        body TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('named', 'anonymous')),
        author_snapshot TEXT NOT NULL DEFAULT '{}',
        hugs_count INTEGER NOT NULL DEFAULT 0,
        reports_count INTEGER NOT NULL DEFAULT 0,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        edited_at TEXT,
        FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_community_replies_post_created
        ON community_replies(post_id, created_at ASC)`,

      `CREATE TABLE IF NOT EXISTS community_hugs (
        id TEXT PRIMARY KEY NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
        target_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (target_type, target_id, user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_community_hugs_target
        ON community_hugs(target_type, target_id)`,
      `CREATE INDEX IF NOT EXISTS idx_community_hugs_user
        ON community_hugs(user_id, created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS community_reports (
        id TEXT PRIMARY KEY NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
        target_id TEXT NOT NULL,
        reporter_user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (target_type, target_id, reporter_user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_community_reports_target
        ON community_reports(target_type, target_id)`,
    ];

    for (const sql of statements) {
      await db.execAsync(sql);
    }
  }

  // ─── POST: CREATE ───────────────────────────────────────────────

  /**
   * Create a new post. The caller is responsible for having run the
   * moderation filter — this repo trusts the input is safe to persist.
   */
  async createPost(input: CreatePostRepoInput): Promise<CommunityPost> {
    const db = await this.getDb();
    const id = generatePostId();
    const now = new Date().toISOString();

    // For anonymous mode, ensure the spirit alias is keyed by the post ID
    // so it stays stable across renders.
    const finalSnapshot = input.mode === 'anonymous'
      ? ensureAnonymousAlias(input.authorSnapshot, id)
      : input.authorSnapshot;

    const row: CommunityPostRow = {
      id,
      author_user_id: input.authorUserId,
      space_id: input.spaceId,
      body: input.body.trim(),
      mode: input.mode,
      author_snapshot: JSON.stringify(finalSnapshot),
      hugs_count: 0,
      replies_count: 0,
      reports_count: 0,
      is_hidden: 0,
      created_at: now,
      edited_at: null,
    };

    await db.runAsync(
      `INSERT INTO community_posts (
        id, author_user_id, space_id, body, mode, author_snapshot,
        hugs_count, replies_count, reports_count, is_hidden,
        created_at, edited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.author_user_id,
      row.space_id,
      row.body,
      row.mode,
      row.author_snapshot,
      row.hugs_count,
      row.replies_count,
      row.reports_count,
      row.is_hidden,
      row.created_at,
      row.edited_at
    );
    trackWrite();

    return rowToPost(row);
  }

  // ─── POST: READ ─────────────────────────────────────────────────

  /**
   * Fetch a single post by ID. Returns null if not found or hidden
   * (unless includeHidden is true).
   */
  async getPost(postId: string, includeHidden = false): Promise<CommunityPost | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<CommunityPostRow>(
      'SELECT * FROM community_posts WHERE id = ?',
      postId
    );
    trackQuery(Date.now() - start);
    if (!row) return null;
    if (!includeHidden && row.is_hidden === 1) return null;
    return rowToPost(row);
  }

  /**
   * Fetch posts for the feed with optional space filter + pagination.
   *
   * Pagination uses a `beforeTimestamp` cursor (not OFFSET) because
   * OFFSET on a large table is slow AND can cause duplicate/missing
   * rows when new posts arrive between page loads. Cursor pagination
   * is stable.
   */
  async getFeed(query: FeedQuery): Promise<CommunityPost[]> {
    const start = Date.now();
    const db = await this.getDb();
    const limit = query.limit ?? FEED_PAGE_SIZE;

    let sql = `SELECT * FROM community_posts WHERE 1=1`;
    const params: (string | number)[] = [];

    if (query.spaceId !== 'all') {
      sql += ` AND space_id = ?`;
      params.push(query.spaceId);
    }

    if (!query.includeHidden) {
      sql += ` AND is_hidden = 0`;
    }

    if (query.beforeTimestamp) {
      sql += ` AND created_at < ?`;
      params.push(query.beforeTimestamp);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await db.getAllAsync<CommunityPostRow>(sql, ...params);
    trackQuery(Date.now() - start);
    return rows.map(rowToPost);
  }

  /**
   * Count of posts authored by this user — feeds anonymous credibility.
   */
  async getUserPostCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM community_posts WHERE author_user_id = ?',
      userId
    );
    return row?.n ?? 0;
  }

  // ─── REPLIES: CREATE ────────────────────────────────────────────

  /**
   * Create a reply to a post. Bumps the post's replies_count in the
   * same transaction so feed previews stay accurate.
   */
  async createReply(input: CreateReplyRepoInput): Promise<CommunityReply> {
    const id = generateReplyId();
    const now = new Date().toISOString();

    const finalSnapshot = input.mode === 'anonymous'
      ? ensureAnonymousAlias(input.authorSnapshot, id)
      : input.authorSnapshot;

    const row: CommunityReplyRow = {
      id,
      post_id: input.postId,
      author_user_id: input.authorUserId,
      body: input.body.trim(),
      mode: input.mode,
      author_snapshot: JSON.stringify(finalSnapshot),
      hugs_count: 0,
      reports_count: 0,
      is_hidden: 0,
      created_at: now,
      edited_at: null,
    };

    // We need ensureTables to have run before withTransaction kicks off,
    // because withTransaction skips our ensureTables() init in getDb().
    await this.getDb();

    await withTransaction(async db => {
      await db.runAsync(
        `INSERT INTO community_replies (
          id, post_id, author_user_id, body, mode, author_snapshot,
          hugs_count, reports_count, is_hidden, created_at, edited_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.post_id,
        row.author_user_id,
        row.body,
        row.mode,
        row.author_snapshot,
        row.hugs_count,
        row.reports_count,
        row.is_hidden,
        row.created_at,
        row.edited_at
      );

      await db.runAsync(
        `UPDATE community_posts SET replies_count = replies_count + 1 WHERE id = ?`,
        input.postId
      );
      trackWrite();
    });

    return rowToReply(row);
  }

  // ─── REPLIES: READ ──────────────────────────────────────────────

  /**
   * Get all replies on a post (oldest first — preserves conversation flow).
   */
  async getRepliesForPost(
    postId: string,
    includeHidden = false
  ): Promise<CommunityReply[]> {
    const start = Date.now();
    const db = await this.getDb();
    const sql = includeHidden
      ? `SELECT * FROM community_replies WHERE post_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM community_replies WHERE post_id = ? AND is_hidden = 0 ORDER BY created_at ASC`;
    const rows = await db.getAllAsync<CommunityReplyRow>(sql, postId);
    trackQuery(Date.now() - start);
    return rows.map(rowToReply);
  }

  /**
   * Count of replies authored by this user — feeds credibility strip.
   */
  async getUserReplyCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM community_replies WHERE author_user_id = ?',
      userId
    );
    return row?.n ?? 0;
  }

  // ─── HUGS ───────────────────────────────────────────────────────

  /**
   * Toggle a hug on a post or reply.
   *
   * Idempotent design: if the user already hugged this target, remove
   * the hug (un-hug). Otherwise add it. Either way the target's
   * hugs_count is updated transactionally.
   *
   * @returns The new hug state (true = hugged, false = not hugged)
   */
  async toggleHug(
    targetType: 'post' | 'reply',
    targetId: string,
    userId: string
  ): Promise<{ hugged: boolean; newCount: number }> {
    await this.getDb(); // ensure tables exist

    let hugged = false;
    let newCount = 0;

    await withTransaction(async db => {
      const existing = await db.getFirstAsync<CommunityHugRow>(
        `SELECT * FROM community_hugs WHERE target_type = ? AND target_id = ? AND user_id = ?`,
        targetType,
        targetId,
        userId
      );

      const targetTable = targetType === 'post' ? 'community_posts' : 'community_replies';

      if (existing) {
        // Un-hug
        await db.runAsync(`DELETE FROM community_hugs WHERE id = ?`, existing.id);
        await db.runAsync(
          `UPDATE ${targetTable} SET hugs_count = MAX(hugs_count - 1, 0) WHERE id = ?`,
          targetId
        );
        hugged = false;
      } else {
        // Hug
        await db.runAsync(
          `INSERT INTO community_hugs (id, target_type, target_id, user_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          generateHugId(),
          targetType,
          targetId,
          userId,
          new Date().toISOString()
        );
        await db.runAsync(
          `UPDATE ${targetTable} SET hugs_count = hugs_count + 1 WHERE id = ?`,
          targetId
        );
        hugged = true;
      }

      const countRow = await db.getFirstAsync<{ hugs_count: number }>(
        `SELECT hugs_count FROM ${targetTable} WHERE id = ?`,
        targetId
      );
      newCount = countRow?.hugs_count ?? 0;
      trackWrite();
    });

    return { hugged, newCount };
  }

  /**
   * Get the set of post/reply IDs the user has hugged.
   * Used by feed rendering to show "you hugged this" state.
   */
  async getHuggedTargetIds(
    userId: string,
    targetType: 'post' | 'reply'
  ): Promise<Set<string>> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ target_id: string }>(
      `SELECT target_id FROM community_hugs WHERE user_id = ? AND target_type = ?`,
      userId,
      targetType
    );
    return new Set(rows.map(r => r.target_id));
  }

  // ─── REPORTS ────────────────────────────────────────────────────

  /**
   * Submit a report. Idempotent — re-reporting the same target by the
   * same user is a no-op. Auto-hides the target if report threshold met.
   */
  async submitReport(input: CreateReportRepoInput): Promise<{ submitted: boolean; nowHidden: boolean }> {
    await this.getDb();

    let submitted = false;
    let nowHidden = false;

    await withTransaction(async db => {
      const existing = await db.getFirstAsync<CommunityReportRow>(
        `SELECT * FROM community_reports
         WHERE target_type = ? AND target_id = ? AND reporter_user_id = ?`,
        input.targetType,
        input.targetId,
        input.reporterUserId
      );

      if (existing) {
        // Already reported by this user — silently succeed
        return;
      }

      await db.runAsync(
        `INSERT INTO community_reports (
          id, target_type, target_id, reporter_user_id, reason, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        generateReportId(),
        input.targetType,
        input.targetId,
        input.reporterUserId,
        input.reason,
        input.notes ?? null,
        new Date().toISOString()
      );
      submitted = true;

      const targetTable = input.targetType === 'post' ? 'community_posts' : 'community_replies';

      await db.runAsync(
        `UPDATE ${targetTable} SET reports_count = reports_count + 1 WHERE id = ?`,
        input.targetId
      );

      // Auto-hide check
      const countRow = await db.getFirstAsync<{ reports_count: number; is_hidden: number }>(
        `SELECT reports_count, is_hidden FROM ${targetTable} WHERE id = ?`,
        input.targetId
      );

      if (
        countRow &&
        countRow.is_hidden === 0 &&
        countRow.reports_count >= AUTO_HIDE_THRESHOLD
      ) {
        await db.runAsync(
          `UPDATE ${targetTable} SET is_hidden = 1 WHERE id = ?`,
          input.targetId
        );
        nowHidden = true;
      }

      trackWrite();
    });

    return { submitted, nowHidden };
  }

  /**
   * Get the set of target IDs the user has already reported, so the UI
   * can hide the "report" button on those.
   */
  async getReportedTargetIds(
    userId: string,
    targetType: 'post' | 'reply'
  ): Promise<Set<string>> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ target_id: string }>(
      `SELECT target_id FROM community_reports
       WHERE reporter_user_id = ? AND target_type = ?`,
      userId,
      targetType
    );
    return new Set(rows.map(r => r.target_id));
  }

  // ─── ADMIN / DEBUG ──────────────────────────────────────────────

  /**
   * Total post count across all spaces. Used by debug screens and
   * the "is there content?" check during seeding.
   */
  async getTotalPostCount(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM community_posts'
    );
    return row?.n ?? 0;
  }

  /**
   * Seed sample posts into the local DB for empty-state avoidance.
   *
   * Called once on first community tab open if no posts exist. The
   * seed user IDs match the active local user so the credibility data
   * shown is real (this user's actual streak / xp / badges count).
   */
  async seedSamplePosts(currentUserId: string, samples: SeedPostInput[]): Promise<void> {
    await this.getDb();

    for (const sample of samples) {
      const id = generatePostId();
      const snapshot: AuthorSnapshot = sample.mode === 'anonymous'
        ? {
            mode: 'anonymous',
            displayName: null,
            companionType: null,
            spiritAlias: pickSpiritAlias(id).name,
            spiritEmoji: pickSpiritAlias(id).emoji,
            credibility: sample.credibility ?? null,
          }
        : {
            mode: 'named',
            displayName: sample.displayName ?? 'A Dottie friend',
            companionType: sample.companionType ?? 'blossom',
            spiritAlias: null,
            spiritEmoji: null,
            credibility: null,
          };

      await this.createPost({
        authorUserId: currentUserId,
        spaceId: sample.spaceId,
        body: sample.body,
        mode: sample.mode,
        authorSnapshot: snapshot,
      });
    }
  }
}

// ─── SEED INPUT TYPE ─────────────────────────────────────────────────

export interface SeedPostInput {
  spaceId: SpaceId;
  body: string;
  mode: PostingMode;
  displayName?: string;
  companionType?: CompanionType;
  credibility?: AnonymousCredibility;
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const communityRepository = new CommunityRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToPost(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    spaceId: row.space_id as SpaceId,
    body: row.body,
    mode: row.mode as PostingMode,
    authorSnapshot: safeParseSnapshot(row.author_snapshot),
    hugsCount: row.hugs_count,
    repliesCount: row.replies_count,
    reportsCount: row.reports_count,
    isHidden: row.is_hidden === 1,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

function rowToReply(row: CommunityReplyRow): CommunityReply {
  return {
    id: row.id,
    postId: row.post_id,
    authorUserId: row.author_user_id,
    body: row.body,
    mode: row.mode as PostingMode,
    authorSnapshot: safeParseSnapshot(row.author_snapshot),
    hugsCount: row.hugs_count,
    reportsCount: row.reports_count,
    isHidden: row.is_hidden === 1,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

/**
 * Parse a JSON snapshot column with safe defaults.
 * Old rows might be missing fields if schema evolves — fill defensively.
 */
function safeParseSnapshot(json: string): AuthorSnapshot {
  const defaults: AuthorSnapshot = {
    mode: 'anonymous',
    displayName: null,
    companionType: null,
    spiritAlias: 'Anonymous Blossom',
    spiritEmoji: '🌸',
    credibility: null,
  };
  if (!json) return defaults;
  try {
    const parsed = JSON.parse(json) as Partial<AuthorSnapshot>;
    return {
      mode: parsed.mode ?? defaults.mode,
      displayName: parsed.displayName ?? defaults.displayName,
      companionType: parsed.companionType ?? defaults.companionType,
      spiritAlias: parsed.spiritAlias ?? defaults.spiritAlias,
      spiritEmoji: parsed.spiritEmoji ?? defaults.spiritEmoji,
      credibility: parsed.credibility ?? defaults.credibility,
    };
  } catch {
    return defaults;
  }
}

/**
 * Anonymous posts need the spirit alias keyed by the final row ID for
 * deterministic stability. The store doesn't know the ID yet at compose
 * time, so we re-derive the alias here using the actual post/reply ID.
 */
function ensureAnonymousAlias(snapshot: AuthorSnapshot, rowId: string): AuthorSnapshot {
  const alias = pickSpiritAlias(rowId);
  return {
    ...snapshot,
    mode: 'anonymous',
    displayName: null,
    companionType: null,
    spiritAlias: alias.name,
    spiritEmoji: alias.emoji,
  };
}

// ─── ID GENERATORS ───────────────────────────────────────────────────

function generatePostId(): string {
  return `cp_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateReplyId(): string {
  return `cr_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateHugId(): string {
  return `hg_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateReportId(): string {
  return `rp_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}

// Re-export helper for callers that want it without importing both files
export { ReportReason };