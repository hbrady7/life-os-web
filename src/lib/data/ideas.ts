import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ideas, memories } from "@/lib/db/schema";

export type IdeaRow = typeof ideas.$inferSelect;
export type IdeaStatus = "spark" | "exploring" | "parked" | "shipped";

/**
 * One-time, idempotent sweep: Phase 1 let the mentor capture ideas into
 * `memories` (kind='idea'). Now that there's a real board, move any such
 * rows into `ideas` and delete them from memories. Runs at the head of
 * listIdeas — after the first sweep there's nothing left to move, so it's
 * effectively free.
 */
async function migrateIdeaMemories(userId: string): Promise<void> {
  const ideaMemories = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.kind, "idea")));
  if (ideaMemories.length === 0) return;
  await db.insert(ideas).values(
    ideaMemories.map((m) => ({
      userId,
      title: m.content,
      tags: m.tags.length ? m.tags : null,
      createdAt: m.createdAt,
      updatedAt: m.createdAt,
    }))
  );
  await db
    .delete(memories)
    .where(and(eq(memories.userId, userId), eq(memories.kind, "idea")));
}

export async function listIdeas(
  userId: string,
  limit?: number
): Promise<IdeaRow[]> {
  await migrateIdeaMemories(userId);
  const q = db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.createdAt));
  return limit ? q.limit(limit) : q;
}

export async function createIdea(
  userId: string,
  input: { title: string; body?: string | null; status?: IdeaStatus; tags?: string[] | null }
): Promise<IdeaRow> {
  const [row] = await db
    .insert(ideas)
    .values({
      userId,
      title: input.title,
      body: input.body ?? null,
      status: input.status ?? "spark",
      tags: input.tags && input.tags.length ? input.tags : null,
    })
    .returning();
  return row;
}

export async function updateIdea(
  userId: string,
  id: string,
  patch: Partial<{
    title: string;
    body: string | null;
    status: IdeaStatus;
    tags: string[] | null;
  }>
): Promise<IdeaRow | null> {
  const [row] = await db
    .update(ideas)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteIdea(userId: string, id: string): Promise<void> {
  await db.delete(ideas).where(and(eq(ideas.id, id), eq(ideas.userId, userId)));
}
