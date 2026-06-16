import { NextRequest, NextResponse } from "next/server";
import { getTodaysLearning } from "@/lib/daily-learning";
import { shiftDate, todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pre-generate today + tomorrow's "how it's made" so first page load is
 * instant. Wired to "0 5 * * *" in vercel.json. Lazy generation on first
 * request remains the baseline — this is just a warm-up. Vercel attaches
 * CRON_SECRET as a bearer token to scheduled requests.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "cron_secret_unset" }, { status: 503 });
  }
  if ((req.headers.get("authorization") || "") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = await getTodaysLearning(todayStr());
  const tomorrow = await getTodaysLearning(shiftDate(todayStr(), 1));
  return NextResponse.json({
    today: today?.subject ?? null,
    tomorrow: tomorrow?.subject ?? null,
  });
}
