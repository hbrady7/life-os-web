import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import {
  upsertPushSubscription,
  type WebPushSubscriptionInput,
} from "@/lib/data/push-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body, req }): Promise<unknown> => {
    const input = body as
      | { subscription?: WebPushSubscriptionInput }
      | undefined;
    if (!input?.subscription?.endpoint || !input.subscription.keys?.p256dh) {
      throw new Error("invalid_subscription");
    }
    const row = await upsertPushSubscription(userId, input.subscription, {
      userAgent: req.headers.get("user-agent"),
    });
    return {
      ok: true,
      id: row.id,
      dailyWeightEnabled: row.dailyWeightEnabled,
      photoDayEnabled: row.photoDayEnabled,
    };
  });
}
