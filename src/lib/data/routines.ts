/**
 * Morning + evening routines — items + per-date completion logs. Both
 * routines share identical shapes; we keep the tables separate (matches
 * the audit + existing UI), and surface a single API per kind.
 */

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  eveningRoutineItems,
  eveningRoutineLogs,
  morningRoutineItems,
  morningRoutineLogs,
} from "@/lib/db/schema";

export type RoutineKind = "morning" | "evening";

const TABLES = {
  morning: { items: morningRoutineItems, logs: morningRoutineLogs },
  evening: { items: eveningRoutineItems, logs: eveningRoutineLogs },
} as const;

export async function listRoutineItems(userId: string, kind: RoutineKind) {
  const { items } = TABLES[kind];
  return db
    .select()
    .from(items)
    .where(and(eq(items.userId, userId), isNull(items.archivedAt)))
    .orderBy(asc(items.order), asc(items.createdAt));
}

export async function createRoutineItem(
  userId: string,
  kind: RoutineKind,
  input: { name: string; order?: number }
) {
  const { items } = TABLES[kind];
  const [row] = await db
    .insert(items)
    .values({ userId, name: input.name, order: input.order ?? 0, icon: "" })
    .returning();
  return row;
}

export async function updateRoutineItem(
  userId: string,
  kind: RoutineKind,
  id: string,
  patch: { name?: string; order?: number }
) {
  const { items } = TABLES[kind];
  const [row] = await db
    .update(items)
    .set(patch)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}

export async function archiveRoutineItem(
  userId: string,
  kind: RoutineKind,
  id: string
) {
  const { items } = TABLES[kind];
  await db
    .update(items)
    .set({ archivedAt: new Date() })
    .where(and(eq(items.id, id), eq(items.userId, userId)));
}

export async function deleteRoutineItem(
  userId: string,
  kind: RoutineKind,
  id: string
) {
  const { items } = TABLES[kind];
  await db.delete(items).where(and(eq(items.id, id), eq(items.userId, userId)));
}

/**
 * Toggle a routine item's completion for a date. Insert on first touch,
 * delete on second.
 */
export async function toggleRoutineLog(
  userId: string,
  kind: RoutineKind,
  itemId: string,
  date: string
): Promise<{ completed: boolean }> {
  const { logs } = TABLES[kind];
  const existing = await db
    .select()
    .from(logs)
    .where(
      and(
        eq(logs.userId, userId),
        eq(logs.itemId, itemId),
        eq(logs.date, date)
      )
    );
  if (existing.length > 0) {
    await db
      .delete(logs)
      .where(
        and(
          eq(logs.userId, userId),
          eq(logs.itemId, itemId),
          eq(logs.date, date)
        )
      );
    return { completed: false };
  }
  await db.insert(logs).values({
    userId,
    itemId,
    date,
    completedAt: new Date(),
  });
  return { completed: true };
}

export async function listRoutineLogs(userId: string, kind: RoutineKind) {
  const { logs } = TABLES[kind];
  return db.select().from(logs).where(eq(logs.userId, userId));
}

export async function reorderRoutineItems(
  userId: string,
  kind: RoutineKind,
  orderedIds: string[]
) {
  const { items } = TABLES[kind];
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db
      .update(items)
      .set({ order: i })
      .where(and(eq(items.id, orderedIds[i]), eq(items.userId, userId)));
  }
}
