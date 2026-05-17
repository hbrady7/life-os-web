/**
 * Server-only token persistence. Tokens live in httpOnly cookies so the
 * client never touches them — only `/api/google-health/status` reads
 * metadata (connected/email/needsReconnect) and surfaces it to the UI.
 *
 * Convention: the `-server.ts` suffix marks files that must only be
 * imported from route handlers / server components — never from "use client".
 */

import { cookies as nextCookies } from "next/headers";
import { COOKIE_NAMES } from "./config";
import {
  GoogleTokens,
  RefreshFailedError,
  refreshAccessToken,
} from "./oauth-server";

const ACCESS_TOKEN_MAX_AGE_S = 60 * 60; // 1h — matches Google's typical lifetime
const REFRESH_TOKEN_MAX_AGE_S = 60 * 60 * 24 * 180; // 180d
const EMAIL_MAX_AGE_S = 60 * 60 * 24 * 365;

function isSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Persists tokens to httpOnly cookies. Pass `email` on first connect. */
export async function persistTokens(
  tokens: GoogleTokens,
  opts?: { email?: string }
): Promise<void> {
  const jar = await nextCookies();
  const secure = isSecure();
  jar.set(COOKIE_NAMES.accessToken, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_S,
  });
  if (tokens.refreshToken) {
    jar.set(COOKIE_NAMES.refreshToken, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE_S,
    });
  }
  jar.set(COOKIE_NAMES.expiresAt, String(tokens.expiresAt), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_S,
  });
  if (opts?.email) {
    jar.set(COOKIE_NAMES.email, opts.email, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: EMAIL_MAX_AGE_S,
    });
  }
  // Clear any prior reconnect flag on a successful re-auth.
  jar.delete(COOKIE_NAMES.needsReconnect);
}

export async function clearTokens(): Promise<void> {
  const jar = await nextCookies();
  jar.delete(COOKIE_NAMES.accessToken);
  jar.delete(COOKIE_NAMES.refreshToken);
  jar.delete(COOKIE_NAMES.expiresAt);
  jar.delete(COOKIE_NAMES.email);
  jar.delete(COOKIE_NAMES.needsReconnect);
}

export async function markNeedsReconnect(): Promise<void> {
  const jar = await nextCookies();
  jar.set(COOKIE_NAMES.needsReconnect, "1", {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_S,
  });
  // We keep the email so the UI can still show "Reconnect [email]".
  jar.delete(COOKIE_NAMES.accessToken);
  jar.delete(COOKIE_NAMES.refreshToken);
  jar.delete(COOKIE_NAMES.expiresAt);
}

export type ConnectionStatus = {
  connected: boolean;
  email?: string;
  needsReconnect: boolean;
};

export async function readStatus(): Promise<ConnectionStatus> {
  const jar = await nextCookies();
  const refresh = jar.get(COOKIE_NAMES.refreshToken)?.value;
  const email = jar.get(COOKIE_NAMES.email)?.value;
  const needsReconnect = jar.get(COOKIE_NAMES.needsReconnect)?.value === "1";
  return {
    connected: Boolean(refresh) && !needsReconnect,
    email,
    needsReconnect,
  };
}

/**
 * Returns a valid access token, refreshing first if the current one is
 * expired or near-expiry. Throws `RefreshFailedError` if refresh fails —
 * callers should mark needsReconnect and propagate to the UI.
 */
export async function getValidAccessToken(): Promise<string> {
  const jar = await nextCookies();
  const access = jar.get(COOKIE_NAMES.accessToken)?.value;
  const expiresAt = Number(jar.get(COOKIE_NAMES.expiresAt)?.value ?? "0");
  const refresh = jar.get(COOKIE_NAMES.refreshToken)?.value;

  // 60s skew buffer
  const fresh = access && expiresAt && expiresAt - Date.now() > 60_000;
  if (fresh && access) return access;

  if (!refresh) throw new RefreshFailedError("No refresh token");

  const next = await refreshAccessToken(refresh);
  await persistTokens(next);
  return next.accessToken;
}
