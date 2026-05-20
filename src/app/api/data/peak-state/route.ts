import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  getPeakStateForDate,
  readPeakStateRange,
  upsertPeakState,
} from "@/lib/data/peak-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET supports two modes:
 *   ?date=YYYY-MM-DD            → today's row (or null)
 *   ?start=YYYY-MM-DD&end=...   → range for the 30-day trend chart
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (date) {
    return withUser((userId) => getPeakStateForDate(userId, date));
  }
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return new Response(JSON.stringify({ error: "missing_range_or_date" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUser((userId) => readPeakStateRange(userId, start, end));
}

/** PUT lets the client request a refresh — the pipeline runs server-side
 * (Commit 3) and the result lands in peak_state_logs. Clients normally
 * call POST /api/peak-state/recompute (Commit 3) instead of this route;
 * we expose PUT here for one-off testing / manual seeding. */
export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, ...payload } = body as {
      date: string;
      peakState: number | null;
      recovery: number | null;
      strain: number | null;
      lifestyle: number | null;
      recommendation: string | null;
      contributors: unknown;
      availableInputs: number;
    };
    return upsertPeakState(userId, date, payload);
  });
}
