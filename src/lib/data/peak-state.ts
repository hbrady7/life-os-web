import { and, between, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { peakStateLogs } from "@/lib/db/schema";

export type PeakStateRow = typeof peakStateLogs.$inferSelect;

export async function getPeakStateForDate(
  userId: string,
  date: string
): Promise<PeakStateRow | null> {
  const [row] = await db
    .select()
    .from(peakStateLogs)
    .where(and(eq(peakStateLogs.userId, userId), eq(peakStateLogs.date, date)));
  return row ?? null;
}

export async function readPeakStateRange(
  userId: string,
  start: string,
  end: string
): Promise<PeakStateRow[]> {
  return db
    .select()
    .from(peakStateLogs)
    .where(
      and(
        eq(peakStateLogs.userId, userId),
        between(peakStateLogs.date, start, end)
      )
    )
    .orderBy(desc(peakStateLogs.date));
}

export async function upsertPeakState(
  userId: string,
  date: string,
  payload: {
    peakState: number | null;
    recovery: number | null;
    strain: number | null;
    lifestyle: number | null;
    recommendation: string | null;
    contributors: unknown;
    availableInputs: number;
  }
): Promise<PeakStateRow> {
  const [row] = await db
    .insert(peakStateLogs)
    .values({
      userId,
      date,
      ...payload,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [peakStateLogs.userId, peakStateLogs.date],
      set: { ...payload, computedAt: new Date() },
    })
    .returning();
  return row;
}
