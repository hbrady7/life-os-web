/**
 * Shared API helpers — DRY the boilerplate of "authenticate, run, JSON".
 *
 * Every /api/data/* route should funnel through `withUser` (or
 * `withUserRequest` when the handler needs the original request). This
 * is the single chokepoint enforcing the "no query runs without a
 * userId filter" discipline.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";

export async function withUser<T>(
  fn: (userId: string) => Promise<T>
): Promise<NextResponse> {
  const userOr = await requireUser();
  if (userOr instanceof NextResponse) return userOr;
  try {
    const result = await fn(userOr.id);
    return NextResponse.json(result ?? null);
  } catch (e) {
    console.error("[api] handler error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal" },
      { status: 500 }
    );
  }
}

export async function withUserRequest<T>(
  req: NextRequest,
  fn: (ctx: { userId: string; req: NextRequest; body: unknown }) => Promise<T>
): Promise<NextResponse> {
  const userOr = await requireUser();
  if (userOr instanceof NextResponse) return userOr;
  let body: unknown = undefined;
  try {
    if (req.method !== "GET" && req.method !== "DELETE") {
      const text = await req.text();
      body = text ? JSON.parse(text) : undefined;
    }
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_json", detail: e instanceof Error ? e.message : "" },
      { status: 400 }
    );
  }
  try {
    const result = await fn({ userId: userOr.id, req, body });
    return NextResponse.json(result ?? null);
  } catch (e) {
    console.error("[api] handler error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal" },
      { status: 500 }
    );
  }
}
