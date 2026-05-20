import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bodyPhotoSessions } from "@/lib/db/schema";

export type BodyPhotoSessionRow = typeof bodyPhotoSessions.$inferSelect;

export type BodyPhotoEntry = {
  key: string;
  angle: "front" | "side" | "back" | null;
  takenAt: string;
};

export async function listBodyPhotoSessions(userId: string) {
  return db
    .select()
    .from(bodyPhotoSessions)
    .where(eq(bodyPhotoSessions.userId, userId))
    .orderBy(desc(bodyPhotoSessions.date), desc(bodyPhotoSessions.createdAt));
}

export async function createBodyPhotoSession(
  userId: string,
  input: {
    date: string;
    captureDate: string;
    photoKeys: BodyPhotoEntry[];
    notes?: string | null;
  }
) {
  const [row] = await db
    .insert(bodyPhotoSessions)
    .values({
      userId,
      date: input.date,
      captureDate: input.captureDate,
      photoKeys: input.photoKeys,
      notes: input.notes ?? null,
    })
    .returning();
  return row;
}

export async function updateBodyPhotoSession(
  userId: string,
  id: string,
  patch: Partial<{ notes: string | null; photoKeys: BodyPhotoEntry[] }>
) {
  const [row] = await db
    .update(bodyPhotoSessions)
    .set(patch)
    .where(
      and(
        eq(bodyPhotoSessions.id, id),
        eq(bodyPhotoSessions.userId, userId)
      )
    )
    .returning();
  return row ?? null;
}

export async function deleteBodyPhotoSession(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(bodyPhotoSessions)
    .where(
      and(
        eq(bodyPhotoSessions.id, id),
        eq(bodyPhotoSessions.userId, userId)
      )
    );
}

/**
 * Attribute a real capture date to its nearest "official" session date
 * (1st or 15th of the month). Captures within 3 days of the 1st snap
 * to the 1st, within 13–17 to the 15th. Outside those windows we
 * attribute to the actual capture day so off-cadence sessions still
 * have a stable PK and don't clobber a real 1st/15th.
 */
export function targetDateFor(actualDate: string): string {
  const [yy, mm, dd] = actualDate.split("-").map(Number);
  if (!yy || !mm || !dd) return actualDate;
  const mmStr = String(mm).padStart(2, "0");
  if (dd <= 3) return `${yy}-${mmStr}-01`;
  if (dd >= 13 && dd <= 17) return `${yy}-${mmStr}-15`;
  return actualDate;
}
