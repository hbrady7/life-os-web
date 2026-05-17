import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { COOKIE_NAMES } from "@/lib/integrations/google-health/config";
import { revokeToken } from "@/lib/integrations/google-health/oauth-server";
import { clearTokens } from "@/lib/integrations/google-health/tokens-server";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  void _req;
  const jar = await nextCookies();
  const refresh = jar.get(COOKIE_NAMES.refreshToken)?.value;
  const access = jar.get(COOKIE_NAMES.accessToken)?.value;
  // Best-effort revoke; we always clear local state regardless of result.
  try {
    if (refresh) await revokeToken(refresh);
    else if (access) await revokeToken(access);
  } catch {
    // intentional: revoke failures shouldn't block disconnect
  }
  await clearTokens();
  return NextResponse.json({ ok: true });
}
