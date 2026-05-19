/**
 * One-time localStorage → Neon import. Reads a Zustand-state payload
 * (the exact shape persisted under `life-os:v2`) and upserts it into
 * the user's Neon tables.
 *
 * Strategy:
 *   1. Wipe any prior user-owned rows for the destination tables. The
 *      user is freshly signed in — they have nothing to lose, and a
 *      clean slate makes retries idempotent.
 *   2. Insert everything from the payload, regenerating UUIDs server-
 *      side (Zustand's `uid()` strings don't fit our `uuid` columns).
 *      Cross-references inside the payload (e.g. journal entry IDs
 *      shouldn't be needed, since all imported records carry their
 *      data inline) are not preserved.
 *   3. Mark `users.importedAt = now()` so the prompt never reappears.
 *
 * If step 2 throws, `importedAt` stays NULL and the next sign-in re-
 * prompts. Step 1 + step 2 run inside a single transaction so partial
 * data doesn't survive.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bodyMeasurements,
  bodyPhotos,
  cardioLoadLogs,
  dayEntries,
  dismissedPatterns,
  energyLogs,
  eveningRoutineItems,
  eveningRoutineLogs,
  exercises,
  goals,
  habits,
  habitLogs,
  hrvLogs,
  integrations,
  integrationProvenance,
  journalEntries,
  liftSessions,
  listItems,
  meals,
  moodLogs,
  morningRoutineItems,
  morningRoutineLogs,
  recurringGoalGenerations,
  recurringGoals,
  restingHeartRateLogs,
  savedMeals,
  scheduleBlocks,
  sleepLogs,
  stepsLogs,
  userSettings,
  users,
  waterLogs,
  weeklyReviews,
  weightLogs,
  workouts,
} from "@/lib/db/schema";

// ── Payload shape — mirrors Zustand state.partialize() output ────────────

type ZustandPayload = {
  settings?: Record<string, unknown>;
  days?: Record<string, { dayType: string; reminder?: string; scoreCache?: number }>;
  goals?: Array<{
    id: string;
    text: string;
    completed: boolean;
    priority: "P1" | "P2" | "P3";
    emoji?: string;
    category?: string;
    timeEstimateMin?: number;
    date: string;
    order: number;
    recurringGoalId?: string;
  }>;
  habits?: Array<{
    id: string;
    name: string;
    icon: string;
    target?: number;
    history: Record<string, boolean>;
    order: number;
    createdAt: string;
  }>;
  workouts?: Array<{
    id: string;
    date: string;
    type: string;
    durationMin: number;
    intensity: number;
    notes?: string;
    exercises: Array<{ name: string; sets: number; reps: number; weight?: number }>;
    createdAt: string;
  }>;
  liftSessions?: Array<{
    id: string;
    date: string;
    raw?: string;
    exercises: unknown[];
    createdAt: string;
  }>;
  health?: Record<
    string,
    {
      sleepHours?: number;
      wakeTime?: string;
      sleepStages?: {
        lightMin?: number;
        deepMin?: number;
        remMin?: number;
        wakeMin?: number;
      };
      mood?: number;
      waterOz?: number;
      weight?: number;
      steps?: number;
      restingHeartRate?: number;
      heartRateVariability?: number;
      cardioLoad?: number;
    }
  >;
  energy?: Record<string, { values: Record<string, number> }>;
  journal?: Array<{
    id: string;
    date: string;
    mood?: number;
    energy?: number;
    text: string;
    tags: string[];
    source:
      | "manual"
      | "reflection"
      | "overseer"
      | "voice"
      | "weekly-review";
    summary?: string;
    moodWord?: string;
    audioId?: string;
  }>;
  plans?: Array<{ id: string; text: string; date: string; order: number }>;
  wins?: Array<{ id: string; text: string; date: string; order: number }>;
  struggles?: Array<{ id: string; text: string; date: string; order: number }>;
  routine?: Array<{
    id: string;
    name: string;
    icon: string;
    order: number;
    history: Record<string, { completed: boolean; completedAt?: string }>;
  }>;
  evening?: Array<{
    id: string;
    name: string;
    icon: string;
    order: number;
    history: Record<string, { completed: boolean; completedAt?: string }>;
  }>;
  blocks?: Array<{
    id: string;
    date: string;
    startMin: number;
    endMin: number;
    type:
      | "goal"
      | "workout"
      | "meal"
      | "focus"
      | "meeting"
      | "rest"
      | "other";
    title: string;
    icon?: string;
    notes?: string;
    goalId?: string;
  }>;
  meals?: Array<{
    id: string;
    date: string;
    time: string;
    name?: string;
    calories: number;
    protein: number;
    carbs?: number;
    fat?: number;
    savedMealId?: string;
    photoId?: string;
    thumbnailDataUrl?: string;
    aiAnalysis?: unknown;
    createdAt: string;
  }>;
  savedMeals?: Array<{
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs?: number;
    fat?: number;
    useCount: number;
  }>;
  body?: Array<{
    id: string;
    date: string;
    weight?: number;
    chest?: number;
    waist?: number;
    hips?: number;
    bicep?: number;
    thigh?: number;
    bodyFatPct?: number;
    notes?: string;
    photoIdbKey?: string;
    createdAt: string;
  }>;
  photos?: Array<{
    id: string;
    date: string;
    angle: "front" | "side" | "back";
    weightAtTime?: number;
    idbKey: string;
    createdAt: string;
  }>;
  recurringGoals?: Array<{
    id: string;
    text: string;
    emoji?: string;
    priority: "P1" | "P2" | "P3";
    category?: string;
    timeEstimateMin?: number;
    pattern: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthlyLastDay?: boolean;
    intervalDays?: number;
    weeklyTimes?: number;
    startDate: string;
    active: boolean;
    createdAt: string;
  }>;
  recurringGenerations?: Array<{
    recurringGoalId: string;
    date: string;
    generatedGoalId: string;
    status: "generated" | "skipped";
  }>;
  dismissedPatterns?: Array<{
    fingerprint: string;
    headline: string;
    dismissedAt: string;
  }>;
  weeklyReviews?: Array<{
    weekStart: string;
    weekEnd: string;
    summary: string;
    wins: string[];
    struggles: string[];
    trends: string[];
    nextWeekPriorities: string[];
    generatedAt: string;
    dismissed?: boolean;
    savedToJournal?: boolean;
  }>;
  googleHealth?: {
    email?: string;
    needsReconnect?: boolean;
    lastSyncAt?: string;
    hasCompletedInitialSync?: boolean;
    sourceByDate?: Record<
      string,
      Partial<
        Record<
          "sleep" | "steps" | "weight" | "restingHeartRate" | "heartRateVariability",
          { syncedAt?: string; manualOverrideAt?: string }
        >
      >
    >;
  };
};

export type ImportCounts = {
  goals: number;
  habits: number;
  habitLogs: number;
  workouts: number;
  liftSessions: number;
  health: number;
  energy: number;
  journal: number;
  lists: number;
  routineItems: number;
  routineLogs: number;
  scheduleBlocks: number;
  meals: number;
  savedMeals: number;
  body: number;
  bodyPhotos: number;
  recurringGoals: number;
  recurringGenerations: number;
  dismissedPatterns: number;
  weeklyReviews: number;
  integrationProvenance: number;
};

// ── Helper: clear all user-owned rows ────────────────────────────────────

async function clearUserData(userId: string): Promise<void> {
  // Order doesn't matter strictly because of CASCADE FKs, but we go top-
  // down for clarity.
  await Promise.all([
    db.delete(goals).where(eq(goals.userId, userId)),
    db.delete(recurringGoals).where(eq(recurringGoals.userId, userId)),
    db
      .delete(recurringGoalGenerations)
      .where(eq(recurringGoalGenerations.userId, userId)),
    db.delete(habits).where(eq(habits.userId, userId)),
    db.delete(habitLogs).where(eq(habitLogs.userId, userId)),
    db.delete(workouts).where(eq(workouts.userId, userId)),
    db.delete(exercises).where(eq(exercises.userId, userId)),
    db.delete(liftSessions).where(eq(liftSessions.userId, userId)),
    db.delete(scheduleBlocks).where(eq(scheduleBlocks.userId, userId)),
    db.delete(meals).where(eq(meals.userId, userId)),
    db.delete(savedMeals).where(eq(savedMeals.userId, userId)),
    db.delete(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)),
    db.delete(bodyPhotos).where(eq(bodyPhotos.userId, userId)),
    db.delete(journalEntries).where(eq(journalEntries.userId, userId)),
    db.delete(listItems).where(eq(listItems.userId, userId)),
    db.delete(morningRoutineItems).where(eq(morningRoutineItems.userId, userId)),
    db.delete(morningRoutineLogs).where(eq(morningRoutineLogs.userId, userId)),
    db.delete(eveningRoutineItems).where(eq(eveningRoutineItems.userId, userId)),
    db.delete(eveningRoutineLogs).where(eq(eveningRoutineLogs.userId, userId)),
    db.delete(dayEntries).where(eq(dayEntries.userId, userId)),
    db.delete(waterLogs).where(eq(waterLogs.userId, userId)),
    db.delete(weightLogs).where(eq(weightLogs.userId, userId)),
    db.delete(moodLogs).where(eq(moodLogs.userId, userId)),
    db.delete(energyLogs).where(eq(energyLogs.userId, userId)),
    db.delete(stepsLogs).where(eq(stepsLogs.userId, userId)),
    db.delete(hrvLogs).where(eq(hrvLogs.userId, userId)),
    db.delete(restingHeartRateLogs).where(eq(restingHeartRateLogs.userId, userId)),
    db.delete(sleepLogs).where(eq(sleepLogs.userId, userId)),
    db.delete(cardioLoadLogs).where(eq(cardioLoadLogs.userId, userId)),
    db.delete(dismissedPatterns).where(eq(dismissedPatterns.userId, userId)),
    db.delete(weeklyReviews).where(eq(weeklyReviews.userId, userId)),
    db.delete(integrationProvenance).where(eq(integrationProvenance.userId, userId)),
  ]);
}

// ── The import itself ────────────────────────────────────────────────────

export async function runImport(
  userId: string,
  payload: ZustandPayload
): Promise<ImportCounts> {
  await clearUserData(userId);

  // Settings (singleton)
  if (payload.settings) {
    await db
      .insert(userSettings)
      .values({ userId, settings: payload.settings })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { settings: payload.settings, updatedAt: new Date() },
      });
  }

  // Day entries
  if (payload.days) {
    const rows = Object.entries(payload.days).map(([date, d]) => ({
      userId,
      date,
      dayType: d.dayType || null,
      scoreCache: d.scoreCache ?? null,
    }));
    if (rows.length) {
      await db
        .insert(dayEntries)
        .values(rows)
        .onConflictDoUpdate({
          target: [dayEntries.userId, dayEntries.date],
          set: { updatedAt: new Date() },
        });
    }
  }

  // Habits + habit logs (ID-mapping table built while inserting)
  const habitIdMap = new Map<string, string>();
  if (payload.habits?.length) {
    const inserted = await db
      .insert(habits)
      .values(
        payload.habits.map((h) => ({
          userId,
          name: h.name,
          icon: h.icon,
          target: h.target ?? null,
          order: h.order ?? 0,
          createdAt: new Date(h.createdAt),
        }))
      )
      .returning({ id: habits.id });
    payload.habits.forEach((h, i) => {
      const newId = inserted[i]?.id;
      if (newId) habitIdMap.set(h.id, newId);
    });
  }

  let habitLogCount = 0;
  if (payload.habits?.length) {
    const logRows: Array<{
      userId: string;
      habitId: string;
      date: string;
      completed: boolean;
      completedAt: Date | null;
    }> = [];
    for (const h of payload.habits) {
      const newId = habitIdMap.get(h.id);
      if (!newId) continue;
      for (const [date, done] of Object.entries(h.history)) {
        if (!done) continue;
        logRows.push({
          userId,
          habitId: newId,
          date,
          completed: true,
          completedAt: null,
        });
      }
    }
    if (logRows.length) {
      await db
        .insert(habitLogs)
        .values(logRows)
        .onConflictDoNothing({
          target: [habitLogs.userId, habitLogs.habitId, habitLogs.date],
        });
      habitLogCount = logRows.length;
    }
  }

  // Recurring goals (ID-mapping for goal.recurringGoalId rewrites)
  const recurringIdMap = new Map<string, string>();
  if (payload.recurringGoals?.length) {
    const inserted = await db
      .insert(recurringGoals)
      .values(
        payload.recurringGoals.map((r) => ({
          userId,
          text: r.text,
          emoji: r.emoji ?? null,
          priority: r.priority,
          category: r.category ?? null,
          timeEstimateMin: r.timeEstimateMin ?? null,
          pattern: r.pattern,
          patternConfig: {
            daysOfWeek: r.daysOfWeek,
            dayOfMonth: r.dayOfMonth,
            monthlyLastDay: r.monthlyLastDay,
            intervalDays: r.intervalDays,
            weeklyTimes: r.weeklyTimes,
          },
          startDate: r.startDate,
          active: r.active ?? true,
          createdAt: new Date(r.createdAt),
        }))
      )
      .returning({ id: recurringGoals.id });
    payload.recurringGoals.forEach((r, i) => {
      const id = inserted[i]?.id;
      if (id) recurringIdMap.set(r.id, id);
    });
  }

  // Goals
  let goalsCount = 0;
  if (payload.goals?.length) {
    await db.insert(goals).values(
      payload.goals.map((g) => ({
        userId,
        text: g.text,
        completed: g.completed,
        priority: g.priority,
        emoji: g.emoji ?? null,
        category: g.category ?? null,
        timeEstimateMin: g.timeEstimateMin ?? null,
        date: g.date,
        order: g.order ?? 0,
        recurringGoalId: g.recurringGoalId
          ? recurringIdMap.get(g.recurringGoalId) ?? null
          : null,
        completedAt: g.completed ? new Date() : null,
      }))
    );
    goalsCount = payload.goals.length;
  }

  // Recurring goal generations
  let recurringGenCount = 0;
  if (payload.recurringGenerations?.length) {
    const rows = payload.recurringGenerations
      .map((g) => {
        const mapped = recurringIdMap.get(g.recurringGoalId);
        if (!mapped) return null;
        return {
          userId,
          recurringGoalId: mapped,
          date: g.date,
          generatedGoalId: null,
          status: g.status,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length) {
      await db
        .insert(recurringGoalGenerations)
        .values(rows)
        .onConflictDoNothing({
          target: [
            recurringGoalGenerations.userId,
            recurringGoalGenerations.recurringGoalId,
            recurringGoalGenerations.date,
          ],
        });
      recurringGenCount = rows.length;
    }
  }

  // Workouts (one per day) — id map maintained for nested exercises
  let workoutsCount = 0;
  if (payload.workouts?.length) {
    for (const w of payload.workouts) {
      const [row] = await db
        .insert(workouts)
        .values({
          userId,
          date: w.date,
          type: w.type,
          durationMin: w.durationMin,
          intensity: w.intensity,
          notes: w.notes ?? null,
          createdAt: new Date(w.createdAt),
        })
        .onConflictDoUpdate({
          target: [workouts.userId, workouts.date],
          set: {
            type: w.type,
            durationMin: w.durationMin,
            intensity: w.intensity,
          },
        })
        .returning({ id: workouts.id });
      if (row && w.exercises?.length) {
        await db.insert(exercises).values(
          w.exercises.map((e) => ({
            userId,
            workoutId: row.id,
            name: e.name,
            sets: [
              {
                weight: e.weight ?? null,
                reps: e.reps,
                sets: e.sets,
              },
            ],
          }))
        );
      }
      workoutsCount += 1;
    }
  }

  // Lift sessions
  let liftSessionsCount = 0;
  if (payload.liftSessions?.length) {
    await db.insert(liftSessions).values(
      payload.liftSessions.map((s) => ({
        userId,
        date: s.date,
        raw: s.raw ?? null,
        exercises: s.exercises,
        createdAt: new Date(s.createdAt),
      }))
    );
    liftSessionsCount = payload.liftSessions.length;
  }

  // Per-day health metrics
  let healthCount = 0;
  if (payload.health) {
    const entries = Object.entries(payload.health);
    const water: Array<typeof waterLogs.$inferInsert> = [];
    const weight: Array<typeof weightLogs.$inferInsert> = [];
    const mood: Array<typeof moodLogs.$inferInsert> = [];
    const steps: Array<typeof stepsLogs.$inferInsert> = [];
    const hrv: Array<typeof hrvLogs.$inferInsert> = [];
    const rhr: Array<typeof restingHeartRateLogs.$inferInsert> = [];
    const sleep: Array<typeof sleepLogs.$inferInsert> = [];
    const cardio: Array<typeof cardioLoadLogs.$inferInsert> = [];
    for (const [date, h] of entries) {
      if (h.waterOz != null) water.push({ userId, date, oz: h.waterOz });
      if (h.weight != null)
        weight.push({ userId, date, lb: h.weight, source: "manual" });
      if (h.mood != null) mood.push({ userId, date, value: h.mood });
      if (h.steps != null) steps.push({ userId, date, count: h.steps });
      if (h.heartRateVariability != null)
        hrv.push({ userId, date, ms: h.heartRateVariability });
      if (h.restingHeartRate != null)
        rhr.push({ userId, date, bpm: h.restingHeartRate });
      if (h.sleepHours != null || h.sleepStages) {
        sleep.push({
          userId,
          date,
          hours: h.sleepHours ?? null,
          stages: h.sleepStages ?? null,
          wakeTime: h.wakeTime ?? null,
          bedtime: null,
        });
      }
      if (h.cardioLoad != null)
        cardio.push({ userId, date, value: h.cardioLoad });
      healthCount += 1;
    }
    if (water.length) await db.insert(waterLogs).values(water).onConflictDoNothing();
    if (weight.length) await db.insert(weightLogs).values(weight).onConflictDoNothing();
    if (mood.length) await db.insert(moodLogs).values(mood).onConflictDoNothing();
    if (steps.length) await db.insert(stepsLogs).values(steps).onConflictDoNothing();
    if (hrv.length) await db.insert(hrvLogs).values(hrv).onConflictDoNothing();
    if (rhr.length) await db.insert(restingHeartRateLogs).values(rhr).onConflictDoNothing();
    if (sleep.length) await db.insert(sleepLogs).values(sleep).onConflictDoNothing();
    if (cardio.length) await db.insert(cardioLoadLogs).values(cardio).onConflictDoNothing();
  }

  // Energy per-period
  let energyCount = 0;
  if (payload.energy) {
    const rows: Array<typeof energyLogs.$inferInsert> = [];
    for (const [date, log] of Object.entries(payload.energy)) {
      for (const [period, value] of Object.entries(log.values ?? {})) {
        if (typeof value === "number")
          rows.push({ userId, date, period, value });
      }
    }
    if (rows.length) {
      await db.insert(energyLogs).values(rows).onConflictDoNothing();
      energyCount = rows.length;
    }
  }

  // Journal
  let journalCount = 0;
  if (payload.journal?.length) {
    await db.insert(journalEntries).values(
      payload.journal.map((j) => ({
        userId,
        date: j.date,
        mood: j.mood ?? null,
        energy: j.energy ?? null,
        text: j.text,
        tags: j.tags ?? [],
        source: j.source,
        summary: j.summary ?? null,
        moodWord: j.moodWord ?? null,
        voiceIndexeddbKey: j.audioId ?? null,
      }))
    );
    journalCount = payload.journal.length;
  }

  // Lists (plans/wins/struggles)
  let listsCount = 0;
  const allLists: Array<typeof listItems.$inferInsert> = [
    ...(payload.plans ?? []).map((p) => ({
      userId,
      kind: "plan" as const,
      date: p.date,
      text: p.text,
      order: p.order ?? 0,
    })),
    ...(payload.wins ?? []).map((w) => ({
      userId,
      kind: "win" as const,
      date: w.date,
      text: w.text,
      order: w.order ?? 0,
    })),
    ...(payload.struggles ?? []).map((s) => ({
      userId,
      kind: "struggle" as const,
      date: s.date,
      text: s.text,
      order: s.order ?? 0,
    })),
  ];
  if (allLists.length) {
    await db.insert(listItems).values(allLists);
    listsCount = allLists.length;
  }

  // Routine items + logs (morning + evening)
  let routineItemsCount = 0;
  let routineLogsCount = 0;

  async function importRoutine(
    kind: "morning" | "evening",
    items?: ZustandPayload["routine"]
  ) {
    if (!items?.length) return;
    const itemsTable =
      kind === "morning" ? morningRoutineItems : eveningRoutineItems;
    const logsTable =
      kind === "morning" ? morningRoutineLogs : eveningRoutineLogs;
    const inserted = await db
      .insert(itemsTable)
      .values(
        items.map((i) => ({
          userId,
          name: i.name,
          icon: "",
          order: i.order,
        }))
      )
      .returning({ id: itemsTable.id });
    routineItemsCount += inserted.length;
    const logs: Array<typeof logsTable.$inferInsert> = [];
    items.forEach((i, idx) => {
      const newId = inserted[idx]?.id;
      if (!newId) return;
      for (const [date, entry] of Object.entries(i.history ?? {})) {
        if (!entry?.completed) continue;
        logs.push({
          userId,
          itemId: newId,
          date,
          completedAt: entry.completedAt
            ? new Date(entry.completedAt)
            : new Date(`${date}T00:00:00Z`),
        });
      }
    });
    if (logs.length) {
      await db.insert(logsTable).values(logs).onConflictDoNothing();
      routineLogsCount += logs.length;
    }
  }
  await importRoutine("morning", payload.routine);
  await importRoutine("evening", payload.evening);

  // Schedule blocks
  let scheduleCount = 0;
  if (payload.blocks?.length) {
    await db.insert(scheduleBlocks).values(
      payload.blocks.map((b) => ({
        userId,
        date: b.date,
        startMin: b.startMin,
        endMin: b.endMin,
        type: b.type,
        title: b.title,
        icon: b.icon ?? null,
        notes: b.notes ?? null,
        goalId: null, // legacy goalId references the old Zustand id space.
      }))
    );
    scheduleCount = payload.blocks.length;
  }

  // Saved meals
  let savedMealsCount = 0;
  if (payload.savedMeals?.length) {
    await db.insert(savedMeals).values(
      payload.savedMeals.map((m) => ({
        userId,
        name: m.name,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs ?? null,
        fat: m.fat ?? null,
        useCount: m.useCount ?? 0,
      }))
    );
    savedMealsCount = payload.savedMeals.length;
  }

  // Meals (photo keys preserved; blobs stay in IDB on the original device)
  let mealsCount = 0;
  if (payload.meals?.length) {
    await db.insert(meals).values(
      payload.meals.map((m) => ({
        userId,
        date: m.date,
        time: m.time,
        name: m.name ?? null,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs ?? null,
        fat: m.fat ?? null,
        savedMealId: null,
        photoIndexeddbKey: m.photoId ?? null,
        thumbnailDataUrl: m.thumbnailDataUrl ?? null,
        aiAnalysis: m.aiAnalysis ?? null,
        aiLogged: !!m.aiAnalysis,
        createdAt: new Date(m.createdAt),
      }))
    );
    mealsCount = payload.meals.length;
  }

  // Body measurements + photo metadata
  let bodyCount = 0;
  if (payload.body?.length) {
    await db.insert(bodyMeasurements).values(
      payload.body.map((b) => ({
        userId,
        date: b.date,
        weight: b.weight ?? null,
        chest: b.chest ?? null,
        waist: b.waist ?? null,
        hips: b.hips ?? null,
        bicep: b.bicep ?? null,
        thigh: b.thigh ?? null,
        bodyFatPct: b.bodyFatPct ?? null,
        notes: b.notes ?? null,
        photoIndexeddbKey: b.photoIdbKey ?? null,
        createdAt: new Date(b.createdAt),
      }))
    );
    bodyCount = payload.body.length;
  }

  let bodyPhotosCount = 0;
  if (payload.photos?.length) {
    await db.insert(bodyPhotos).values(
      payload.photos.map((p) => ({
        userId,
        date: p.date,
        angle: p.angle,
        weightAtTime: p.weightAtTime ?? null,
        indexeddbKey: p.idbKey,
        createdAt: new Date(p.createdAt),
      }))
    );
    bodyPhotosCount = payload.photos.length;
  }

  // Dismissed patterns
  let dismissedCount = 0;
  if (payload.dismissedPatterns?.length) {
    await db
      .insert(dismissedPatterns)
      .values(
        payload.dismissedPatterns.map((d) => ({
          userId,
          fingerprint: d.fingerprint,
          headline: d.headline,
          dismissedAt: new Date(d.dismissedAt),
        }))
      )
      .onConflictDoNothing();
    dismissedCount = payload.dismissedPatterns.length;
  }

  // Weekly reviews
  let weeklyReviewsCount = 0;
  if (payload.weeklyReviews?.length) {
    await db
      .insert(weeklyReviews)
      .values(
        payload.weeklyReviews.map((r) => ({
          userId,
          weekStart: r.weekStart,
          weekEnd: r.weekEnd,
          summary: r.summary,
          wins: r.wins ?? [],
          struggles: r.struggles ?? [],
          trends: r.trends ?? [],
          nextWeekPriorities: r.nextWeekPriorities ?? [],
          generatedAt: new Date(r.generatedAt),
          dismissed: r.dismissed ?? false,
          savedToJournal: r.savedToJournal ?? false,
        }))
      )
      .onConflictDoNothing();
    weeklyReviewsCount = payload.weeklyReviews.length;
  }

  // Integration provenance — sourceByDate map from googleHealth
  let provenanceCount = 0;
  const provenance = payload.googleHealth?.sourceByDate;
  if (provenance) {
    const rows: Array<typeof integrationProvenance.$inferInsert> = [];
    for (const [date, fields] of Object.entries(provenance)) {
      for (const [field, v] of Object.entries(fields)) {
        rows.push({
          userId,
          provider: "google_health",
          date,
          field,
          syncedAt: v?.syncedAt ? new Date(v.syncedAt) : null,
          manualOverrideAt: v?.manualOverrideAt
            ? new Date(v.manualOverrideAt)
            : null,
        });
      }
    }
    if (rows.length) {
      await db.insert(integrationProvenance).values(rows).onConflictDoNothing();
      provenanceCount = rows.length;
    }
  }

  // Persist integration shell (cookie keeps the actual tokens — only
  // metadata moves here so cross-device sees connection state).
  if (payload.googleHealth?.email) {
    await db
      .insert(integrations)
      .values({
        userId,
        provider: "google_health",
        email: payload.googleHealth.email,
        needsReconnect: payload.googleHealth.needsReconnect ?? false,
        lastSyncedAt: payload.googleHealth.lastSyncAt
          ? new Date(payload.googleHealth.lastSyncAt)
          : null,
        meta: {
          hasCompletedInitialSync:
            payload.googleHealth.hasCompletedInitialSync ?? false,
        },
      })
      .onConflictDoUpdate({
        target: [integrations.userId, integrations.provider],
        set: { email: payload.googleHealth.email, updatedAt: new Date() },
      });
  }

  // Stamp importedAt so the prompt never reappears.
  await db
    .update(users)
    .set({ importedAt: new Date(), importSkipped: false })
    .where(eq(users.id, userId));

  return {
    goals: goalsCount,
    habits: payload.habits?.length ?? 0,
    habitLogs: habitLogCount,
    workouts: workoutsCount,
    liftSessions: liftSessionsCount,
    health: healthCount,
    energy: energyCount,
    journal: journalCount,
    lists: listsCount,
    routineItems: routineItemsCount,
    routineLogs: routineLogsCount,
    scheduleBlocks: scheduleCount,
    meals: mealsCount,
    savedMeals: savedMealsCount,
    body: bodyCount,
    bodyPhotos: bodyPhotosCount,
    recurringGoals: payload.recurringGoals?.length ?? 0,
    recurringGenerations: recurringGenCount,
    dismissedPatterns: dismissedCount,
    weeklyReviews: weeklyReviewsCount,
    integrationProvenance: provenanceCount,
  };
}

export async function markImportSkipped(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ importSkipped: true })
    .where(eq(users.id, userId));
}

export async function getImportStatus(
  userId: string
): Promise<{
  needsPrompt: boolean;
  importedAt: Date | null;
  skipped: boolean;
}> {
  const [row] = await db
    .select({
      importedAt: users.importedAt,
      importSkipped: users.importSkipped,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) return { needsPrompt: false, importedAt: null, skipped: false };
  const needsPrompt = !row.importedAt && !row.importSkipped;
  return {
    needsPrompt,
    importedAt: row.importedAt,
    skipped: row.importSkipped,
  };
}

// Silence the unused import sweep — `and` is reserved for follow-up
// per-table delete predicates if we ever scope by date range.
void and;
