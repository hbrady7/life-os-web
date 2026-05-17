/**
 * Server-only OAuth helpers — token exchange, refresh, revoke, userinfo.
 * Never import this from client components; it reads server env. The
 * `-server.ts` suffix is the convention; route handlers are the only
 * legitimate caller.
 */

import {
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_USERINFO_URL,
  GOOGLE_HEALTH_SCOPES,
  readEnv,
} from "./config";

export type GoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
};

export function buildAuthUrl(opts: {
  state: string;
  codeChallenge: string;
}): string {
  const env = readEnv();
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: GOOGLE_HEALTH_SCOPES.join(" "),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(opts: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokens> {
  const env = readEnv();
  const body = new URLSearchParams({
    code: opts.code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokens> {
  const env = readEnv();
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new RefreshFailedError(
      `Token refresh failed: ${res.status} ${text}`
    );
  }
  const json = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/** Marker error so route handlers can distinguish refresh failures (= reconnect needed). */
export class RefreshFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshFailedError";
  }
}

export async function revokeToken(token: string): Promise<void> {
  // Google's revoke endpoint accepts the access OR refresh token.
  const body = new URLSearchParams({ token });
  // Best-effort — a 200 on revoke just means "no longer valid".
  await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

type UserinfoResponse = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as UserinfoResponse;
  return json.email;
}
