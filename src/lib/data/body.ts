import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodyMeasurements, bodyPhotos } from "@/lib/db/schema";

export type BodyMeasurementRow = typeof bodyMeasurements.$inferSelect;
export type BodyPhotoRow = typeof bodyPhotos.$inferSelect;

export async function listBodyMeasurements(userId: string) {
  return db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.userId, userId))
    .orderBy(asc(bodyMeasurements.date));
}

export async function createBodyMeasurement(
  userId: string,
  input: Omit<BodyMeasurementRow, "id" | "userId" | "createdAt">
) {
  const [row] = await db
    .insert(bodyMeasurements)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function updateBodyMeasurement(
  userId: string,
  id: string,
  patch: Partial<BodyMeasurementRow>
) {
  const [row] = await db
    .update(bodyMeasurements)
    .set(patch)
    .where(
      and(
        eq(bodyMeasurements.id, id),
        eq(bodyMeasurements.userId, userId)
      )
    )
    .returning();
  return row ?? null;
}

export async function deleteBodyMeasurement(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(bodyMeasurements)
    .where(
      and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId))
    );
}

// ── Body photos metadata (blob stays in IndexedDB) ─────────────────────────

export async function listBodyPhotos(userId: string) {
  return db
    .select()
    .from(bodyPhotos)
    .where(eq(bodyPhotos.userId, userId))
    .orderBy(asc(bodyPhotos.date));
}

export async function createBodyPhotoMeta(
  userId: string,
  input: Omit<BodyPhotoRow, "id" | "userId" | "createdAt">
) {
  const [row] = await db
    .insert(bodyPhotos)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function deleteBodyPhotoMeta(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(bodyPhotos)
    .where(and(eq(bodyPhotos.id, id), eq(bodyPhotos.userId, userId)));
}
