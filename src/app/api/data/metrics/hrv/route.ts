import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { readHrvRange, setHrv } from "@/lib/data/metrics";

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
  return withUserRequest(req, ({ userId }) => readHrvRange(userId, start, end));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, ms } = body as { date: string; ms: number };
    await setHrv(userId, date, ms);
    return { ok: true };
  });
}
