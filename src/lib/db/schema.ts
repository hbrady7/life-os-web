/**
 * Drizzle schema — single source of truth for the Postgres side of Life-OS.
 *
 * Conventions:
 * - Every user-scoped row has `userId` FK → users.id with cascade delete.
 * - Daily-singleton tables (sleep, mood, weight, etc.) use composite PK
 *   `(userId, date)`. Date is stored as a SQL `date` to enable indexed
 *   range scans without app-side parsing.
 * - Multi-entry-per-day tables (meals, journal, water, water/water-add)
 *   carry a UUID id and a non-unique `(userId, date)` index.
 * - Binary blobs (photos, voice audio) DO NOT live here — only references
 *   (IndexedDB keys) live in the DB. The blob stays on the device.
 * - OAuth tokens for integrations are encrypted at rest via the helper in
 *   lib/db/encryption.ts before insert / after select.
 */

import {
  bigint,
  boolean,
  date as pgDate,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH.JS STANDARD TABLES — shape is dictated by @auth/drizzle-adapter.
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** Set when the one-time localStorage → Neon import flow has been
   * completed (or explicitly skipped). Prevents the modal re-prompting. */
  importedAt: timestamp("imported_at", { mode: "date" }),
  importSkipped: boolean("import_skipped").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// USER SETTINGS — singleton per user. Nested settings live in JSON blobs.
// ─────────────────────────────────────────────────────────────────────────────

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Full Settings shape from src/lib/types.ts. We use JSONB rather than
   * exploding into 20 columns because the shape evolves frequently and
   * the data is read as one blob client-side. */
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// DAY ENTRIES — sparse, only dates with custom day type / score cache.
// ─────────────────────────────────────────────────────────────────────────────

export const dayEntries = pgTable(
  "day_entries",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    dayType: text("day_type"),
    scoreCache: integer("score_cache"),
    /** Set when sleep has been logged (synced) for this day. UI uses it to
     * decide whether to show "no sleep logged" empty states. */
    sleepLogged: boolean("sleep_logged").default(false).notNull(),
    journaled: boolean("journaled").default(false).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// HABITS
// ─────────────────────────────────────────────────────────────────────────────

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** HabitIcon enum value — kept as text so we can rename / add icons
     * without a schema migration. */
    icon: text("icon").notNull(),
    target: integer("target"),
    order: integer("order").default(0).notNull(),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("habits_user_idx").on(t.userId)]
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    completed: boolean("completed").default(true).notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.habitId, t.date] }),
    index("habit_logs_user_date_idx").on(t.userId, t.date),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────────────────────────────────────

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    completed: boolean("completed").default(false).notNull(),
    priority: text("priority", { enum: ["P1", "P2", "P3"] }).notNull(),
    emoji: text("emoji"),
    category: text("category"),
    timeEstimateMin: integer("time_estimate_min"),
    date: pgDate("date").notNull(),
    order: integer("order").default(0).notNull(),
    recurringGoalId: uuid("recurring_goal_id").references(
      (): typeof recurringGoals.id => recurringGoals.id,
      { onDelete: "set null" }
    ),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("goals_user_date_idx").on(t.userId, t.date)]
);

export const recurringGoals = pgTable("recurring_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  emoji: text("emoji"),
  priority: text("priority", { enum: ["P1", "P2", "P3"] }).notNull(),
  category: text("category"),
  timeEstimateMin: integer("time_estimate_min"),
  /** RecurrencePattern union: daily | weekdays | weekends | weekly |
   * weekly_count | biweekly | monthly | custom. */
  pattern: text("pattern").notNull(),
  /** All pattern-dependent fields kept as a JSON blob so adding new
   * recurrence types doesn't require a column migration. */
  patternConfig: jsonb("pattern_config").notNull().default(sql`'{}'::jsonb`),
  startDate: pgDate("start_date").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const recurringGoalGenerations = pgTable(
  "recurring_goal_generations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recurringGoalId: uuid("recurring_goal_id")
      .notNull()
      .references(() => recurringGoals.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    generatedGoalId: uuid("generated_goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["generated", "skipped"] }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.recurringGoalId, t.date] })]
);

/** Renamed from the spec's "goal_skip_dates" — same idea, but folded into
 * recurring_goal_generations with status='skipped'. */

// ─────────────────────────────────────────────────────────────────────────────
// ROUTINES
// ─────────────────────────────────────────────────────────────────────────────

export const morningRoutineItems = pgTable("morning_routine_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Retained for backwards-compat with the pre-emoji-cleanup data. Always
   * empty string for new items; never rendered. */
  icon: text("icon").default("").notNull(),
  order: integer("order").default(0).notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const morningRoutineLogs = pgTable(
  "morning_routine_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => morningRoutineItems.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId, t.date] })]
);

export const eveningRoutineItems = pgTable("evening_routine_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").default("").notNull(),
  order: integer("order").default(0).notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const eveningRoutineLogs = pgTable(
  "evening_routine_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => eveningRoutineItems.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId, t.date] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE / TIME BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** Minutes since midnight (matches the client model). */
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    type: text("type", {
      enum: ["goal", "workout", "meal", "focus", "meeting", "rest", "other"],
    }).notNull(),
    title: text("title").notNull(),
    icon: text("icon"),
    notes: text("notes"),
    goalId: uuid("goal_id").references(() => goals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("schedule_blocks_user_date_idx").on(t.userId, t.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS (Workout + Exercise + the RepCount-style Lift session model)
// ─────────────────────────────────────────────────────────────────────────────

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    type: text("type").notNull(),
    durationMin: integer("duration_min").default(0).notNull(),
    intensity: integer("intensity").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("workouts_user_date_uq").on(t.userId, t.date),
  ]
);

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workoutId: uuid("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Sets as JSON: Array<{weight, reps, order}>. Per-set rows would
   * triple the table count for marginal query benefit. */
  sets: jsonb("sets").notNull().default(sql`'[]'::jsonb`),
});

export const liftSessions = pgTable("lift_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: pgDate("date").notNull(),
  raw: text("raw"),
  /** Exercises (with normalized name + sets) live as JSON because the
   * RepCount parser ingests free-form text and we need to round-trip it. */
  exercises: jsonb("exercises").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION
// ─────────────────────────────────────────────────────────────────────────────

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** "HH:MM" — keeping the string form matches existing client logic
     * and avoids timezone gotchas when we display "logged at" times. */
    time: text("time").notNull(),
    name: text("name"),
    calories: real("calories").default(0).notNull(),
    protein: real("protein").default(0).notNull(),
    carbs: real("carbs"),
    fat: real("fat"),
    savedMealId: uuid("saved_meal_id").references(
      (): typeof savedMeals.id => savedMeals.id,
      { onDelete: "set null" }
    ),
    /** IndexedDB key for the full-res photo. Photo bytes stay on-device. */
    photoIndexeddbKey: text("photo_indexeddb_key"),
    thumbnailDataUrl: text("thumbnail_data_url"),
    aiAnalysis: jsonb("ai_analysis"),
    aiLogged: boolean("ai_logged").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("meals_user_date_idx").on(t.userId, t.date)]
);

export const savedMeals = pgTable("saved_meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  calories: real("calories").default(0).notNull(),
  protein: real("protein").default(0).notNull(),
  carbs: real("carbs"),
  fat: real("fat"),
  useCount: integer("use_count").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PER-METRIC DAILY LOGS — one row per (user, date) for singletons.
// ─────────────────────────────────────────────────────────────────────────────

export const waterLogs = pgTable(
  "water_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** Always stored in ounces. Client converts for display. */
    oz: real("oz").default(0).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const weightLogs = pgTable(
  "weight_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** Always stored in pounds. Client converts for display. */
    lb: real("lb").notNull(),
    /** Provenance: which write last touched this row. Used for the
     * "manual entry beats next sync" rule. */
    source: text("source", { enum: ["manual", "sync"] })
      .default("manual")
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const moodLogs = pgTable(
  "mood_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const energyLogs = pgTable(
  "energy_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** EnergyPeriod: morning | midday | afternoon | evening. */
    period: text("period").notNull(),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.period] })]
);

export const stepsLogs = pgTable(
  "steps_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    count: integer("count").notNull(),
    source: text("source", { enum: ["manual", "sync"] })
      .default("manual")
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const hrvLogs = pgTable(
  "hrv_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    /** Milliseconds (rMSSD-style). */
    ms: real("ms").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const restingHeartRateLogs = pgTable(
  "resting_heart_rate_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    bpm: integer("bpm").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const sleepLogs = pgTable(
  "sleep_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    score: integer("score"),
    hours: doublePrecision("hours"),
    /** Stage breakdown: { lightMin, deepMin, remMin, wakeMin }. JSON because
     * stages don't always come back from the API; null when unavailable. */
    stages: jsonb("stages"),
    /** "HH:MM" 24h. Bedtime is derived = wakeTime − hours. */
    wakeTime: text("wake_time"),
    bedtime: text("bedtime"),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const cardioLoadLogs = pgTable(
  "cardio_load_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// PEAK STATE — synthesized daily readiness score.
// One row per (user, date); recomputed throughout the day as inputs land.
// ─────────────────────────────────────────────────────────────────────────────

export const peakStateLogs = pgTable(
  "peak_state_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    peakState: integer("peak_state"),
    recovery: integer("recovery"),
    strain: integer("strain"),
    lifestyle: integer("lifestyle"),
    /** "go_hard" | "maintain" | "train_normal" | "easy_session" |
     *  "active_recovery" | "full_rest" — see lib/peak-state/compute.ts. */
    recommendation: text("recommendation"),
    /** Full contributors array — labels, values, signed impacts. JSON
     * because the row is read as one blob and the shape evolves with
     * the formula. */
    contributors: jsonb("contributors").notNull().default(sql`'[]'::jsonb`),
    availableInputs: integer("available_inputs").default(0).notNull(),
    /** Wall clock of the last compute() call. Used by the trigger to
     * decide whether the row is stale (older than 1h → recompute). */
    computedAt: timestamp("computed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("peak_state_logs_user_date_uq").on(t.userId, t.date),
    index("peak_state_logs_user_date_idx").on(t.userId, t.date),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// BODY MEASUREMENTS + PHOTOS METADATA (photo bytes stay in IndexedDB)
// ─────────────────────────────────────────────────────────────────────────────

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    weight: real("weight"),
    chest: real("chest"),
    waist: real("waist"),
    hips: real("hips"),
    bicep: real("bicep"),
    thigh: real("thigh"),
    bodyFatPct: real("body_fat_pct"),
    notes: text("notes"),
    photoIndexeddbKey: text("photo_indexeddb_key"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("body_measurements_user_date_idx").on(t.userId, t.date)]
);

export const bodyPhotos = pgTable(
  "body_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    angle: text("angle", { enum: ["front", "side", "back"] }).notNull(),
    weightAtTime: real("weight_at_time"),
    indexeddbKey: text("indexeddb_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("body_photos_user_date_idx").on(t.userId, t.date)]
);

/**
 * Body composition photo sessions — recurring 1st + 15th cadence. Each
 * session groups several photos (front / side / back, but any subset
 * is fine — captures aren't blocked). The actual JPEGs stay in
 * IndexedDB; photoKeys jsonb is an array of
 *   { key: string; angle: "front" | "side" | "back" | null; takenAt: string }
 * referencing the IDB blob keys.
 *
 * `date` is the target the session is attributed to (the 1st or 15th
 * nearest the actual capture). `captureDate` is when the user really
 * took the photos. Same value when on-time; differs for late captures.
 */
export const bodyPhotoSessions = pgTable(
  "body_photo_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    captureDate: pgDate("capture_date").notNull(),
    photoKeys: jsonb("photo_keys").notNull().default(sql`'[]'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("body_photo_sessions_user_date_idx").on(t.userId, t.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// PUSH SUBSCRIPTIONS — one row per (user, device). The browser-emitted
// subscription object is split into endpoint + p256dh + auth on insert.
// `endpoint` is globally unique (it embeds the push-service-assigned id),
// so we treat it as the natural primary key for upserts.
//
// Per-subscription opt-ins (`dailyWeightEnabled`, `photoDayEnabled`) let
// the user mute a class of reminders without losing the subscription
// itself — useful when they only want photo-day nudges, not daily
// weight ones. Both default true; the Settings card toggles them.
// ─────────────────────────────────────────────────────────────────────────────

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    dailyWeightEnabled: boolean("daily_weight_enabled").default(true).notNull(),
    photoDayEnabled: boolean("photo_day_enabled").default(true).notNull(),
    /** UA string at subscribe time — useful when debugging which device
     *  on the user's account is misbehaving. Never shown in the UI. */
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)]
);

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL — voice/manual/etc. Audio bytes stay in IndexedDB.
// ─────────────────────────────────────────────────────────────────────────────

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    mood: integer("mood"),
    energy: integer("energy"),
    text: text("text").notNull(),
    tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
    source: text("source", {
      enum: ["manual", "reflection", "overseer", "voice", "weekly-review"],
    }).notNull(),
    summary: text("summary"),
    moodWord: text("mood_word"),
    /** IndexedDB key for the voice audio blob — stays on-device. */
    voiceIndexeddbKey: text("voice_indexeddb_key"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("journal_entries_user_date_idx").on(t.userId, t.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// LISTS — plans / wins / struggles share a shape; one table with `kind`.
// ─────────────────────────────────────────────────────────────────────────────

export const listItems = pgTable(
  "list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["plan", "win", "struggle"] }).notNull(),
    date: pgDate("date").notNull(),
    text: text("text").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("list_items_user_date_kind_idx").on(t.userId, t.date, t.kind)]
);

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHTS (pattern detection / weekly review)
// ─────────────────────────────────────────────────────────────────────────────

export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: pgDate("date").notNull(),
  content: jsonb("content").notNull(),
  type: text("type").notNull(),
  dismissedAt: timestamp("dismissed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const dismissedPatterns = pgTable(
  "dismissed_patterns",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    headline: text("headline").notNull(),
    dismissedAt: timestamp("dismissed_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.fingerprint] })]
);

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: pgDate("week_start").notNull(),
    weekEnd: pgDate("week_end").notNull(),
    summary: text("summary").notNull(),
    wins: jsonb("wins").notNull().default(sql`'[]'::jsonb`),
    struggles: jsonb("struggles").notNull().default(sql`'[]'::jsonb`),
    trends: jsonb("trends").notNull().default(sql`'[]'::jsonb`),
    nextWeekPriorities: jsonb("next_week_priorities")
      .notNull()
      .default(sql`'[]'::jsonb`),
    generatedAt: timestamp("generated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    dismissed: boolean("dismissed").default(false).notNull(),
    savedToJournal: boolean("saved_to_journal").default(false).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// USER FACTS — future Overseer memory layer.
// ─────────────────────────────────────────────────────────────────────────────

export const userFacts = pgTable(
  "user_facts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATIONS — OAuth tokens encrypted at rest before insert.
// ─────────────────────────────────────────────────────────────────────────────

export const integrations = pgTable(
  "integrations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Provider id — e.g. "google_health". One row per (user, provider). */
    provider: text("provider").notNull(),
    /** Encrypted via lib/db/encryption.ts (AES-256-GCM, key derived from
     * NEXTAUTH_SECRET via HKDF). Format: base64(iv ‖ ciphertext ‖ tag). */
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    email: text("email"),
    needsReconnect: boolean("needs_reconnect").default(false).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    /** Extra provider-specific bookkeeping (initial sync flag, last error, etc.). */
    meta: jsonb("meta").default(sql`'{}'::jsonb`).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })]
);

/** Per-date per-field provenance for synced data — drives the 🔗 icon and
 * the manual-overrides-beat-sync rule. */
export const integrationProvenance = pgTable(
  "integration_provenance",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    date: pgDate("date").notNull(),
    /** Which field this provenance row tracks — sleep / steps / weight /
     * restingHeartRate / heartRateVariability / cardioLoad. */
    field: text("field").notNull(),
    syncedAt: timestamp("synced_at", { mode: "date" }),
    manualOverrideAt: timestamp("manual_override_at", { mode: "date" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider, t.date, t.field] }),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORS — Whoop-style daily journal for next-day correlation.
// Daily-singleton row; UPSERT on conflict (user_id, date).
// ─────────────────────────────────────────────────────────────────────────────

export const behaviors = pgTable(
  "behaviors",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    caffeineMg: real("caffeine_mg"),
    alcoholDrinks: real("alcohol_drinks"),
    lateMeal: boolean("late_meal"),
    screenTimeMinBeforeBed: real("screen_time_min_before_bed"),
    stressLevel: real("stress_level"),
    meditationMin: real("meditation_min"),
    cardioMin: real("cardio_min"),
    saunaMin: real("sauna_min"),
    coldExposureMin: real("cold_exposure_min"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

// ─────────────────────────────────────────────────────────────────────────────
// RECIPES — MyFitnessPal-style reusable meals. Ingredients live in jsonb
// because the shape is small and read-as-blob client-side; one row per recipe.
// ─────────────────────────────────────────────────────────────────────────────

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    servings: real("servings").default(1).notNull(),
    ingredients: jsonb("ingredients").notNull().default(sql`'[]'::jsonb`),
    caloriesPerServing: real("calories_per_serving").default(0).notNull(),
    proteinPerServing: real("protein_per_serving"),
    carbsPerServing: real("carbs_per_serving"),
    fatPerServing: real("fat_per_serving"),
    fiberPerServing: real("fiber_per_serving"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("recipes_user_idx").on(t.userId)]
);

// ─────────────────────────────────────────────────────────────────────────────
// FASTING WINDOWS — IF tracking. Active window has endedAt=null; history
// rows have it set.
// ─────────────────────────────────────────────────────────────────────────────

export const fastingWindows = pgTable(
  "fasting_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    targetHours: real("target_hours").default(16).notNull(),
    notes: text("notes"),
  },
  (t) => [index("fasting_user_idx").on(t.userId)]
);

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT HR SERIES — intra-workout HR samples synced from Google Health.
// Keyed by lift_sessions.id so deletion cascades naturally.
// ─────────────────────────────────────────────────────────────────────────────

export const workoutHrSeries = pgTable("workout_hr_series", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => liftSessions.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }).notNull(),
  /** HRSample[] — { at: ISO, bpm: number }. */
  samples: jsonb("samples").notNull().default(sql`'[]'::jsonb`),
  peakBpm: integer("peak_bpm"),
  avgBpm: integer("avg_bpm"),
  caloriesBurned: real("calories_burned"),
  zoneMinutes: jsonb("zone_minutes"),
  syncedAt: timestamp("synced_at", { mode: "date" }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUT ROUTINES — saved templates (Push/Pull/Legs/…). Exercises +
// optional planned sets stored as jsonb. scheduledDays = number[] (0=Sun)
// for the "Today's routine" surfacing on Gym.
// ─────────────────────────────────────────────────────────────────────────────

export const workoutRoutines = pgTable(
  "workout_routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    notes: text("notes"),
    /** TemplateExerciseEntry[] = { name, notes?, plannedSets?: PlannedSet[] } */
    exercises: jsonb("exercises").notNull().default(sql`'[]'::jsonb`),
    /** Day-of-week schedule, 0=Sun..6=Sat. Null/empty = unscheduled. */
    scheduledDays: jsonb("scheduled_days"),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("workout_routines_user_idx").on(t.userId)]
);

// ─────────────────────────────────────────────────────────────────────────────
// VITALITY — Mentor memory, caffeine, supplements, energy check-ins, planner.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mentor "the void" — durable thoughts the user captures (ideas, reminders,
 * goals, notes). Injected into the Mentor's context recency-first.
 */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    kind: text("kind", { enum: ["idea", "reminder", "goal", "note"] })
      .default("note")
      .notNull(),
    tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("memories_user_idx").on(t.userId)]
);

/** Optional Mentor chat history so the thread survives reloads. */
export const mentorMessages = pgTable(
  "mentor_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("mentor_messages_user_idx").on(t.userId)]
);

/**
 * Per-drink caffeine log. Distinct from behaviors.caffeineMg (a daily
 * aggregate) — this is the timestamped source of truth for the tracker
 * and the energy curve's decaying caffeine bumps.
 */
export const caffeineLogs = pgTable(
  "caffeine_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mg: real("mg").notNull(),
    label: text("label"),
    loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("caffeine_logs_user_idx").on(t.userId, t.loggedAt)]
);

/** Supplement stack — what the user takes and when. */
export const supplements = pgTable(
  "supplements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dose: text("dose"),
    window: text("window", { enum: ["morning", "anytime", "evening"] })
      .default("anytime")
      .notNull(),
    note: text("note"),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("supplements_user_idx").on(t.userId)]
);

/** Daily taken/not-taken state for a supplement. Resets are a UI concern
 * (configurable reset hour); the table just records the date taken. */
export const supplementLogs = pgTable(
  "supplement_logs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    supplementId: uuid("supplement_id")
      .notNull()
      .references(() => supplements.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    takenAt: timestamp("taken_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.supplementId, t.date] })]
);

/**
 * Felt-energy check-ins for predicted-vs-actual comparison. Separate from
 * the daily mood_logs (1–10) and energy_logs (per-period 1–10) — this is a
 * timestamped categorical felt-state.
 */
export const energyCheckins = pgTable(
  "energy_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    state: text("state", {
      enum: ["foggy", "tired", "steady", "sharp", "peak"],
    }).notNull(),
    /** 0..100 numeric equivalent of the state for charting against the curve. */
    score: integer("score").notNull(),
    loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("energy_checkins_user_date_idx").on(t.userId, t.date)]
);

/** Day-planner blocks parsed from natural language. */
export const planBlocks = pgTable(
  "plan_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: pgDate("date").notNull(),
    task: text("task").notNull(),
    /** Minutes since midnight, matching schedule_blocks. */
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
      .default("medium")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("plan_blocks_user_date_idx").on(t.userId, t.date)]
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS — drizzle uses these for the typed query builder.
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  habits: many(habits),
  goals: many(goals),
  recurringGoals: many(recurringGoals),
  journalEntries: many(journalEntries),
  workouts: many(workouts),
  meals: many(meals),
  scheduleBlocks: many(scheduleBlocks),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, { fields: [habitLogs.habitId], references: [habits.id] }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  template: one(recurringGoals, {
    fields: [goals.recurringGoalId],
    references: [recurringGoals.id],
  }),
}));

export const recurringGoalsRelations = relations(
  recurringGoals,
  ({ many }) => ({
    generations: many(recurringGoalGenerations),
  })
);

// avoid unused-imports lints (bigint may surface in future schema growth)
void bigint;
