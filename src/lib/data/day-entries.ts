import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dayEntries } from "@/lib/db/schema";

export type DayEntryRow = typeof dayEntries.$inferSelect;

export async function getDayEntry(
  userId: string,
  date: string
): Promise<DayEntryRow | null> {
  const [row] = await db
    .select()
    .from(dayEntries)
    .where(and(eq(dayEntries.userId, userId), eq(dayEntries.date, date)));
  return row ?? null;
}

export async function upsertDayEntry(
  userId: string,
  date: string,
  patch: Partial<
    Pick<DayEntryRow, "dayType" | "scoreCache" | "sleepLogged" | "journaled">
  >
): Promise<DayEntryRow> {
  const [row] = await db
    .insert(dayEntries)
    .values({ userId, date, ...patch })
    .onConflictDoUpdate({
      target: [dayEntries.userId, dayEntries.date],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning();
  return row;
}
