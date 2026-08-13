/**
 * Dottie — User Repository
 *
 * Owns CRUD for the `users` table — the singleton local user row that
 * holds their mode, health profile, and identity. Also owns the
 * `companion_state` table (1:1 with the user).
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - All methods async; never block the UI thread on SQLite I/O.
 *  - Returns clean DOMAIN types (HealthProfile, UserMode), never raw rows.
 *  - JSON fields (health_conditions, unlocked_outfits) are parsed/
 *    stringified inside the repo so callers never see escaped JSON.
 *  - The repo NEVER touches MMKV — that's the store's job. The store
 *    is responsible for mirroring user.id into Storage.currentUserId
 *    after createUser() returns.
 *
 * ─── ID GENERATION ──────────────────────────────────────────────────
 *
 *  We generate UUIDs locally without a uuid package. The format
 *  `${prefix}_${timestamp}_${random}` is collision-safe at this scale
 *  and human-debuggable (you can tell what created an ID at a glance).
 */

import {
  Database,
  getDatabase,
  withTransaction,
  trackQuery,
  trackWrite,
} from '../client';
import {
  UserRow,
  CompanionStateRow,
} from '../schema';
import {
  HealthProfile,
  HealthCondition,
  UserMode,
} from '../../types/cycle.types';
import {
  CompanionType,
  CompanionConfig,
  OutfitSlot,
} from '../../types/companion.types';

// ─── DOMAIN TYPES (what callers receive) ─────────────────────────────

/**
 * The full user record, as the rest of the app sees it.
 * Combines the users row with HealthProfile-shaped fields.
 */
export interface UserRecord {
  id: string;
  mode: UserMode;
  displayName: string | null;
  healthProfile: HealthProfile;
  ghostPinHash: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * What `createUser` needs to spin up a new local user.
 * Most fields are optional and default sensibly.
 */
export interface CreateUserInput {
  mode: UserMode;
  displayName?: string;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  activityLevel?: 'sedentary' | 'moderate' | 'active' | null;
  healthConditions?: HealthCondition[];
  averageCycleLength?: number | null;
  averagePeriodLength?: number | null;
  onMedications?: boolean;
}

/** Patch shape for updateUser — every field optional. */
export interface UpdateUserInput {
  mode?: UserMode;
  displayName?: string | null;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  activityLevel?: 'sedentary' | 'moderate' | 'active' | null;
  healthConditions?: HealthCondition[];
  averageCycleLength?: number | null;
  averagePeriodLength?: number | null;
  onMedications?: boolean;
  ghostPinHash?: string | null;
}

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class UserRepository {
  /**
   * The repo can be constructed eagerly — `getDb()` is lazy so the
   * actual database open is deferred to first query.
   */
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── USER CRUD ──────────────────────────────────────────────────

  /**
   * Create a new local user. Returns the created UserRecord.
   *
   * This is called ONCE on first onboarding completion. The store layer
   * is responsible for then calling `Storage.currentUserId.set(user.id)`
   * so subsequent app opens can find the active user without a query.
   */
  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const id = generateUserId();
    const now = new Date().toISOString();

    const row: UserRow = {
      id,
      mode: input.mode,
      display_name: input.displayName ?? null,
      age: input.age ?? null,
      weight_kg: input.weightKg ?? null,
      height_cm: input.heightCm ?? null,
      activity_level: input.activityLevel ?? null,
      health_conditions: JSON.stringify(input.healthConditions ?? []),
      average_cycle_length: input.averageCycleLength ?? null,
      average_period_length: input.averagePeriodLength ?? null,
      on_medications: input.onMedications ? 1 : 0,
      ghost_pin_hash: null,
      created_at: now,
      updated_at: now,
    };

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO users (
        id, mode, display_name, age, weight_kg, height_cm,
        activity_level, health_conditions, average_cycle_length,
        average_period_length, on_medications, ghost_pin_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.mode,
      row.display_name,
      row.age,
      row.weight_kg,
      row.height_cm,
      row.activity_level,
      row.health_conditions,
      row.average_cycle_length,
      row.average_period_length,
      row.on_medications,
      row.ghost_pin_hash,
      row.created_at,
      row.updated_at
    );
    trackWrite();

    return rowToUserRecord(row);
  }

  /**
   * Get the user by ID. Returns null if not found (e.g., DB freshly wiped).
   */
  async getUser(userId: string): Promise<UserRecord | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<UserRow>(
      'SELECT * FROM users WHERE id = ?',
      userId
    );
    trackQuery(Date.now() - start);
    return row ? rowToUserRecord(row) : null;
  }

  /**
   * Get the "current" user — assumes there's only one local user (true
   * for Dottie). Returns the first one found, or null if no users exist.
   *
   * Useful as a fallback when MMKV's currentUserId is stale or missing.
   */
  async getCurrentUser(): Promise<UserRecord | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<UserRow>(
      'SELECT * FROM users ORDER BY created_at ASC LIMIT 1'
    );
    trackQuery(Date.now() - start);
    return row ? rowToUserRecord(row) : null;
  }

  /**
   * Apply a partial update to the user. Only the fields you pass are
   * written; everything else stays untouched.
   *
   * Returns the freshly-fetched UserRecord post-update.
   */
  async updateUser(
    userId: string,
    patch: UpdateUserInput
  ): Promise<UserRecord | null> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    // Build dynamic SET clause from non-undefined patch fields
    if (patch.mode !== undefined) {
      updates.push('mode = ?');
      values.push(patch.mode);
    }
    if (patch.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(patch.displayName);
    }
    if (patch.age !== undefined) {
      updates.push('age = ?');
      values.push(patch.age);
    }
    if (patch.weightKg !== undefined) {
      updates.push('weight_kg = ?');
      values.push(patch.weightKg);
    }
    if (patch.heightCm !== undefined) {
      updates.push('height_cm = ?');
      values.push(patch.heightCm);
    }
    if (patch.activityLevel !== undefined) {
      updates.push('activity_level = ?');
      values.push(patch.activityLevel);
    }
    if (patch.healthConditions !== undefined) {
      updates.push('health_conditions = ?');
      values.push(JSON.stringify(patch.healthConditions));
    }
    if (patch.averageCycleLength !== undefined) {
      updates.push('average_cycle_length = ?');
      values.push(patch.averageCycleLength);
    }
    if (patch.averagePeriodLength !== undefined) {
      updates.push('average_period_length = ?');
      values.push(patch.averagePeriodLength);
    }
    if (patch.onMedications !== undefined) {
      updates.push('on_medications = ?');
      values.push(patch.onMedications ? 1 : 0);
    }
    if (patch.ghostPinHash !== undefined) {
      updates.push('ghost_pin_hash = ?');
      values.push(patch.ghostPinHash);
    }

    // Always bump updated_at
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    // Nothing to update? Just return the user as-is.
    if (updates.length === 1) {
      return this.getUser(userId);
    }

    values.push(userId);
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );
    trackWrite();

    return this.getUser(userId);
  }

  /**
   * Delete the user AND all their data (cascades through foreign keys).
   *
   * This is the nuclear option — backs the "Delete all my data" privacy
   * action. The store layer should clear MMKV's onboarding state too.
   */
  async deleteUser(userId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM users WHERE id = ?', userId);
    trackWrite();
  }

  /**
   * Count of users on this device. Should always be 0 or 1 for Dottie.
   * Useful for debugging "why is my onboarding redirect wrong?"
   */
  async getUserCount(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM users'
    );
    return row?.n ?? 0;
  }

  // ─── COMPANION STATE (1:1 with user) ────────────────────────────

  /**
   * Get the user's companion configuration.
   * Returns null if not yet set (during onboarding before companion pick).
   */
  async getCompanionConfig(userId: string): Promise<CompanionConfig | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<CompanionStateRow>(
      'SELECT * FROM companion_state WHERE user_id = ?',
      userId
    );
    trackQuery(Date.now() - start);
    return row ? rowToCompanionConfig(row) : null;
  }

  /**
   * Set the user's companion type (called once during onboarding).
   * Initializes equipped outfits as all null and unlocked outfits as empty.
   *
   * Upsert behavior: if a row exists, update only the companion_type
   * (preserves any unlocked outfits and equipped pieces).
   */
  async setCompanionType(
    userId: string,
    companionType: CompanionType
  ): Promise<CompanionConfig> {
    const now = new Date().toISOString();
    const db = await this.getDb();

    const existing = await db.getFirstAsync<CompanionStateRow>(
      'SELECT * FROM companion_state WHERE user_id = ?',
      userId
    );

    if (existing) {
      await db.runAsync(
        `UPDATE companion_state SET companion_type = ?, updated_at = ? WHERE user_id = ?`,
        companionType,
        now,
        userId
      );
    } else {
      await db.runAsync(
        `INSERT INTO companion_state (
          user_id, companion_type, equipped_hat, equipped_scarf,
          equipped_background, equipped_effect, equipped_accessory,
          unlocked_outfits, updated_at
        ) VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, '[]', ?)`,
        userId,
        companionType,
        now
      );
    }
    trackWrite();

    // Return fresh state
    const fresh = await this.getCompanionConfig(userId);
    return (
      fresh ?? {
        type: companionType,
        equippedOutfits: emptyEquippedOutfits(),
        unlockedOutfits: [],
      }
    );
  }

  /**
   * Equip an outfit in a slot. Pass null to unequip.
   * Caller is responsible for verifying the outfit is owned.
   */
  async equipOutfit(
    userId: string,
    slot: OutfitSlot,
    outfitId: string | null
  ): Promise<CompanionConfig | null> {
    const column = slotToColumn(slot);
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE companion_state SET ${column} = ?, updated_at = ? WHERE user_id = ?`,
      outfitId,
      new Date().toISOString(),
      userId
    );
    trackWrite();
    return this.getCompanionConfig(userId);
  }

  /**
   * Add an outfit to the user's unlocked list (called after a gem purchase).
   * Idempotent — adding an already-unlocked outfit is a no-op.
   *
   * Also handled in a transaction so the unlocked_outfits update is
   * atomic relative to any other concurrent companion mutation.
   */
  async unlockOutfit(userId: string, outfitId: string): Promise<CompanionConfig | null> {
    await withTransaction(async db => {
      const row = await db.getFirstAsync<CompanionStateRow>(
        'SELECT * FROM companion_state WHERE user_id = ?',
        userId
      );
      if (!row) return;

      const unlocked = safeJsonArray(row.unlocked_outfits);
      if (unlocked.includes(outfitId)) return;

      unlocked.push(outfitId);
      await db.runAsync(
        `UPDATE companion_state SET unlocked_outfits = ?, updated_at = ? WHERE user_id = ?`,
        JSON.stringify(unlocked),
        new Date().toISOString(),
        userId
      );
      trackWrite();
    });

    return this.getCompanionConfig(userId);
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

/**
 * The default repo instance. Most callers should import this.
 * Tests can `new UserRepository()` to get a fresh instance.
 */
export const userRepository = new UserRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    mode: row.mode,
    displayName: row.display_name,
    healthProfile: rowToHealthProfile(row),
    ghostPinHash: row.ghost_pin_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHealthProfile(row: UserRow): HealthProfile {
  return {
    age: row.age,
    mode: row.mode,
    conditions: safeJsonArray<HealthCondition>(row.health_conditions),
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    activityLevel: row.activity_level,
    averageCycleLength: row.average_cycle_length,
    averagePeriodLength: row.average_period_length,
    onMedications: row.on_medications === 1,
  };
}

function rowToCompanionConfig(row: CompanionStateRow): CompanionConfig {
  return {
    type: row.companion_type,
    equippedOutfits: {
      hat: row.equipped_hat,
      scarf: row.equipped_scarf,
      background: row.equipped_background,
      effect: row.equipped_effect,
      accessory: row.equipped_accessory,
    },
    unlockedOutfits: safeJsonArray<string>(row.unlocked_outfits),
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function generateUserId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(5, '0');
  return `usr_${ts}_${rand}`;
}

/**
 * Parse a JSON array column, returning [] on missing/invalid data.
 * Used everywhere we store JSON columns.
 */
function safeJsonArray<T = string>(json: string | null): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function slotToColumn(slot: OutfitSlot): string {
  switch (slot) {
    case 'hat':
      return 'equipped_hat';
    case 'scarf':
      return 'equipped_scarf';
    case 'background':
      return 'equipped_background';
    case 'effect':
      return 'equipped_effect';
    case 'accessory':
      return 'equipped_accessory';
  }
}

function emptyEquippedOutfits(): Record<OutfitSlot, string | null> {
  return {
    hat: null,
    scarf: null,
    background: null,
    effect: null,
    accessory: null,
  };
}