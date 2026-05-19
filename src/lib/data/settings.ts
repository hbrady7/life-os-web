import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

export async function getSettings(
  userId: string
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return (row?.settings as Record<string, unknown> | undefined) ?? {};
}

export async function upsertSettings(
  userId: string,
  settings: Record<string, unknown>
): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId, settings })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { settings, updatedAt: new Date() },
    });
}
