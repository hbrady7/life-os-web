import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memories } from "@/lib/db/schema";

export type MemoryRow = typeof memories.$inferSelect;
export type MemoryKind = "idea" | "reminder" | "goal" | "note";

export async function listMemories(
  userId: string,
  limit?: number
): Promise<MemoryRow[]> {
  const q = db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.createdAt));
  return limit ? q.limit(limit) : q;
}

export async function createMemory(
  userId: string,
  input: { content: string; kind?: MemoryKind; tags?: string[] }
): Promise<MemoryRow> {
  const [row] = await db
    .insert(memories)
    .values({
      userId,
      content: input.content,
      kind: input.kind ?? "note",
      tags: input.tags ?? [],
    })
    .returning();
  return row;
}

export async function deleteMemory(userId: string, id: string): Promise<void> {
  await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)));
}
