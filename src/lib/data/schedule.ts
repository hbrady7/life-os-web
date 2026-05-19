import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scheduleBlocks } from "@/lib/db/schema";

export type ScheduleBlockRow = typeof scheduleBlocks.$inferSelect;

export async function listBlocksForDate(userId: string, date: string) {
  return db
    .select()
    .from(scheduleBlocks)
    .where(
      and(eq(scheduleBlocks.userId, userId), eq(scheduleBlocks.date, date))
    )
    .orderBy(asc(scheduleBlocks.startMin));
}

export async function createBlock(
  userId: string,
  input: Omit<ScheduleBlockRow, "id" | "userId" | "createdAt">
) {
  const [row] = await db
    .insert(scheduleBlocks)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function updateBlock(
  userId: string,
  id: string,
  patch: Partial<ScheduleBlockRow>
) {
  const [row] = await db
    .update(scheduleBlocks)
    .set(patch)
    .where(
      and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId))
    )
    .returning();
  return row ?? null;
}

export async function deleteBlock(userId: string, id: string): Promise<void> {
  await db
    .delete(scheduleBlocks)
    .where(and(eq(scheduleBlocks.id, id), eq(scheduleBlocks.userId, userId)));
}
