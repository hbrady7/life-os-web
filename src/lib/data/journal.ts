import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";

export type JournalRow = typeof journalEntries.$inferSelect;
export type JournalSource =
  | "manual"
  | "reflection"
  | "overseer"
  | "voice"
  | "weekly-review";

export async function listJournalEntries(userId: string): Promise<JournalRow[]> {
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt));
}

export async function listJournalEntriesForDate(
  userId: string,
  date: string
): Promise<JournalRow[]> {
  return db
    .select()
    .from(journalEntries)
    .where(
      and(eq(journalEntries.userId, userId), eq(journalEntries.date, date))
    )
    .orderBy(desc(journalEntries.createdAt));
}

export async function createJournalEntry(
  userId: string,
  input: {
    date: string;
    text: string;
    source: JournalSource;
    tags?: string[];
    mood?: number | null;
    energy?: number | null;
    summary?: string | null;
    moodWord?: string | null;
    voiceIndexeddbKey?: string | null;
  }
): Promise<JournalRow> {
  const [row] = await db
    .insert(journalEntries)
    .values({
      userId,
      date: input.date,
      text: input.text,
      source: input.source,
      tags: input.tags ?? [],
      mood: input.mood ?? null,
      energy: input.energy ?? null,
      summary: input.summary ?? null,
      moodWord: input.moodWord ?? null,
      voiceIndexeddbKey: input.voiceIndexeddbKey ?? null,
    })
    .returning();
  return row;
}

export async function updateJournalEntry(
  userId: string,
  id: string,
  patch: Partial<JournalRow>
): Promise<JournalRow | null> {
  const [row] = await db
    .update(journalEntries)
    .set(patch)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteJournalEntry(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}
