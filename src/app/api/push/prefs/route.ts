import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { updateSubscriptionPrefs } from "@/lib/data/push-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Update per-device opt-in flags for an existing subscription. Caller
 * passes the endpoint to identify which device; the userId guard in
 * `updateSubscriptionPrefs` ensures one user can't mute another's row.
 */
export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }): Promise<unknown> => {
    const input = body as
      | {
          endpoint?: string;
          dailyWeightEnabled?: boolean;
          photoDayEnabled?: boolean;
        }
      | undefined;
    if (!input?.endpoint) throw new Error("missing_endpoint");
    const patch: {
      dailyWeightEnabled?: boolean;
      photoDayEnabled?: boolean;
    } = {};
    if (typeof input.dailyWeightEnabled === "boolean") {
      patch.dailyWeightEnabled = input.dailyWeightEnabled;
    }
    if (typeof input.photoDayEnabled === "boolean") {
      patch.photoDayEnabled = input.photoDayEnabled;
    }
    const row = await updateSubscriptionPrefs(userId, input.endpoint, patch);
    if (!row) return { ok: false, error: "not_found" };
    return {
      ok: true,
      dailyWeightEnabled: row.dailyWeightEnabled,
      photoDayEnabled: row.photoDayEnabled,
    };
  });
}
