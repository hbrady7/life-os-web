/**
 * Unified per-day list items: plans, wins, struggles. Same shape, one
 * table, discriminated by `kind`.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { listItems } from "@/lib/db/schema";

export type ListKind = "plan" | "win" | "struggle";

export async function listListItems(
  userId: string,
  kind: ListKind,
  date?: string
) {
  const where = date
    ? and(
        eq(listItems.userId, userId),
        eq(listItems.kind, kind),
        eq(listItems.date, date)
      )
    : and(eq(listItems.userId, userId), eq(listItems.kind, kind));
  return db
    .select()
    .from(listItems)
    .where(where)
    .orderBy(asc(listItems.date), asc(listItems.order));
}

export async function createListItem(
  userId: string,
  kind: ListKind,
  input: { text: string; date: string; order?: number }
) {
  const [row] = await db
    .insert(listItems)
    .values({
      userId,
      kind,
      text: input.text,
      date: input.date,
      order: input.order ?? 0,
    })
    .returning();
  return row;
}

export async function updateListItem(
  userId: string,
  id: string,
  patch: { text?: string; order?: number }
) {
  const [row] = await db
    .update(listItems)
    .set(patch)
    .where(and(eq(listItems.id, id), eq(listItems.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteListItem(userId: string, id: string): Promise<void> {
  await db
    .delete(listItems)
    .where(and(eq(listItems.id, id), eq(listItems.userId, userId)));
}
