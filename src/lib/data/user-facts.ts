import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userFacts } from "@/lib/db/schema";

/**
 * Persisted shape of a single fact. The schema column is jsonb so we
 * have room to add fields later (source message id, confidence, etc.)
 * without a migration — clients only ever read `text` + `category`.
 */
export type FactValue = {
  text: string;
  category?: string;
};

export type UserFactRow = {
  key: string;
  value: FactValue;
  createdAt: Date;
  updatedAt: Date;
};

function isFactValue(v: unknown): v is FactValue {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { text?: unknown }).text === "string"
  );
}

function normalize(row: typeof userFacts.$inferSelect): UserFactRow | null {
  if (!isFactValue(row.value)) return null;
  return {
    key: row.key,
    value: row.value,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listFacts(userId: string): Promise<UserFactRow[]> {
  const rows = await db
    .select()
    .from(userFacts)
    .where(eq(userFacts.userId, userId))
    .orderBy(desc(userFacts.updatedAt));
  return rows.map(normalize).filter((r): r is UserFactRow => r !== null);
}

export async function insertFact(
  userId: string,
  value: FactValue
): Promise<UserFactRow> {
  const key = crypto.randomUUID();
  const now = new Date();
  const [row] = await db
    .insert(userFacts)
    .values({ userId, key, value, createdAt: now, updatedAt: now })
    .returning();
  const normalized = normalize(row);
  if (!normalized) throw new Error("insert_returned_invalid_row");
  return normalized;
}

export async function updateFact(
  userId: string,
  key: string,
  value: FactValue
): Promise<UserFactRow | null> {
  const [row] = await db
    .update(userFacts)
    .set({ value, updatedAt: new Date() })
    .where(and(eq(userFacts.userId, userId), eq(userFacts.key, key)))
    .returning();
  if (!row) return null;
  return normalize(row);
}

export async function deleteFact(
  userId: string,
  key: string
): Promise<void> {
  await db
    .delete(userFacts)
    .where(and(eq(userFacts.userId, userId), eq(userFacts.key, key)));
}
