/**
 * Dottie — Sisterhood Repository
 *
 * Owns every table in the sisterhood plane (schema v2):
 *   - sisterhood_circles
 *   - sisterhood_members
 *   - shadow_cycle_entries
 *   - shadow_check_ins
 *   - care_nudges
 *   - phase_sync_events
 *   - profile_transfer_codes
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Same pattern as community.repo / cycle.repo: domain types in,
 *    domain types out. Raw rows never leak.
 *  - JSON column for shadow_context — schema-on-read keeps the column
 *    flexible as the shadow profile shape evolves.
 *  - Privacy enforcement lives in the ENGINE, not the repo. The repo
 *    returns raw member + shadow data; the engine projects that down
 *    to a privacy-filtered MemberView. This separation lets future
 *    sync layers reuse the engine without duplicating filtering logic.
 *  - Singleton circle per primary user (the schema enforces UNIQUE on
 *    primary_user_id), so getOrCreateCircle() is the typical entry point.
 */

import {
  Database,
  getDatabase,
  withTransaction,
  trackQuery,
  trackWrite,
} from '../client';
import {
  SisterhoodCircleRow,
  SisterhoodMemberRow,
  ShadowCycleEntryRow,
  ShadowCheckInRow,
  CareNudgeRow,
  PhaseSyncEventRow,
  ProfileTransferCodeRow,
} from '../schema';
import {
  SisterhoodCircle,
  SisterhoodMember,
  ShadowCycleEntry,
  ShadowCheckIn,
  CareNudge,
  PhaseSyncEvent,
  ProfileTransferCode,
  ShadowContext,
  PrivacyLevel,
  MemberKind,
  AddMemberInput,
  UpdateMemberInput,
  LogShadowPeriodInput,
  LogShadowCheckInInput,
  DEFAULT_CIRCLE_NAME,
  defaultMemberEmoji,
} from '../../types/sisterhood.types';
import { Phase } from '../../types/cycle.types';
import { prevDay } from '../../utils/civil-date';

// ─── REPOSITORY CLASS ────────────────────────────────────────────────

export class SisterhoodRepository {
  private async getDb(): Promise<Database> {
    return getDatabase();
  }

  // ─── CIRCLE ─────────────────────────────────────────────────────

  /**
   * Get the user's circle. Returns null if they don't have one yet.
   * Use `getOrCreateCircle` if you want auto-creation.
   */
  async getCircle(primaryUserId: string): Promise<SisterhoodCircle | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<SisterhoodCircleRow>(
      'SELECT * FROM sisterhood_circles WHERE primary_user_id = ?',
      primaryUserId
    );
    trackQuery(Date.now() - start);
    return row ? rowToCircle(row) : null;
  }

  /**
   * Get-or-create the circle for the primary user. Idempotent.
   * The schema's UNIQUE constraint guarantees one circle per user.
   */
  async getOrCreateCircle(primaryUserId: string): Promise<SisterhoodCircle> {
    const existing = await this.getCircle(primaryUserId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const row: SisterhoodCircleRow = {
      id: generateCircleId(),
      primary_user_id: primaryUserId,
      name: DEFAULT_CIRCLE_NAME,
      created_at: now,
      last_activity_at: now,
    };

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO sisterhood_circles (id, primary_user_id, name, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?)`,
      row.id,
      row.primary_user_id,
      row.name,
      row.created_at,
      row.last_activity_at
    );
    trackWrite();
    return rowToCircle(row);
  }

  /** Rename the circle. */
  async renameCircle(circleId: string, newName: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE sisterhood_circles SET name = ? WHERE id = ?',
      newName,
      circleId
    );
    trackWrite();
  }

  /** Internal: bump the circle's last_activity_at timestamp. */
  private async touchCircle(circleId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE sisterhood_circles SET last_activity_at = ? WHERE id = ?',
      new Date().toISOString(),
      circleId
    );
  }

  // ─── MEMBERS ────────────────────────────────────────────────────

  /**
   * Add a member to the circle.
   *
   * Shadow members get the `shadow_context_json` populated; linked
   * members carry null there.
   */
  async addMember(
    circleId: string,
    input: AddMemberInput
  ): Promise<SisterhoodMember> {
    const now = new Date().toISOString();
    const memberId = generateMemberId();
    const emoji = input.emoji ?? defaultMemberEmoji(input.kind);

    const row: SisterhoodMemberRow = {
      id: memberId,
      circle_id: circleId,
      linked_user_id: null, // future: populated when a linked invite is accepted
      display_name: input.displayName,
      emoji,
      relationship: input.relationship,
      kind: input.kind,
      privacy_level: input.privacyLevel,
      shadow_context_json:
        input.kind === 'shadow' && input.shadowContext
          ? JSON.stringify(input.shadowContext)
          : null,
      added_at: now,
      last_active_at: null,
    };

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO sisterhood_members (
        id, circle_id, linked_user_id, display_name, emoji, relationship,
        kind, privacy_level, shadow_context_json, added_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.circle_id,
      row.linked_user_id,
      row.display_name,
      row.emoji,
      row.relationship,
      row.kind,
      row.privacy_level,
      row.shadow_context_json,
      row.added_at,
      row.last_active_at
    );
    trackWrite();
    await this.touchCircle(circleId);
    return rowToMember(row);
  }

  /** List all members in the circle, ordered by added_at ASC (oldest first). */
  async listMembers(circleId: string): Promise<SisterhoodMember[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<SisterhoodMemberRow>(
      `SELECT * FROM sisterhood_members
       WHERE circle_id = ?
       ORDER BY added_at ASC`,
      circleId
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToMember);
  }

  /** Get a single member by ID, or null if not found. */
  async getMember(memberId: string): Promise<SisterhoodMember | null> {
    const start = Date.now();
    const db = await this.getDb();
    const row = await db.getFirstAsync<SisterhoodMemberRow>(
      'SELECT * FROM sisterhood_members WHERE id = ?',
      memberId
    );
    trackQuery(Date.now() - start);
    return row ? rowToMember(row) : null;
  }

  /**
   * Apply a partial update to a member. Only fields you pass are written.
   *
   * shadow_context updates MERGE rather than replace — pass a partial
   * patch and it'll be deep-merged with the existing context.
   */
  async updateMember(
    memberId: string,
    patch: UpdateMemberInput
  ): Promise<SisterhoodMember | null> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(patch.displayName);
    }
    if (patch.emoji !== undefined) {
      updates.push('emoji = ?');
      values.push(patch.emoji);
    }
    if (patch.relationship !== undefined) {
      updates.push('relationship = ?');
      values.push(patch.relationship);
    }
    if (patch.privacyLevel !== undefined) {
      updates.push('privacy_level = ?');
      values.push(patch.privacyLevel);
    }

    // Shadow context merge
    if (patch.shadowContext !== undefined) {
      const existing = await this.getMember(memberId);
      if (!existing) return null;
      const merged: ShadowContext = {
        ...((existing.shadowContext as ShadowContext) ?? emptyShadowContext()),
        ...patch.shadowContext,
      };
      updates.push('shadow_context_json = ?');
      values.push(JSON.stringify(merged));
    }

    if (updates.length === 0) {
      return this.getMember(memberId);
    }

    values.push(memberId);
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE sisterhood_members SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );
    trackWrite();
    return this.getMember(memberId);
  }

  /** Update last_active_at when shadow data is logged. */
  async touchMember(memberId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE sisterhood_members SET last_active_at = ? WHERE id = ?',
      new Date().toISOString(),
      memberId
    );
  }

  /**
   * Remove a member and all their shadow data (cascades through FKs).
   * Used both by "remove from circle" AND by the transfer-claim flow
   * (after a shadow's data is successfully claimed on a new device).
   */
  async removeMember(memberId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM sisterhood_members WHERE id = ?', memberId);
    trackWrite();
  }

  // ─── SHADOW CYCLE ENTRIES ───────────────────────────────────────

  /**
   * Log a period day on behalf of a shadow member.
   * Idempotent — re-logging the same date upserts the row.
   */
  async logShadowPeriodDay(input: LogShadowPeriodInput): Promise<ShadowCycleEntry> {
    const now = new Date().toISOString();
    const db = await this.getDb();

    const existing = await db.getFirstAsync<ShadowCycleEntryRow>(
      'SELECT * FROM shadow_cycle_entries WHERE member_id = ? AND date = ?',
      input.memberId,
      input.date
    );

    if (existing) {
      await db.runAsync(
        `UPDATE shadow_cycle_entries
         SET is_period_day = 1, flow_level = ?, phase = 'menstrual'
         WHERE id = ?`,
        input.flowLevel ?? existing.flow_level ?? 3,
        existing.id
      );
      trackWrite();
      await this.touchMember(input.memberId);
      const updated = await db.getFirstAsync<ShadowCycleEntryRow>(
        'SELECT * FROM shadow_cycle_entries WHERE id = ?',
        existing.id
      );
      return rowToShadowCycleEntry(updated!);
    }

    const row: ShadowCycleEntryRow = {
      id: generateShadowEntryId(),
      member_id: input.memberId,
      date: input.date,
      is_period_day: 1,
      flow_level: input.flowLevel ?? 3,
      phase: 'menstrual',
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO shadow_cycle_entries
        (id, member_id, date, is_period_day, flow_level, phase, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.member_id,
      row.date,
      row.is_period_day,
      row.flow_level,
      row.phase,
      row.created_at
    );
    trackWrite();
    await this.touchMember(input.memberId);
    return rowToShadowCycleEntry(row);
  }

  /** Get all shadow cycle entries for a member, most recent first. */
  async getShadowCycleEntries(
    memberId: string,
    limit: number = 90
  ): Promise<ShadowCycleEntry[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<ShadowCycleEntryRow>(
      `SELECT * FROM shadow_cycle_entries
       WHERE member_id = ?
       ORDER BY date DESC
       LIMIT ?`,
      memberId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToShadowCycleEntry);
  }

  /**
   * Period days for one shadow member inside a date range (inclusive).
   *
   * Mirrors cycleRepository.getPeriodDaysInRange. Added so the MAIN cycle
   * calendar can overlay a sister's logged period days in her own colour
   * (device-test-6): the owner asked to stop maintaining a separate sisterhood
   * calendar and just show everyone on the one grid.
   */
  async getShadowPeriodDaysInRange(
    memberId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ date: string }>(
      `SELECT date FROM shadow_cycle_entries
       WHERE member_id = ? AND is_period_day = 1 AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
      memberId,
      startDate,
      endDate
    );
    trackQuery(Date.now() - start);
    return rows.map(r => r.date);
  }

  /**
   * Get the shadow member's most recent period start date.
   * Used by the engine to compute their current phase + day in cycle.
   */
  async getShadowLastPeriodStart(memberId: string): Promise<string | null> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ date: string }>(
      `SELECT date FROM shadow_cycle_entries
       WHERE member_id = ? AND is_period_day = 1
       ORDER BY date DESC`,
      memberId
    );
    if (rows.length === 0) return null;

    // Find the FIRST day of the most recent period block
    const set = new Set(rows.map(r => r.date));
    for (const row of rows) {
      const prev = prevDay(row.date);
      if (!set.has(prev)) return row.date;
    }
    return rows[rows.length - 1]?.date ?? null;
  }

  // ─── SHADOW CHECK-INS ───────────────────────────────────────────

  /** Log a mood/energy check-in on behalf of a shadow member. Idempotent per date. */
  async logShadowCheckIn(input: LogShadowCheckInInput): Promise<ShadowCheckIn> {
    const now = new Date().toISOString();
    const db = await this.getDb();

    const existing = await db.getFirstAsync<ShadowCheckInRow>(
      'SELECT * FROM shadow_check_ins WHERE member_id = ? AND date = ?',
      input.memberId,
      input.date
    );

    if (existing) {
      await db.runAsync(
        `UPDATE shadow_check_ins
         SET mood_score = COALESCE(?, mood_score),
             energy_level = COALESCE(?, energy_level),
             notes = COALESCE(?, notes)
         WHERE id = ?`,
        input.moodScore ?? null,
        input.energyLevel ?? null,
        input.notes ?? null,
        existing.id
      );
      trackWrite();
      await this.touchMember(input.memberId);
      const updated = await db.getFirstAsync<ShadowCheckInRow>(
        'SELECT * FROM shadow_check_ins WHERE id = ?',
        existing.id
      );
      return rowToShadowCheckIn(updated!);
    }

    const row: ShadowCheckInRow = {
      id: generateShadowCheckInId(),
      member_id: input.memberId,
      date: input.date,
      mood_score: input.moodScore ?? null,
      energy_level: input.energyLevel ?? null,
      notes: input.notes ?? null,
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO shadow_check_ins
        (id, member_id, date, mood_score, energy_level, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.member_id,
      row.date,
      row.mood_score,
      row.energy_level,
      row.notes,
      row.created_at
    );
    trackWrite();
    await this.touchMember(input.memberId);
    return rowToShadowCheckIn(row);
  }

  /** Get the most recent N check-ins for a shadow member. */
  async getShadowCheckIns(
    memberId: string,
    limit: number = 30
  ): Promise<ShadowCheckIn[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<ShadowCheckInRow>(
      `SELECT * FROM shadow_check_ins
       WHERE member_id = ?
       ORDER BY date DESC
       LIMIT ?`,
      memberId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToShadowCheckIn);
  }

  /** Get the most recent check-in for a shadow member, or null. */
  async getShadowLatestCheckIn(memberId: string): Promise<ShadowCheckIn | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ShadowCheckInRow>(
      `SELECT * FROM shadow_check_ins
       WHERE member_id = ?
       ORDER BY date DESC
       LIMIT 1`,
      memberId
    );
    return row ? rowToShadowCheckIn(row) : null;
  }

  // ─── CARE NUDGES ────────────────────────────────────────────────

  /** Record that a nudge was sent (currently local-only; future: queues for delivery to linked members). */
  async saveCareNudge(
    fromUserId: string,
    toMemberId: string,
    templateId: string,
    message: string,
    emoji: string,
    situation: string
  ): Promise<CareNudge> {
    const now = new Date().toISOString();
    const row: CareNudgeRow = {
      id: generateNudgeId(),
      from_user_id: fromUserId,
      to_member_id: toMemberId,
      template_id: templateId,
      message,
      emoji,
      situation,
      sent_at: now,
      seen_at: null,
    };

    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO care_nudges
        (id, from_user_id, to_member_id, template_id, message, emoji, situation, sent_at, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.from_user_id,
      row.to_member_id,
      row.template_id,
      row.message,
      row.emoji,
      row.situation,
      row.sent_at,
      row.seen_at
    );
    trackWrite();
    return rowToCareNudge(row);
  }

  /** List nudges sent to a specific member, most recent first. */
  async listNudgesForMember(
    memberId: string,
    limit: number = 20
  ): Promise<CareNudge[]> {
    const start = Date.now();
    const db = await this.getDb();
    const rows = await db.getAllAsync<CareNudgeRow>(
      `SELECT * FROM care_nudges
       WHERE to_member_id = ?
       ORDER BY sent_at DESC
       LIMIT ?`,
      memberId,
      limit
    );
    trackQuery(Date.now() - start);
    return rows.map(rowToCareNudge);
  }

  // ─── PHASE SYNC EVENTS ──────────────────────────────────────────

  /**
   * Record a detected phase-sync moment. Idempotent on
   * (primary_user_id, member_id, detected_at) — the schema's UNIQUE
   * constraint prevents duplicates if the engine re-detects on the
   * same day.
   */
  async recordPhaseSync(
    primaryUserId: string,
    memberId: string,
    phase: Phase,
    detectedAt: string
  ): Promise<PhaseSyncEvent | null> {
    const db = await this.getDb();
    try {
      const row: PhaseSyncEventRow = {
        id: generatePhaseSyncId(),
        primary_user_id: primaryUserId,
        member_id: memberId,
        phase,
        detected_at: detectedAt,
        acknowledged: 0,
      };
      await db.runAsync(
        `INSERT INTO phase_sync_events
          (id, primary_user_id, member_id, phase, detected_at, acknowledged)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.id,
        row.primary_user_id,
        row.member_id,
        row.phase,
        row.detected_at,
        row.acknowledged
      );
      trackWrite();
      return rowToPhaseSyncEvent(row);
    } catch {
      // UNIQUE constraint violation = sync already recorded for this day
      return null;
    }
  }

  /** Mark a phase sync as acknowledged (primary tapped it). */
  async acknowledgePhaseSync(eventId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE phase_sync_events SET acknowledged = 1 WHERE id = ?',
      eventId
    );
    trackWrite();
  }

  /** Get unacknowledged phase syncs for the primary user (sorted newest first). */
  async getUnacknowledgedPhaseSyncs(
    primaryUserId: string
  ): Promise<PhaseSyncEvent[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<PhaseSyncEventRow>(
      `SELECT * FROM phase_sync_events
       WHERE primary_user_id = ? AND acknowledged = 0
       ORDER BY detected_at DESC`,
      primaryUserId
    );
    return rows.map(rowToPhaseSyncEvent);
  }

  // ─── TRANSFER CODES ─────────────────────────────────────────────

  /**
   * Issue a new transfer code for a shadow member.
   * Any previously-unredeemed code for the same member is invalidated
   * (set redeemed_at = expires_at so it can't be used).
   */
  async issueTransferCode(
    memberId: string,
    code: string,
    expiresAt: string
  ): Promise<ProfileTransferCode> {
    const now = new Date().toISOString();

    await withTransaction(async db => {
      // Invalidate any pending codes for this member
      await db.runAsync(
        `UPDATE profile_transfer_codes
         SET redeemed_at = expires_at
         WHERE member_id = ? AND redeemed_at IS NULL`,
        memberId
      );
      trackWrite();

      await db.runAsync(
        `INSERT INTO profile_transfer_codes
          (id, member_id, code, expires_at, redeemed_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        generateTransferCodeId(),
        memberId,
        code,
        expiresAt,
        now
      );
      trackWrite();
    });

    const db = await this.getDb();
    const row = await db.getFirstAsync<ProfileTransferCodeRow>(
      'SELECT * FROM profile_transfer_codes WHERE code = ?',
      code
    );
    return rowToTransferCode(row!);
  }

  /** Find a transfer code by its code string (active only). */
  async findActiveTransferCode(code: string): Promise<ProfileTransferCode | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ProfileTransferCodeRow>(
      `SELECT * FROM profile_transfer_codes
       WHERE code = ? AND redeemed_at IS NULL AND expires_at > ?`,
      code,
      new Date().toISOString()
    );
    return row ? rowToTransferCode(row) : null;
  }

  /** Mark a transfer code as redeemed. */
  async markTransferCodeRedeemed(codeId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE profile_transfer_codes SET redeemed_at = ? WHERE id = ?',
      new Date().toISOString(),
      codeId
    );
    trackWrite();
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────────────

export const sisterhoodRepository = new SisterhoodRepository();

// ─── ROW → DOMAIN CONVERTERS ─────────────────────────────────────────

function rowToCircle(row: SisterhoodCircleRow): SisterhoodCircle {
  return {
    id: row.id,
    primaryUserId: row.primary_user_id,
    name: row.name,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

function rowToMember(row: SisterhoodMemberRow): SisterhoodMember {
  return {
    id: row.id,
    circleId: row.circle_id,
    linkedUserId: row.linked_user_id,
    displayName: row.display_name,
    emoji: row.emoji,
    relationship: row.relationship,
    kind: row.kind as MemberKind,
    privacyLevel: row.privacy_level as PrivacyLevel,
    shadowContext: parseShadowContext(row.shadow_context_json),
    addedAt: row.added_at,
    lastActiveAt: row.last_active_at,
  };
}

function rowToShadowCycleEntry(row: ShadowCycleEntryRow): ShadowCycleEntry {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    isPeriodDay: row.is_period_day === 1,
    flowLevel: row.flow_level,
    phase: row.phase,
    createdAt: row.created_at,
  };
}

function rowToShadowCheckIn(row: ShadowCheckInRow): ShadowCheckIn {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    moodScore: row.mood_score,
    energyLevel: row.energy_level,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function rowToCareNudge(row: CareNudgeRow): CareNudge {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toMemberId: row.to_member_id,
    templateId: row.template_id,
    message: row.message,
    emoji: row.emoji,
    situation: row.situation as CareNudge['situation'],
    sentAt: row.sent_at,
    seenAt: row.seen_at,
  };
}

function rowToPhaseSyncEvent(row: PhaseSyncEventRow): PhaseSyncEvent {
  return {
    id: row.id,
    primaryUserId: row.primary_user_id,
    memberId: row.member_id,
    phase: row.phase as Phase,
    detectedAt: row.detected_at,
    acknowledged: row.acknowledged === 1,
  };
}

function rowToTransferCode(row: ProfileTransferCodeRow): ProfileTransferCode {
  return {
    id: row.id,
    memberId: row.member_id,
    code: row.code,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    createdAt: row.created_at,
  };
}

function parseShadowContext(json: string | null): ShadowContext | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ShadowContext;
    }
    return null;
  } catch {
    return null;
  }
}

function emptyShadowContext(): ShadowContext {
  return {
    age: null,
    mode: 'adult',
    conditions: [],
    averageCycleLength: null,
    lastPeriodStart: null,
    notes: null,
  };
}

// ─── ID GENERATION ───────────────────────────────────────────────────

function generateCircleId(): string {
  return `circ_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateMemberId(): string {
  return `mem_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateShadowEntryId(): string {
  return `sce_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateShadowCheckInId(): string {
  return `sci_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateNudgeId(): string {
  return `nud_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generatePhaseSyncId(): string {
  return `psy_${Date.now().toString(36)}_${randomSuffix()}`;
}
function generateTransferCodeId(): string {
  return `txc_${Date.now().toString(36)}_${randomSuffix()}`;
}
function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(5, '0');
}

// ─── DATE HELPERS ────────────────────────────────────────────────────


