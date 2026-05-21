import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/** Browser-emitted subscription shape (PushSubscription.toJSON). */
export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * Upsert by `endpoint` — the same device re-subscribing should overwrite
 * its previous row instead of leaving orphans. Preserves the existing
 * enable flags if the row already exists; only the keys + user mapping
 * are refreshed.
 */
export async function upsertPushSubscription(
  userId: string,
  input: WebPushSubscriptionInput,
  meta: { userAgent?: string | null }
): Promise<PushSubscriptionRow> {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: meta.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: meta.userAgent ?? null,
      },
    })
    .returning();
  return row;
}

export async function deletePushSubscriptionByEndpoint(
  userId: string,
  endpoint: string
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function listPushSubscriptions(
  userId: string
): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/** All enabled subscriptions across all users — used by the daily cron. */
export async function listAllSubscriptions(): Promise<PushSubscriptionRow[]> {
  return db.select().from(pushSubscriptions);
}

export async function updateSubscriptionPrefs(
  userId: string,
  endpoint: string,
  patch: Partial<Pick<PushSubscriptionRow, "dailyWeightEnabled" | "photoDayEnabled">>
): Promise<PushSubscriptionRow | null> {
  const [row] = await db
    .update(pushSubscriptions)
    .set(patch)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    )
    .returning();
  return row ?? null;
}

/** Called when web-push returns 410 Gone / 404 Not Found — the push
 *  service has invalidated the subscription. Cron purges these inline
 *  so the table doesn't accumulate dead endpoints. */
export async function deleteByEndpoint(endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}
