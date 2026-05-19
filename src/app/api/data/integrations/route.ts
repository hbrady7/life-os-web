import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteIntegration,
  getIntegration,
  upsertIntegration,
} from "@/lib/data/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the integration shape WITHOUT the decrypted tokens — only the
 * client-visible status fields (email, needsReconnect, lastSyncedAt). */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider) {
    return new Response(JSON.stringify({ error: "missing_provider" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUser(async (userId) => {
    const row = await getIntegration(userId, provider);
    if (!row) return null;
    return {
      provider: row.provider,
      email: row.email,
      needsReconnect: row.needsReconnect,
      lastSyncedAt: row.lastSyncedAt,
      expiresAt: row.expiresAt,
      meta: row.meta,
    };
  });
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { provider, ...patch } = body as {
      provider: string;
    } & Parameters<typeof upsertIntegration>[2];
    await upsertIntegration(userId, provider, patch);
    return { ok: true };
  });
}

export async function DELETE(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider) {
    return new Response(JSON.stringify({ error: "missing_provider" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUser(async (userId) => {
    await deleteIntegration(userId, provider);
    return { ok: true };
  });
}
