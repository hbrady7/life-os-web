import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { behaviors } from "@/lib/db/schema";
import type { BehaviorLog } from "@/lib/types";

export type BehaviorRow = typeof behaviors.$inferSelect;

function rowToLog(r: BehaviorRow): BehaviorLog {
  return {
    date: r.date as unknown as string,
    caffeineMg: r.caffeineMg ?? undefined,
    alcoholDrinks: r.alcoholDrinks ?? undefined,
    lateMeal: r.lateMeal ?? undefined,
    screenTimeMinBeforeBed: r.screenTimeMinBeforeBed ?? undefined,
    stressLevel: r.stressLevel ?? undefined,
    meditationMin: r.meditationMin ?? undefined,
    cardioMin: r.cardioMin ?? undefined,
    saunaMin: r.saunaMin ?? undefined,
    coldExposureMin: r.coldExposureMin ?? undefined,
    notes: r.notes ?? undefined,
  };
}

export async function listBehaviors(
  userId: string,
  opts?: { start?: string; end?: string }
): Promise<BehaviorLog[]> {
  const conds = [eq(behaviors.userId, userId)];
  if (opts?.start) conds.push(gte(behaviors.date, opts.start));
  if (opts?.end) conds.push(lte(behaviors.date, opts.end));
  const rows = await db
    .select()
    .from(behaviors)
    .where(and(...conds))
    .orderBy(desc(behaviors.date));
  return rows.map(rowToLog);
}

export async function upsertBehavior(
  userId: string,
  date: string,
  patch: Partial<Omit<BehaviorLog, "date">>
): Promise<BehaviorLog> {
  const payload = {
    userId,
    date,
    caffeineMg: patch.caffeineMg ?? null,
    alcoholDrinks: patch.alcoholDrinks ?? null,
    lateMeal: patch.lateMeal ?? null,
    screenTimeMinBeforeBed: patch.screenTimeMinBeforeBed ?? null,
    stressLevel: patch.stressLevel ?? null,
    meditationMin: patch.meditationMin ?? null,
    cardioMin: patch.cardioMin ?? null,
    saunaMin: patch.saunaMin ?? null,
    coldExposureMin: patch.coldExposureMin ?? null,
    notes: patch.notes ?? null,
    updatedAt: new Date(),
  };

  // Partial PATCH semantics: load existing row, merge, write back. This
  // avoids clobbering unrelated fields on every per-tile increment.
  const existing = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.date, date)))
    .limit(1);

  if (existing.length > 0) {
    const merged = { ...existing[0], ...payload };
    const [row] = await db
      .update(behaviors)
      .set(merged)
      .where(and(eq(behaviors.userId, userId), eq(behaviors.date, date)))
      .returning();
    return rowToLog(row);
  }

  const [row] = await db.insert(behaviors).values(payload).returning();
  return rowToLog(row);
}

export async function deleteBehavior(
  userId: string,
  date: string
): Promise<void> {
  await db
    .delete(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.date, date)));
}
