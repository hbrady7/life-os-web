import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyLearnings } from "@/lib/db/schema";

export type DailyLearningRow = typeof dailyLearnings.$inferSelect;

export async function getLearningByDate(
  date: string
): Promise<DailyLearningRow | null> {
  const [row] = await db
    .select()
    .from(dailyLearnings)
    .where(eq(dailyLearnings.date, date))
    .limit(1);
  return row ?? null;
}

export async function listRecentLearnings(
  limit = 30
): Promise<DailyLearningRow[]> {
  return db
    .select()
    .from(dailyLearnings)
    .orderBy(desc(dailyLearnings.date))
    .limit(limit);
}

export async function recentSubjects(limit = 60): Promise<string[]> {
  const rows = await db
    .select({ subject: dailyLearnings.subject })
    .from(dailyLearnings)
    .orderBy(desc(dailyLearnings.date))
    .limit(limit);
  return rows.map((r) => r.subject);
}

/**
 * Insert a learning for a date. Relies on UNIQUE(date) — under a
 * concurrent first-load race the loser's insert is a no-op, and callers
 * re-read to get the winner's row.
 */
export async function insertLearning(input: {
  date: string;
  subject: string;
  body: string;
}): Promise<void> {
  await db.insert(dailyLearnings).values(input).onConflictDoNothing();
}

export async function deleteLearning(date: string): Promise<void> {
  await db.delete(dailyLearnings).where(eq(dailyLearnings.date, date));
}
