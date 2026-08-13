/**
 * Dottie — Database Schema (DDL)
 *
 * The complete schema for Dottie's offline-first local database.
 * All tables live in a single SQLite file. No remote anything.
 *
 * ─── DESIGN PRINCIPLES ──────────────────────────────────────────────
 *
 *  1. UUIDs for primary keys — never auto-increment integers.
 *     Reason: we may sync to backends one day, and UUIDs prevent
 *     collision without round-tripping for an ID.
 *
 *  2. ISO date strings (YYYY-MM-DD) for dates, ISO timestamps for
 *     instants. Storing as TEXT lets us sort lexicographically AND
 *     stay timezone-agnostic.
 *
 *  3. JSON columns for nested data — health profile, avatar config,
 *     question answers. Schema-on-read for fields that evolve fast.
 *
 *  4. Soft-delete is NOT used. Privacy promise: "delete my data" means
 *     the rows are gone. The "delete all" action drops the DB file.
 *
 *  5. Every table gets an updated_at column for future sync diffing.
 *
 * ─── TABLES ─────────────────────────────────────────────────────────
 *
 *  users                    One row — the local user (no multi-account)
 *  cycle_entries            One row per day with cycle data
 *  symptom_logs             One row per logged symptom (many per day)
 *  daily_check_ins          One row per day with mood/energy summary
 *  question_answers         One row per phase-question response
 *  cycle_records            One row per COMPLETED cycle (computed)
 *  predictions              One row per stored prediction (cached)
 *  prediction_errors        One row per (predicted, actual) pair
 *  gamification_state       Singleton row per user
 *  xp_transactions          Append-only log of XP awards
 *  gem_transactions         Append-only log of gem credits/debits
 *  badges_earned            One row per badge unlocked
 *  owned_store_items        Outfits/themes/avatars the user owns
 *  lesson_progress          One row per lesson started or completed
 *  quiz_attempts            Append-only log of quiz attempts
 *  medication_logs          Birth control, thyroid meds, etc.
 *  companion_state          User's chosen companion + equipped outfits
 *
 *  ── COMMUNITY (Chunk 7) ──
 *  community_posts          The Circle: top-level posts
 *  community_replies        The Circle: flat replies to posts
 *  community_hugs           The Circle: per-user, per-target hugs
 *  community_reports        The Circle: reports for moderation
 *
 *  ── SISTERHOOD (Chunk 8) ──
 *  sisterhood_circles       One row per primary user (their circle)
 *  sisterhood_members       Members in the primary's circle
 *  shadow_cycle_entries     Cycle entries logged ON BEHALF of shadow
 *  shadow_check_ins         Check-ins logged ON BEHALF of shadow
 *  care_nudges              Care nudges sent to members
 *  phase_sync_events        Detected phase-sync moments
 *  profile_transfer_codes   One-time codes to claim shadow profiles
 *
 * ─── INDEX STRATEGY ─────────────────────────────────────────────────
 *
 *  Indexes are added for columns we filter/sort by frequently:
 *    - All date columns get an index (calendar scroll, range queries)
 *    - Foreign keys get indexes (join performance)
 *    - Timestamps on append-only logs get indexes (recent-first reads)
 */

// ─── SCHEMA STATEMENTS (run in order) ────────────────────────────────

/**
 * Schema for version 1.
 *
 * Each SQL statement is a separate string so the migration runner can
 * execute them one at a time and report which statement failed if any
 * does. Don't combine multiple CREATE TABLE statements into one string.
 */
export const SCHEMA_V1: string[] = [
  // ─── users (singleton — at most one row on device) ───────────────
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('teen', 'adult', 'endocrine')),
    display_name TEXT,
    age INTEGER,
    weight_kg REAL,
    height_cm REAL,
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'moderate', 'active')),
    health_conditions TEXT NOT NULL DEFAULT '[]',
    average_cycle_length INTEGER,
    average_period_length INTEGER,
    on_medications INTEGER NOT NULL DEFAULT 0,
    ghost_pin_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // ─── cycle_entries (one row per day with data) ───────────────────
  `CREATE TABLE IF NOT EXISTS cycle_entries (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    phase TEXT CHECK (phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal')),
    flow_level INTEGER CHECK (flow_level BETWEEN 0 AND 5),
    is_period_day INTEGER NOT NULL DEFAULT 0,
    confidence_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cycle_entries_user_date
    ON cycle_entries(user_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_cycle_entries_period
    ON cycle_entries(user_id, is_period_day, date)`,

  // ─── symptom_logs (many per day allowed) ─────────────────────────
  `CREATE TABLE IF NOT EXISTS symptom_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('physical', 'emotional', 'skin', 'energy', 'sleep')),
    symptom_type TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
    notes TEXT,
    phase_at_log TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_symptom_logs_user_date
    ON symptom_logs(user_id, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_symptom_logs_category
    ON symptom_logs(user_id, category, date DESC)`,

  // ─── daily_check_ins (one per day) ───────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_check_ins (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
    questions_answered_count INTEGER NOT NULL DEFAULT 0,
    cramp_freeze_used INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_check_ins_user_date
    ON daily_check_ins(user_id, date DESC)`,

  // ─── question_answers (phase questions answered each day) ────────
  `CREATE TABLE IF NOT EXISTS question_answers (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    question_id TEXT NOT NULL,
    state_key TEXT,
    tracks_metric TEXT,
    response_value TEXT NOT NULL,
    response_index INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, date, question_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_question_answers_user_date
    ON question_answers(user_id, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_question_answers_metric
    ON question_answers(user_id, tracks_metric, date DESC)`,

  // ─── cycle_records (completed cycles, computed from entries) ─────
  `CREATE TABLE IF NOT EXISTS cycle_records (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    cycle_length INTEGER NOT NULL,
    period_length INTEGER NOT NULL,
    average_flow REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cycle_records_user_start
    ON cycle_records(user_id, start_date DESC)`,

  // ─── predictions (cached prediction outputs) ─────────────────────
  `CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    predicted_next_period TEXT NOT NULL,
    confidence REAL NOT NULL,
    window_days INTEGER NOT NULL,
    current_phase TEXT NOT NULL,
    day_in_phase INTEGER NOT NULL,
    day_in_cycle INTEGER NOT NULL,
    predicted_ovulation TEXT,
    factors_used TEXT NOT NULL DEFAULT '[]',
    prediction_phase INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_predictions_user_created
    ON predictions(user_id, created_at DESC)`,

  // ─── prediction_errors (for self-improving Bayesian updates) ─────
  `CREATE TABLE IF NOT EXISTS prediction_errors (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    predicted_date TEXT NOT NULL,
    actual_date TEXT NOT NULL,
    error_days INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_prediction_errors_user_created
    ON prediction_errors(user_id, created_at DESC)`,

  // ─── gamification_state (singleton per user) ─────────────────────
  `CREATE TABLE IF NOT EXISTS gamification_state (
    user_id TEXT PRIMARY KEY NOT NULL,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_check_in_date TEXT,
    cramp_freeze_available INTEGER NOT NULL DEFAULT 1,
    cramp_freeze_used_today INTEGER NOT NULL DEFAULT 0,
    xp_total INTEGER NOT NULL DEFAULT 0,
    gems_balance INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ─── xp_transactions (append-only log) ───────────────────────────
  `CREATE TABLE IF NOT EXISTS xp_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_xp_user_ts
    ON xp_transactions(user_id, timestamp DESC)`,

  // ─── gem_transactions (append-only log, + and -) ─────────────────
  `CREATE TABLE IF NOT EXISTS gem_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL,
    description TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gems_user_ts
    ON gem_transactions(user_id, timestamp DESC)`,

  // ─── badges_earned (one row per badge unlocked) ──────────────────
  `CREATE TABLE IF NOT EXISTS badges_earned (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, badge_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_badges_user_earned
    ON badges_earned(user_id, earned_at DESC)`,

  // ─── owned_store_items (gem store ownership) ─────────────────────
  `CREATE TABLE IF NOT EXISTS owned_store_items (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_category TEXT NOT NULL,
    acquired_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, item_id)
  )`,

  // ─── lesson_progress (one per started lesson) ────────────────────
  `CREATE TABLE IF NOT EXISTS lesson_progress (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'complete')),
    started_at TEXT,
    completed_at TEXT,
    quiz_score REAL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    gems_earned INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, lesson_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_path
    ON lesson_progress(user_id, path_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_progress_status
    ON lesson_progress(user_id, status)`,

  // ─── quiz_attempts (append-only log) ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    quiz_id TEXT NOT NULL,
    lesson_id TEXT,
    score REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    gems_earned INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_ts
    ON quiz_attempts(user_id, completed_at DESC)`,

  // ─── medication_logs (birth control, thyroid, etc.) ──────────────
  `CREATE TABLE IF NOT EXISTS medication_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    medication_type TEXT,
    dosage TEXT,
    started_at TEXT NOT NULL,
    stopped_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_medications_user_active
    ON medication_logs(user_id, stopped_at)`,

  // ─── companion_state (singleton per user) ────────────────────────
  `CREATE TABLE IF NOT EXISTS companion_state (
    user_id TEXT PRIMARY KEY NOT NULL,
    companion_type TEXT NOT NULL CHECK (companion_type IN ('fox', 'bunny', 'butterfly', 'cat', 'owl', 'blossom')),
    equipped_hat TEXT,
    equipped_scarf TEXT,
    equipped_background TEXT,
    equipped_effect TEXT,
    equipped_accessory TEXT,
    unlocked_outfits TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
];

/**
 * Schema for version 2 — Sisterhood Circle tables.
 *
 * Run by the migration runner AFTER v1 is in place. These tables
 * are additive — no v1 tables change, so the migration is purely
 * `CREATE TABLE IF NOT EXISTS ...` statements that are safe to
 * re-run.
 */
export const SCHEMA_V2: string[] = [
  // ─── sisterhood_circles (1:1 with primary user) ──────────────────
  `CREATE TABLE IF NOT EXISTS sisterhood_circles (
    id TEXT PRIMARY KEY NOT NULL,
    primary_user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Sisterhood',
    created_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL,
    FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (primary_user_id)
  )`,

  // ─── sisterhood_members (the people in the circle) ───────────────
  `CREATE TABLE IF NOT EXISTS sisterhood_members (
    id TEXT PRIMARY KEY NOT NULL,
    circle_id TEXT NOT NULL,
    linked_user_id TEXT,
    display_name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🌸',
    relationship TEXT NOT NULL DEFAULT 'Sister',
    kind TEXT NOT NULL CHECK (kind IN ('linked', 'shadow')),
    privacy_level TEXT NOT NULL CHECK (privacy_level IN ('full', 'summary', 'mood', 'connected')),
    shadow_context_json TEXT,
    added_at TEXT NOT NULL,
    last_active_at TEXT,
    FOREIGN KEY (circle_id) REFERENCES sisterhood_circles(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sisterhood_members_circle
    ON sisterhood_members(circle_id, added_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sisterhood_members_kind
    ON sisterhood_members(circle_id, kind)`,

  // ─── shadow_cycle_entries (logged on behalf of shadow member) ────
  `CREATE TABLE IF NOT EXISTS shadow_cycle_entries (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    date TEXT NOT NULL,
    is_period_day INTEGER NOT NULL DEFAULT 0,
    flow_level INTEGER CHECK (flow_level BETWEEN 0 AND 5),
    phase TEXT CHECK (phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES sisterhood_members(id) ON DELETE CASCADE,
    UNIQUE (member_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shadow_cycle_member_date
    ON shadow_cycle_entries(member_id, date DESC)`,

  // ─── shadow_check_ins (mood/energy logged on behalf of shadow) ───
  `CREATE TABLE IF NOT EXISTS shadow_check_ins (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    date TEXT NOT NULL,
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES sisterhood_members(id) ON DELETE CASCADE,
    UNIQUE (member_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shadow_checkins_member_date
    ON shadow_check_ins(member_id, date DESC)`,

  // ─── care_nudges (sent supportive messages) ──────────────────────
  `CREATE TABLE IF NOT EXISTS care_nudges (
    id TEXT PRIMARY KEY NOT NULL,
    from_user_id TEXT NOT NULL,
    to_member_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    message TEXT NOT NULL,
    emoji TEXT NOT NULL,
    situation TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    seen_at TEXT,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_member_id) REFERENCES sisterhood_members(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_care_nudges_member_sent
    ON care_nudges(to_member_id, sent_at DESC)`,

  // ─── phase_sync_events (detected in-sync moments) ────────────────
  `CREATE TABLE IF NOT EXISTS phase_sync_events (
    id TEXT PRIMARY KEY NOT NULL,
    primary_user_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES sisterhood_members(id) ON DELETE CASCADE,
    UNIQUE (primary_user_id, member_id, detected_at)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_phase_sync_user_detected
    ON phase_sync_events(primary_user_id, detected_at DESC)`,

  // ─── profile_transfer_codes (claim a shadow profile) ─────────────
  `CREATE TABLE IF NOT EXISTS profile_transfer_codes (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    redeemed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES sisterhood_members(id) ON DELETE CASCADE,
    UNIQUE (code)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transfer_codes_member
    ON profile_transfer_codes(member_id, created_at DESC)`,
];

/**
 * All schema definitions keyed by version number.
 * Used by migrations.ts to apply only what's needed.
 */
export const SCHEMA_BY_VERSION: Record<number, string[]> = {
  1: SCHEMA_V1,
  2: SCHEMA_V2,
};

// ─── ROW TYPES (matching DDL exactly) ────────────────────────────────

/**
 * Raw rows returned by SQLite. Repositories convert these into the
 * cleaner domain types from src/types/. We keep raw types here so the
 * data layer can be reasoned about in isolation.
 */

export interface UserRow {
  id: string;
  mode: 'teen' | 'adult' | 'endocrine';
  display_name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: 'sedentary' | 'moderate' | 'active' | null;
  /** JSON array of HealthCondition strings */
  health_conditions: string;
  average_cycle_length: number | null;
  average_period_length: number | null;
  on_medications: number; // 0 | 1
  ghost_pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface CycleEntryRow {
  id: string;
  user_id: string;
  date: string;
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null;
  flow_level: number | null;
  is_period_day: number; // 0 | 1
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface SymptomLogRow {
  id: string;
  user_id: string;
  date: string;
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  symptom_type: string;
  severity: number;
  notes: string | null;
  phase_at_log: string | null;
  created_at: string;
}

export interface DailyCheckInRow {
  id: string;
  user_id: string;
  date: string;
  mood_score: number | null;
  energy_level: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  questions_answered_count: number;
  cramp_freeze_used: number; // 0 | 1
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionAnswerRow {
  id: string;
  user_id: string;
  date: string;
  question_id: string;
  state_key: string | null;
  tracks_metric: string | null;
  response_value: string;
  response_index: number | null;
  created_at: string;
}

export interface CycleRecordRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  cycle_length: number;
  period_length: number;
  average_flow: number | null;
  created_at: string;
}

export interface PredictionRow {
  id: string;
  user_id: string;
  predicted_next_period: string;
  confidence: number;
  window_days: number;
  current_phase: string;
  day_in_phase: number;
  day_in_cycle: number;
  predicted_ovulation: string | null;
  /** JSON array of factor strings */
  factors_used: string;
  prediction_phase: number | null;
  created_at: string;
}

export interface PredictionErrorRow {
  id: string;
  user_id: string;
  predicted_date: string;
  actual_date: string;
  error_days: number;
  created_at: string;
}

export interface GamificationStateRow {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_check_in_date: string | null;
  cramp_freeze_available: number;
  cramp_freeze_used_today: number; // 0 | 1
  xp_total: number;
  gems_balance: number;
  current_level: number;
  updated_at: string;
}

export interface XpTransactionRow {
  id: string;
  user_id: string;
  amount: number;
  source: string;
  timestamp: string;
}

export interface GemTransactionRow {
  id: string;
  user_id: string;
  amount: number;
  source: string;
  description: string | null;
  timestamp: string;
}

export interface BadgeEarnedRow {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  /** JSON object */
  metadata: string;
}

export interface OwnedStoreItemRow {
  id: string;
  user_id: string;
  item_id: string;
  item_category: string;
  acquired_at: string;
}

export interface LessonProgressRow {
  id: string;
  user_id: string;
  lesson_id: string;
  path_id: string;
  status: 'not_started' | 'in_progress' | 'complete';
  started_at: string | null;
  completed_at: string | null;
  quiz_score: number | null;
  xp_earned: number;
  gems_earned: number;
  updated_at: string;
}

export interface QuizAttemptRow {
  id: string;
  user_id: string;
  quiz_id: string;
  lesson_id: string | null;
  score: number;
  correct_count: number;
  total_count: number;
  passed: number; // 0 | 1
  xp_earned: number;
  gems_earned: number;
  completed_at: string;
}

export interface MedicationLogRow {
  id: string;
  user_id: string;
  name: string;
  medication_type: string | null;
  dosage: string | null;
  started_at: string;
  stopped_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanionStateRow {
  user_id: string;
  companion_type: 'fox' | 'bunny' | 'butterfly' | 'cat' | 'owl' | 'blossom';
  equipped_hat: string | null;
  equipped_scarf: string | null;
  equipped_background: string | null;
  equipped_effect: string | null;
  equipped_accessory: string | null;
  /** JSON array of outfit IDs */
  unlocked_outfits: string;
  updated_at: string;
}

// ─── SISTERHOOD ROW TYPES (Chunk 8) ──────────────────────────────────

export interface SisterhoodCircleRow {
  id: string;
  primary_user_id: string;
  name: string;
  created_at: string;
  last_activity_at: string;
}

export interface SisterhoodMemberRow {
  id: string;
  circle_id: string;
  linked_user_id: string | null;
  display_name: string;
  emoji: string;
  relationship: string;
  kind: 'linked' | 'shadow';
  privacy_level: 'full' | 'summary' | 'mood' | 'connected';
  /** JSON object — null for linked members */
  shadow_context_json: string | null;
  added_at: string;
  last_active_at: string | null;
}

export interface ShadowCycleEntryRow {
  id: string;
  member_id: string;
  date: string;
  is_period_day: number; // 0 | 1
  flow_level: number | null;
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | null;
  created_at: string;
}

export interface ShadowCheckInRow {
  id: string;
  member_id: string;
  date: string;
  mood_score: number | null;
  energy_level: number | null;
  notes: string | null;
  created_at: string;
}

export interface CareNudgeRow {
  id: string;
  from_user_id: string;
  to_member_id: string;
  template_id: string;
  message: string;
  emoji: string;
  situation: string;
  sent_at: string;
  seen_at: string | null;
}

export interface PhaseSyncEventRow {
  id: string;
  primary_user_id: string;
  member_id: string;
  phase: string;
  detected_at: string;
  acknowledged: number; // 0 | 1
}

export interface ProfileTransferCodeRow {
  id: string;
  member_id: string;
  code: string;
  expires_at: string;
  redeemed_at: string | null;
  created_at: string;
}