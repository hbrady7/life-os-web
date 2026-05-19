import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, recurringGoals, recurringGoalGenerations } from "@/lib/db/schema";

export type GoalRow = typeof goals.$inferSelect;
export type RecurringGoalRow = typeof recurringGoals.$inferSelect;

export async function listGoalsForDate(
  userId: string,
  date: string
): Promise<GoalRow[]> {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.date, date)))
    .orderBy(asc(goals.order), asc(goals.createdAt));
}

export async function listAllGoals(userId: string): Promise<GoalRow[]> {
  return db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.date), asc(goals.order));
}

export async function createGoal(
  userId: string,
  input: {
    text: string;
    priority: "P1" | "P2" | "P3";
    date: string;
    emoji?: string | null;
    category?: string | null;
    timeEstimateMin?: number | null;
    order?: number;
    recurringGoalId?: string | null;
  }
): Promise<GoalRow> {
  const [row] = await db
    .insert(goals)
    .values({
      userId,
      text: input.text,
      priority: input.priority,
      date: input.date,
      emoji: input.emoji ?? null,
      category: input.category ?? null,
      timeEstimateMin: input.timeEstimateMin ?? null,
      order: input.order ?? 0,
      recurringGoalId: input.recurringGoalId ?? null,
    })
    .returning();
  return row;
}

export async function updateGoal(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      GoalRow,
      | "text"
      | "completed"
      | "priority"
      | "emoji"
      | "category"
      | "timeEstimateMin"
      | "order"
      | "date"
    >
  >
): Promise<GoalRow | null> {
  const next: Record<string, unknown> = { ...patch };
  // Stamp completedAt when transitioning to completed.
  if (patch.completed === true) next.completedAt = new Date();
  if (patch.completed === false) next.completedAt = null;
  const [row] = await db
    .update(goals)
    .set(next)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteGoal(userId: string, id: string): Promise<void> {
  await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function reorderGoals(
  userId: string,
  date: string,
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db
      .update(goals)
      .set({ order: i })
      .where(
        and(
          eq(goals.id, orderedIds[i]),
          eq(goals.userId, userId),
          eq(goals.date, date)
        )
      );
  }
}

// ── Recurring goal templates ─────────────────────────────────────────────────

export async function listRecurringGoals(
  userId: string
): Promise<RecurringGoalRow[]> {
  return db
    .select()
    .from(recurringGoals)
    .where(eq(recurringGoals.userId, userId))
    .orderBy(desc(recurringGoals.createdAt));
}

export async function createRecurringGoal(
  userId: string,
  input: {
    text: string;
    pattern: string;
    patternConfig: Record<string, unknown>;
    startDate: string;
    priority: "P1" | "P2" | "P3";
    emoji?: string | null;
    category?: string | null;
    timeEstimateMin?: number | null;
    active?: boolean;
  }
): Promise<RecurringGoalRow> {
  const [row] = await db
    .insert(recurringGoals)
    .values({
      userId,
      text: input.text,
      pattern: input.pattern,
      patternConfig: input.patternConfig,
      startDate: input.startDate,
      priority: input.priority,
      emoji: input.emoji ?? null,
      category: input.category ?? null,
      timeEstimateMin: input.timeEstimateMin ?? null,
      active: input.active ?? true,
    })
    .returning();
  return row;
}

export async function updateRecurringGoal(
  userId: string,
  id: string,
  patch: Partial<RecurringGoalRow>
): Promise<RecurringGoalRow | null> {
  const [row] = await db
    .update(recurringGoals)
    .set(patch)
    .where(and(eq(recurringGoals.id, id), eq(recurringGoals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteRecurringGoal(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(recurringGoals)
    .where(and(eq(recurringGoals.id, id), eq(recurringGoals.userId, userId)));
}

export async function recordRecurringGeneration(
  userId: string,
  recurringGoalId: string,
  date: string,
  generatedGoalId: string | null,
  status: "generated" | "skipped"
): Promise<void> {
  await db
    .insert(recurringGoalGenerations)
    .values({
      userId,
      recurringGoalId,
      date,
      generatedGoalId,
      status,
    })
    .onConflictDoUpdate({
      target: [
        recurringGoalGenerations.userId,
        recurringGoalGenerations.recurringGoalId,
        recurringGoalGenerations.date,
      ],
      set: { generatedGoalId, status },
    });
}
