import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { planBlocks } from "@/lib/db/schema";

export type PlanBlockRow = typeof planBlocks.$inferSelect;
export type Difficulty = "easy" | "medium" | "hard";

export type PlanBlockInput = {
  task: string;
  startMin: number;
  endMin: number;
  difficulty?: Difficulty;
};

export async function listPlanBlocksForDate(
  userId: string,
  date: string
): Promise<PlanBlockRow[]> {
  return db
    .select()
    .from(planBlocks)
    .where(and(eq(planBlocks.userId, userId), eq(planBlocks.date, date)))
    .orderBy(asc(planBlocks.startMin));
}

export async function createPlanBlocks(
  userId: string,
  date: string,
  blocks: PlanBlockInput[]
): Promise<PlanBlockRow[]> {
  if (blocks.length === 0) return [];
  return db
    .insert(planBlocks)
    .values(
      blocks.map((b) => ({
        userId,
        date,
        task: b.task,
        startMin: b.startMin,
        endMin: b.endMin,
        difficulty: b.difficulty ?? "medium",
      }))
    )
    .returning();
}

export async function deletePlanBlock(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(planBlocks)
    .where(and(eq(planBlocks.id, id), eq(planBlocks.userId, userId)));
}
