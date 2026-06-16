import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { caffeineLogs } from "@/lib/db/schema";
import { fromDateStr, shiftDate } from "@/lib/date";

export type CaffeineRow = typeof caffeineLogs.$inferSelect;

/** Default caffeine-day boundary — totals reset at 6 AM. */
export const CAFFEINE_RESET_HOUR = 6;

/** [start, end) Date window for the caffeine-day attributed to `date`. */
function caffeineDayWindow(date: string, resetHour = CAFFEINE_RESET_HOUR) {
  const start = fromDateStr(date);
  start.setHours(resetHour, 0, 0, 0);
  const end = fromDateStr(shiftDate(date, 1));
  end.setHours(resetHour, 0, 0, 0);
  return { start, end };
}

export async function listCaffeineForDate(
  userId: string,
  date: string,
  resetHour = CAFFEINE_RESET_HOUR
): Promise<CaffeineRow[]> {
  const { start, end } = caffeineDayWindow(date, resetHour);
  return db
    .select()
    .from(caffeineLogs)
    .where(
      and(
        eq(caffeineLogs.userId, userId),
        gte(caffeineLogs.loggedAt, start),
        lt(caffeineLogs.loggedAt, end)
      )
    )
    .orderBy(asc(caffeineLogs.loggedAt));
}

export async function createCaffeineLog(
  userId: string,
  input: { mg: number; label?: string | null; loggedAt?: Date }
): Promise<CaffeineRow> {
  const [row] = await db
    .insert(caffeineLogs)
    .values({
      userId,
      mg: input.mg,
      label: input.label ?? null,
      ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
    })
    .returning();
  return row;
}

export async function deleteCaffeineLog(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(caffeineLogs)
    .where(and(eq(caffeineLogs.id, id), eq(caffeineLogs.userId, userId)));
}
