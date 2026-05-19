import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { readSleepRange, setSleep, type SleepStagesInput } from "@/lib/data/metrics";

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
  return withUserRequest(req, ({ userId }) => readSleepRange(userId, start, end));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, ...rest } = body as {
      date: string;
      hours?: number;
      score?: number;
      stages?: SleepStagesInput;
      wakeTime?: string;
      bedtime?: string;
    };
    await setSleep(userId, date, rest);
    return { ok: true };
  });
}
