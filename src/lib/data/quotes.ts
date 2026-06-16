import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";

export type QuoteRow = typeof quotes.$inferSelect;

export async function listQuotes(
  userId: string,
  limit?: number
): Promise<QuoteRow[]> {
  const q = db
    .select()
    .from(quotes)
    .where(eq(quotes.userId, userId))
    .orderBy(desc(quotes.createdAt));
  return limit ? q.limit(limit) : q;
}

export async function createQuote(
  userId: string,
  input: {
    text: string;
    saidBy?: string | null;
    context?: string | null;
    heardAt?: string | null;
  }
): Promise<QuoteRow> {
  const [row] = await db
    .insert(quotes)
    .values({
      userId,
      text: input.text,
      saidBy: input.saidBy ?? null,
      context: input.context ?? null,
      heardAt: input.heardAt ?? null,
    })
    .returning();
  return row;
}

export async function updateQuote(
  userId: string,
  id: string,
  patch: Partial<{
    text: string;
    saidBy: string | null;
    context: string | null;
    heardAt: string | null;
  }>
): Promise<QuoteRow | null> {
  const [row] = await db
    .update(quotes)
    .set(patch)
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteQuote(userId: string, id: string): Promise<void> {
  await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
}
