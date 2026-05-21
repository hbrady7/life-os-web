/**
 * GET /api/workout-hr/detected-sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Lists watch-detected exercise sessions in the given civil-date window.
 * The client uses these to prompt "Import as workout?" — see
 * components/workout/detected-session-card.tsx.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import {
  getValidAccessToken,
  markNeedsReconnect,
} from "@/lib/integrations/google-health/tokens-server";
import { RefreshFailedError } from "@/lib/integrations/google-health/oauth-server";
import {
  fetchExerciseSessions,
  type DetectedSession,
} from "@/lib/integrations/google-health/heart-rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuccessResponse = { ok: true; sessions: DetectedSession[] };
type ErrorResponse = { ok: false; error: string };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userOr = await requireUser();
  if (userOr instanceof NextResponse) return userOr;

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json<ErrorResponse>(
      { ok: false, error: "missing start/end" },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (e) {
    if (e instanceof RefreshFailedError) {
      await markNeedsReconnect();
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "needs_reconnect" },
        { status: 401 }
      );
    }
    return NextResponse.json<ErrorResponse>(
      { ok: false, error: "token_error" },
      { status: 401 }
    );
  }

  const startTime = `${start}T00:00:00Z`;
  const endTime = `${end}T23:59:59Z`;

  let sessions: DetectedSession[];
  try {
    sessions = await fetchExerciseSessions({
      accessToken,
      startTime,
      endTime,
    });
  } catch (e) {
    if (e instanceof RefreshFailedError) {
      await markNeedsReconnect();
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "needs_reconnect" },
        { status: 401 }
      );
    }
    console.error("[workout-hr/detected-sessions] fetch error", e);
    return NextResponse.json<ErrorResponse>(
      { ok: false, error: e instanceof Error ? e.message : "fetch_error" },
      { status: 500 }
    );
  }

  return NextResponse.json<SuccessResponse>({ ok: true, sessions });
}
