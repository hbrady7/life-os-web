import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { deletePushSubscriptionByEndpoint } from "@/lib/data/push-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }): Promise<unknown> => {
    const input = body as { endpoint?: string } | undefined;
    if (!input?.endpoint) throw new Error("missing_endpoint");
    await deletePushSubscriptionByEndpoint(userId, input.endpoint);
    return { ok: true };
  });
}
