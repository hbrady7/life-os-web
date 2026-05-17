/**
 * OAuth callback. Lives at /api/fitbit/callback because that's the
 * redirect URI registered in Google Cloud Console / .env.local. The rest
 * of the Google Health integration sits under /api/google-health/* — keep
 * this single legacy-named file aligned with `GOOGLE_HEALTH_REDIRECT_URI`.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/integrations/google-health/config";
import {
  exchangeCodeForTokens,
  fetchUserEmail,
} from "@/lib/integrations/google-health/oauth-server";
import { persistTokens } from "@/lib/integrations/google-health/tokens-server";

export const dynamic = "force-dynamic";

function settingsRedirect(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/settings", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.hash = "google-health";
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return settingsRedirect(req, { gh: "error", reason: error });
  }
  if (!code || !state) {
    return settingsRedirect(req, { gh: "error", reason: "missing_code" });
  }

  const expectedState = req.cookies.get(COOKIE_NAMES.oauthState)?.value;
  const verifier = req.cookies.get(COOKIE_NAMES.pkceVerifier)?.value;
  if (!expectedState || expectedState !== state || !verifier) {
    return settingsRedirect(req, { gh: "error", reason: "state_mismatch" });
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: verifier,
    });
    const email = await fetchUserEmail(tokens.accessToken);
    await persistTokens(tokens, { email });

    const res = settingsRedirect(req, { gh: "connected" });
    res.cookies.delete(COOKIE_NAMES.pkceVerifier);
    res.cookies.delete(COOKIE_NAMES.oauthState);
    return res;
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 80) : "exchange_failed";
    return settingsRedirect(req, { gh: "error", reason });
  }
}
