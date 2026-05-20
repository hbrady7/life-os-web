import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { getWeight, readWeightRange, setWeight } from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET supports two modes:
 *   ?date=YYYY-MM-DD            → single-day row (or null)
 *   ?start=YYYY-MM-DD&end=...   → range, oldest → newest, for the
 *                                 daily trend chart + rolling average
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (date) return withUser((userId) => getWeight(userId, date));
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (start && end) {
    return withUser((userId) => readWeightRange(userId, start, end));
  }
  return missing();
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, lb, source } = body as {
      date: string;
      lb: number;
      source?: "manual" | "sync";
    };
    await setWeight(userId, date, lb, source ?? "manual");
    return getWeight(userId, date);
  });
}

function missing() {
  return new Response(JSON.stringify({ error: "missing_date" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
