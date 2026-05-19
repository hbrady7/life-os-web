import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { getDayEntry, upsertDayEntry } from "@/lib/data/day-entries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return new Response(JSON.stringify({ error: "missing_date" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUser((userId) => getDayEntry(userId, date));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const { date, ...patch } = body as {
      date: string;
      dayType?: string;
      scoreCache?: number;
      sleepLogged?: boolean;
      journaled?: boolean;
    };
    return upsertDayEntry(userId, date, patch);
  });
}
