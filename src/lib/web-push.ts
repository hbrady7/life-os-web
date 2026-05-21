/**
 * Server-only Web Push helpers. VAPID-gated — if the env vars aren't
 * set, every helper here returns false/no-ops cleanly so the rest of
 * the app (and the build) keeps working. This is intentional: push
 * notifications are an enhancement, not a hard requirement, and a
 * mis-deployed Vercel env shouldn't take down sign-in / sync.
 *
 * Why dynamic import: `web-push` reaches into the node crypto runtime
 * at import time. Lazy-loading via dynamic import keeps it out of
 * Edge bundles (middleware, edge route handlers) until something on
 * the Node runtime actually calls `sendPush`.
 */

import type { PushSubscriptionRow } from "@/lib/data/push-subscriptions";
import { deleteByEndpoint } from "@/lib/data/push-subscriptions";

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path the service worker should open on click. Defaults to "/". */
  url?: string;
  /** Tag groups follow-up notifications onto the same banner — prevents
   *  the user seeing two "Log your weight" notifications if the cron
   *  fires twice. */
  tag?: string;
};

/**
 * Send a single notification. Returns true on success. On 410/404
 * (subscription expired or unsubscribed at the browser level) the row
 * is purged from Neon and we resolve false. Any other error is logged
 * and swallowed so a single bad subscription doesn't fail the cron.
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<boolean> {
  if (!isWebPushConfigured()) return false;

  // Lazy-import keeps web-push out of Edge bundles.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 }
    );
    return true;
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      await deleteByEndpoint(sub.endpoint);
      return false;
    }
    console.error("[web-push] send failed", {
      endpoint: sub.endpoint.slice(0, 60) + "…",
      status,
      message: (e as Error)?.message,
    });
    return false;
  }
}
