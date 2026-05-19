import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { getSettings, upsertSettings } from "@/lib/data/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => getSettings(userId));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    await upsertSettings(userId, body as Record<string, unknown>);
    return { ok: true };
  });
}
