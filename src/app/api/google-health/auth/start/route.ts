import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAMES,
  readEnv,
} from "@/lib/integrations/google-health/config";
import {
  buildAuthUrl,
} from "@/lib/integrations/google-health/oauth-server";
import {
  challengeForVerifier,
  randomState,
  randomVerifier,
} from "@/lib/integrations/google-health/pkce";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Surfaces a clear error if env vars aren't set, rather than redirecting
    // to a half-formed Google URL.
    readEnv();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "env not configured" },
      { status: 500 }
    );
  }

  const verifier = randomVerifier();
  const challenge = await challengeForVerifier(verifier);
  const state = randomState();
  const url = buildAuthUrl({ state, codeChallenge: challenge });

  const res = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === "production";
  // 10 minutes is plenty for the consent round-trip.
  const maxAge = 60 * 10;
  res.cookies.set(COOKIE_NAMES.pkceVerifier, verifier, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.cookies.set(COOKIE_NAMES.oauthState, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  void req;
  return res;
}
