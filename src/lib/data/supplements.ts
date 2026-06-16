import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplements, supplementLogs } from "@/lib/db/schema";

export type SupplementRow = typeof supplements.$inferSelect;
export type SupplementLogRow = typeof supplementLogs.$inferSelect;
export type SupplementWindow = "morning" | "anytime" | "evening";

export async function listSupplements(
  userId: string
): Promise<SupplementRow[]> {
  return db
    .select()
    .from(supplements)
    .where(eq(supplements.userId, userId))
    .orderBy(asc(supplements.order), asc(supplements.createdAt));
}

export async function createSupplement(
  userId: string,
  input: {
    name: string;
    dose?: string | null;
    window?: SupplementWindow;
    note?: string | null;
    order?: number;
  }
): Promise<SupplementRow> {
  const [row] = await db
    .insert(supplements)
    .values({
      userId,
      name: input.name,
      dose: input.dose ?? null,
      window: input.window ?? "anytime",
      note: input.note ?? null,
      order: input.order ?? 0,
    })
    .returning();
  return row;
}

export async function updateSupplement(
  userId: string,
  id: string,
  patch: Partial<Pick<SupplementRow, "name" | "dose" | "window" | "note" | "order">>
): Promise<SupplementRow | null> {
  const [row] = await db
    .update(supplements)
    .set(patch)
    .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteSupplement(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, userId)));
}

// ── Daily taken state ───────────────────────────────────────────────────────

export async function listSupplementLogsForDate(
  userId: string,
  date: string
): Promise<SupplementLogRow[]> {
  return db
    .select()
    .from(supplementLogs)
    .where(
      and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date))
    );
}

export async function setSupplementTaken(
  userId: string,
  supplementId: string,
  date: string,
  taken: boolean
): Promise<void> {
  if (taken) {
    await db
      .insert(supplementLogs)
      .values({ userId, supplementId, date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.date, date)
        )
      );
  }
}

export async function getSupplementSummary(
  userId: string,
  date: string
): Promise<{ takenToday: number; total: number }> {
  const [stack, logs] = await Promise.all([
    listSupplements(userId),
    listSupplementLogsForDate(userId, date),
  ]);
  const takenIds = new Set(logs.map((l) => l.supplementId));
  const takenToday = stack.filter((s) => takenIds.has(s.id)).length;
  return { takenToday, total: stack.length };
}
