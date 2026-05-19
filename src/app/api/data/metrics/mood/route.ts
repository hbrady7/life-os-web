import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { getMood, setMood } from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return missing();
  return withUser((userId) => getMood(userId, date));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, value } = body as { date: string; value: number };
    await setMood(userId, date, value);
    return getMood(userId, date);
  });
}

function missing() {
  return new Response(JSON.stringify({ error: "missing_date" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
