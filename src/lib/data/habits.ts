import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { habits, habitLogs } from "@/lib/db/schema";

export type HabitRow = typeof habits.$inferSelect;
export type HabitInsert = typeof habits.$inferInsert;
export type HabitLogRow = typeof habitLogs.$inferSelect;

export async function listHabits(userId: string): Promise<HabitRow[]> {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
    .orderBy(asc(habits.order), asc(habits.createdAt));
}

export async function createHabit(
  userId: string,
  input: { name: string; icon: string; target?: number | null; order?: number }
): Promise<HabitRow> {
  const [row] = await db
    .insert(habits)
    .values({
      userId,
      name: input.name,
      icon: input.icon,
      target: input.target ?? null,
      order: input.order ?? 0,
    })
    .returning();
  return row;
}

export async function updateHabit(
  userId: string,
  habitId: string,
  patch: Partial<Pick<HabitRow, "name" | "icon" | "target" | "order">>
): Promise<HabitRow | null> {
  const [row] = await db
    .update(habits)
    .set(patch)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveHabit(
  userId: string,
  habitId: string
): Promise<void> {
  await db
    .update(habits)
    .set({ archivedAt: new Date() })
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
}

export async function deleteHabit(
  userId: string,
  habitId: string
): Promise<void> {
  await db
    .delete(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
}

export async function listHabitLogs(
  userId: string,
  opts?: { habitId?: string }
): Promise<HabitLogRow[]> {
  if (opts?.habitId) {
    return db
      .select()
      .from(habitLogs)
      .where(
        and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, opts.habitId))
      );
  }
  return db.select().from(habitLogs).where(eq(habitLogs.userId, userId));
}

/** Toggle a habit log for a date. Returns the new state. */
export async function toggleHabitLog(
  userId: string,
  habitId: string,
  date: string
): Promise<{ completed: boolean }> {
  const existing = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.date, date)
      )
    );
  if (existing.length > 0) {
    await db
      .delete(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, userId),
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.date, date)
        )
      );
    return { completed: false };
  }
  await db.insert(habitLogs).values({
    userId,
    habitId,
    date,
    completed: true,
    completedAt: new Date(),
  });
  return { completed: true };
}

export async function reorderHabits(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db
      .update(habits)
      .set({ order: i })
      .where(and(eq(habits.id, orderedIds[i]), eq(habits.userId, userId)));
  }
}
