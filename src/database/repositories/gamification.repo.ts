/**
 * Dottie — Gamification Repository
 *
 * Owns the dopamine layer:
 *   - gamification_state   Singleton mirror of StreakState + balances
 *   - xp_transactions      Append-only log of XP awards
 *   - gem_transactions     Append-only log of gem credits/debits
 *   - badges_earned        Unlocked badges
 *   - owned_store_items    Gem store purchases
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - StreakState lives as a single row in gamification_state. Updates
 *    are full-row writes (small enough to not bother diffing).
 *  - XP and gem transactions are append-only so we can show transaction
 *    history and detect anomalies. Balances live denormalized in
 *    gamification_state for fast reads on every home screen render.
 *  - Balance writes are TRANSACTIONAL — the transaction log row and
 *    the gamification_state row update commit together or not at all.
 *    No way to ever desynchronize.
 *
 * ─── HOW THE GAMIFICATION ENGINE PLUGS IN ───────────────────────────
 *
 *  The pure engine functions (streak.processCheckIn, xp.awardXP,
 *  gems.earnGems) accept the current state and return new state +
 *  side-effect intents. This repo accepts those intents and writes
 *  them down.
 *
 *  Engine:                          Repo:
 *    processCheckIn(state, today)   →
 *      { state, milestone, rewards } →  applyStreakResult(userId, result)
 *
 *  This keeps engines pure and lets us swap persistence freely.
 */

import {
  Database,
  getDatabase,
  withTransaction,
  trackQuery,
  trackWrite,
} from '../client';
import {
  GamificationStateRow,
  XpTransactionRow,
  GemTransactionRow,
  BadgeEarnedRow,
  OwnedStoreItemRow,
} from '../schema';
import {
  StreakState,
  GamificationState,
  XPTransaction,
  XPSource,
  GemTransaction,
  GemSource,
  BadgeEarned,
} from '../../types/gamification.types';
import { createInitialStreakState } from '../../engine/gamification/streak';
import { getLevelForXP } from '../../engine/gamification/xp';

// ─── DOMAIN TYPES ────────────────────────────────────────────────────

export interface OwnedItem {
  itemId: string;
  category: string;
  acquiredAt: string;
}

// ─── INPUT TYPES (engine result → repo write) ────────────────────────

/**
 * Mirror of streak.StreakUpdateResult — the pure engine returns this,
 * the repo persists it.
 */
export interface StreakResultInput {
  state: StreakState;
  rewards: { gems: number; xp: number } | null;
  milestone: number | null;
}

/**
 * Mirror of gems.GemEarnResult / GemSpendResult — repo writes the
 * transaction + updates the balance in a single transaction.
 */
export interface GemMutationInput {
  amount: number; // positive = earn, negative = spend
  source: GemSource;
  description: string;
}

export interface XpMutationInput {
  amount: number;
  source: XPSource;
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class GamificationRepository {
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── STATE INITIALIZATION ───────────────────────────────────────

  /**
   * Create the gamification state row for a new user.
   * Called once at onboarding completion, alongside createUser().
   *
   * Uses the streak engine's createInitialStreakState() to stay
   * consistent with the engine's notion of "fresh."
   */
  async initializeState(userId: string): Promise<GamificationState> {
    const initial = createInitialStreakState();
    const now = new Date().toISOString();

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO gamification_state (
        user_id, current_streak, longest_streak, last_check_in_date,
        cramp_freeze_available, cramp_freeze_used_today, xp_total,
        gems_balance, current_level, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      initial.currentStreak,
      initial.longestStreak,
      initial.lastCheckInDate,
      initial.crampFreezeAvailable,
      initial.crampFreezeUsedToday ? 1 : 0,
      0,
      0,
      1,
      now
    );
    trackWrite();

    return {
      streak: initial,
      xpTotal: 0,
      currentLevel: 1,
      gemsBalance: 0,
      badgesEarned: [],
    };
  }

  // ─── STATE READS ────────────────────────────────────────────────

  /**
   * Get the full gamification state for the home screen header.
   * Returns null if the user hasn't been initialized yet.
   */
  async getState(userId: string): Promise<GamificationState | null> {
    const start = Date.now();
    const db = await this.getDb();

    const stateRow = await db.getFirstAsync<GamificationStateRow>(
      'SELECT * FROM gamification_state WHERE user_id = ?',
      userId
    );
    if (!stateRow) {
      trackQuery(Date.now() - start);
      return null;
    }

    const badgeRows = await db.getAllAsync<{ badge_id: string }>(
      'SELECT badge_id FROM badges_earned WHERE user_id = ?',
      userId
    );
    trackQuery(Date.now() - start);

    return {
      streak: rowToStreakState(stateRow),
      xpTotal: stateRow.xp_total,
      currentLevel: stateRow.current_level,
      gemsBalance: stateRow.gems_balance,
      badgesEarned: badgeRows.map(r => r.badge_id),
    };
  }

  /**
   * Just the streak state — used by the streak engine's input.
   */
  async getStreakState(userId: string): Promise<StreakState | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<GamificationStateRow>(
      'SELECT * FROM gamification_state WHERE user_id = ?',
      userId
    );
    return row ? rowToStreakState(row) : null;
  }

  /**
   * Current gem balance only — frequently queried for "can I afford it?"
   * checks throughout the gem store UI.
   */
  async getGemsBalance(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ gems_balance: number }>(
      'SELECT gems_balance FROM gamification_state WHERE user_id = ?',
      userId
    );
    return row?.gems_balance ?? 0;
  }

  /**
   * Current XP total — for level progress display.
   */
  async getXpTotal(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ xp_total: number }>(
      'SELECT xp_total FROM gamification_state WHERE user_id = ?',
      userId
    );
    return row?.xp_total ?? 0;
  }

  // ─── STREAK WRITES ──────────────────────────────────────────────

  /**
   * Persist the result of streak.processCheckIn().
   *
   * Updates the streak state AND if rewards were granted, credits them
   * (XP transaction + gem transaction) atomically in one DB transaction.
   */
  async applyStreakResult(
    userId: string,
    result: StreakResultInput
  ): Promise<GamificationState | null> {
    await withTransaction(async db => {
      const now = new Date().toISOString();

      // Update streak fields
      await db.runAsync(
        `UPDATE gamification_state
         SET current_streak = ?, longest_streak = ?, last_check_in_date = ?,
             cramp_freeze_available = ?, cramp_freeze_used_today = ?,
             updated_at = ?
         WHERE user_id = ?`,
        result.state.currentStreak,
        result.state.longestStreak,
        result.state.lastCheckInDate,
        result.state.crampFreezeAvailable,
        result.state.crampFreezeUsedToday ? 1 : 0,
        now,
        userId
      );
      trackWrite();

      // If milestone reached, write XP + gem transactions and bump balances
      if (result.rewards) {
        if (result.rewards.xp > 0) {
          await this.insertXpTransaction(db, userId, result.rewards.xp, 'streak_milestone');
          await db.runAsync(
            `UPDATE gamification_state SET xp_total = xp_total + ? WHERE user_id = ?`,
            result.rewards.xp,
            userId
          );
        }
        if (result.rewards.gems > 0) {
          const source = milestoneToGemSource(result.milestone ?? 0);
          await this.insertGemTransaction(
            db,
            userId,
            result.rewards.gems,
            source,
            `Streak milestone: ${result.milestone} days`
          );
          await db.runAsync(
            `UPDATE gamification_state SET gems_balance = gems_balance + ? WHERE user_id = ?`,
            result.rewards.gems,
            userId
          );
        }

        // Recompute level after XP bump
        await this.recomputeLevel(db, userId);
      }
    });

    return this.getState(userId);
  }

  /**
   * Persist a Cramp Freeze use (streak.useCrampFreeze result).
   * Updates streak state in place — no rewards involved.
   */
  async applyCrampFreezeResult(
    userId: string,
    newState: StreakState
  ): Promise<GamificationState | null> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE gamification_state
       SET last_check_in_date = ?, cramp_freeze_available = ?,
           cramp_freeze_used_today = ?, updated_at = ?
       WHERE user_id = ?`,
      newState.lastCheckInDate,
      newState.crampFreezeAvailable,
      newState.crampFreezeUsedToday ? 1 : 0,
      new Date().toISOString(),
      userId
    );
    trackWrite();
    return this.getState(userId);
  }

  /**
   * Reset cramp_freeze_used_today flag at midnight. Idempotent.
   */
  async resetDailyFlags(userId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE gamification_state
       SET cramp_freeze_used_today = 0, updated_at = ?
       WHERE user_id = ?`,
      new Date().toISOString(),
      userId
    );
    trackWrite();
  }

  // ─── XP MUTATIONS ───────────────────────────────────────────────

  /**
   * Award XP from any source. Writes the transaction AND bumps
   * xp_total + current_level (if level changed) in one DB transaction.
   *
   * Returns the new balance + whether the user leveled up.
   */
  async awardXp(
    userId: string,
    mutation: XpMutationInput
  ): Promise<{
    newTotal: number;
    leveledUp: boolean;
    newLevel: number;
    previousLevel: number;
  }> {
    let previousLevel = 1;
    let newTotal = 0;
    let newLevel = 1;

    await withTransaction(async db => {
      const currentRow = await db.getFirstAsync<{
        xp_total: number;
        current_level: number;
      }>('SELECT xp_total, current_level FROM gamification_state WHERE user_id = ?', userId);

      const currentXp = currentRow?.xp_total ?? 0;
      previousLevel = currentRow?.current_level ?? 1;

      // Insert transaction
      await this.insertXpTransaction(db, userId, mutation.amount, mutation.source);

      // Bump total
      newTotal = currentXp + mutation.amount;
      const computedLevel = getLevelForXP(newTotal).level;
      newLevel = computedLevel;

      await db.runAsync(
        `UPDATE gamification_state
         SET xp_total = ?, current_level = ?, updated_at = ?
         WHERE user_id = ?`,
        newTotal,
        computedLevel,
        new Date().toISOString(),
        userId
      );
      trackWrite();
    });

    return {
      newTotal,
      leveledUp: newLevel > previousLevel,
      newLevel,
      previousLevel,
    };
  }

  /**
   * Get recent XP transactions for analytics / profile detail view.
   */
  async getXpTransactions(
    userId: string,
    limit: number = 50
  ): Promise<XPTransaction[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<XpTransactionRow>(
      `SELECT * FROM xp_transactions
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      userId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToXpTransaction);
  }

  // ─── GEM MUTATIONS ──────────────────────────────────────────────

  /**
   * Apply a gem mutation (earn or spend). Writes the transaction +
   * updates balance atomically.
   *
   * For spends, the caller should have already checked that the user
   * has enough gems — this method doesn't enforce non-negative balances
   * (the gem engine's spendGems() does that).
   *
   * @returns The new balance after the mutation.
   */
  async applyGemMutation(
    userId: string,
    mutation: GemMutationInput
  ): Promise<number> {
    let newBalance = 0;

    await withTransaction(async db => {
      await this.insertGemTransaction(
        db,
        userId,
        mutation.amount,
        mutation.source,
        mutation.description
      );

      // amount is signed (positive for earn, negative for spend)
      await db.runAsync(
        `UPDATE gamification_state
         SET gems_balance = gems_balance + ?, updated_at = ?
         WHERE user_id = ?`,
        mutation.amount,
        new Date().toISOString(),
        userId
      );
      trackWrite();

      const row = await db.getFirstAsync<{ gems_balance: number }>(
        'SELECT gems_balance FROM gamification_state WHERE user_id = ?',
        userId
      );
      newBalance = row?.gems_balance ?? 0;
    });

    return newBalance;
  }

  /**
   * Get recent gem transactions for the profile's transaction history.
   */
  async getGemTransactions(
    userId: string,
    limit: number = 50
  ): Promise<GemTransaction[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<GemTransactionRow>(
      `SELECT * FROM gem_transactions
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      userId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToGemTransaction);
  }

  // ─── BADGES ─────────────────────────────────────────────────────

  /**
   * Unlock a badge for the user. Idempotent — unlocking an
   * already-earned badge is a no-op (returns false).
   *
   * Returns true if this was a fresh unlock, false if already earned.
   */
  async unlockBadge(
    userId: string,
    badgeId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    const db = await this.getDb();
    const existing = await db.getFirstAsync<BadgeEarnedRow>(
      'SELECT * FROM badges_earned WHERE user_id = ? AND badge_id = ?',
      userId,
      badgeId
    );
    if (existing) return false;

    await db.runAsync(
      `INSERT INTO badges_earned (id, user_id, badge_id, earned_at, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      generateBadgeId(),
      userId,
      badgeId,
      new Date().toISOString(),
      JSON.stringify(metadata)
    );
    trackWrite();
    return true;
  }

  /**
   * Get all badges the user has earned (by ID).
   */
  async getEarnedBadgeIds(userId: string): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ badge_id: string }>(
      'SELECT badge_id FROM badges_earned WHERE user_id = ?',
      userId
    );
    return rows.map(r => r.badge_id);
  }

  /**
   * Get badges with full metadata + earned-at timestamps.
   * Used by the profile screen for badge display ordering.
   */
  async getEarnedBadges(userId: string): Promise<BadgeEarned[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<BadgeEarnedRow>(
      `SELECT * FROM badges_earned WHERE user_id = ? ORDER BY earned_at DESC`,
      userId
    );
    return rows.map(rowToBadgeEarned);
  }

  // ─── OWNED STORE ITEMS ──────────────────────────────────────────

  /**
   * Record that the user owns a store item (called after spendGems
   * succeeds for a non-consumable item).
   */
  async addOwnedItem(
    userId: string,
    itemId: string,
    category: string
  ): Promise<void> {
    const db = await this.getDb();
    // Check for existing — UNIQUE constraint would throw otherwise
    const existing = await db.getFirstAsync<OwnedStoreItemRow>(
      'SELECT * FROM owned_store_items WHERE user_id = ? AND item_id = ?',
      userId,
      itemId
    );
    if (existing) return;

    await db.runAsync(
      `INSERT INTO owned_store_items (id, user_id, item_id, item_category, acquired_at)
       VALUES (?, ?, ?, ?, ?)`,
      generateOwnedItemId(),
      userId,
      itemId,
      category,
      new Date().toISOString()
    );
    trackWrite();
  }

  /**
   * Get all item IDs the user owns.
   */
  async getOwnedItemIds(userId: string): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ item_id: string }>(
      'SELECT item_id FROM owned_store_items WHERE user_id = ?',
      userId
    );
    return rows.map(r => r.item_id);
  }

  /**
   * Get full owned item details (used by the inventory screen).
   */
  async getOwnedItems(userId: string): Promise<OwnedItem[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OwnedStoreItemRow>(
      `SELECT * FROM owned_store_items WHERE user_id = ? ORDER BY acquired_at DESC`,
      userId
    );
    return rows.map(r => ({
      itemId: r.item_id,
      category: r.item_category,
      acquiredAt: r.acquired_at,
    }));
  }

  // ─── INTERNAL HELPERS ───────────────────────────────────────────

  /**
   * Insert an XP transaction row. Called from inside transactions —
   * NEVER call directly without a surrounding withTransaction().
   */
  private async insertXpTransaction(
    db: Database,
    userId: string,
    amount: number,
    source: XPSource
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO xp_transactions (id, user_id, amount, source, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      generateXpTxnId(),
      userId,
      amount,
      source,
      new Date().toISOString()
    );
  }

  /**
   * Insert a gem transaction row. Called from inside transactions.
   */
  private async insertGemTransaction(
    db: Database,
    userId: string,
    amount: number,
    source: GemSource,
    description: string
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO gem_transactions (id, user_id, amount, source, description, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      generateGemTxnId(),
      userId,
      amount,
      source,
      description,
      new Date().toISOString()
    );
  }

  /**
   * Recompute current_level from xp_total. Called after any XP mutation.
   */
  private async recomputeLevel(db: Database, userId: string): Promise<void> {
    const row = await db.getFirstAsync<{ xp_total: number }>(
      'SELECT xp_total FROM gamification_state WHERE user_id = ?',
      userId
    );
    const xp = row?.xp_total ?? 0;
    const level = getLevelForXP(xp).level;
    await db.runAsync(
      `UPDATE gamification_state SET current_level = ? WHERE user_id = ?`,
      level,
      userId
    );
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const gamificationRepository = new GamificationRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToStreakState(row: GamificationStateRow): StreakState {
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastCheckInDate: row.last_check_in_date,
    crampFreezeAvailable: row.cramp_freeze_available,
    crampFreezeUsedToday: row.cramp_freeze_used_today === 1,
  };
}

function rowToXpTransaction(row: XpTransactionRow): XPTransaction {
  return {
    amount: row.amount,
    source: row.source as XPSource,
    timestamp: row.timestamp,
  };
}

function rowToGemTransaction(row: GemTransactionRow): GemTransaction {
  return {
    amount: row.amount,
    source: row.source as GemSource,
    timestamp: row.timestamp,
    description: row.description ?? '',
  };
}

function rowToBadgeEarned(row: BadgeEarnedRow): BadgeEarned {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    badgeId: row.badge_id,
    earnedAt: row.earned_at,
    metadata,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * Map a streak milestone count to the right GemSource enum value.
 * Used so the transaction log has a meaningful source field.
 */
function milestoneToGemSource(milestone: number): GemSource {
  if (milestone >= 100) return 'streak_milestone_100';
  if (milestone >= 30) return 'streak_milestone_30';
  if (milestone >= 7) return 'streak_milestone_7';
  return 'streak_milestone_7'; // Fallback
}

function generateXpTxnId(): string {
  return `xp_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateGemTxnId(): string {
  return `gm_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateBadgeId(): string {
  return `bd_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateOwnedItemId(): string {
  return `oi_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
}