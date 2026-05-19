import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createBlock, listBlocksForDate } from "@/lib/data/schedule";

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
  return withUser((userId) => listBlocksForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createBlock(userId, body as Parameters<typeof createBlock>[1])
  );
}
