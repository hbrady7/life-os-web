import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { setSteps, readStepsRange } from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return new Response(JSON.stringify({ error: "missing_range" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUserRequest(req, ({ userId }) => readStepsRange(userId, start, end));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, count, source } = body as {
      date: string;
      count: number;
      source?: "manual" | "sync";
    };
    await setSteps(userId, date, count, source ?? "manual");
    return { ok: true };
  });
}
