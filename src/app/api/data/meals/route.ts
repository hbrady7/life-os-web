import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createMeal, listMealsForDate } from "@/lib/data/meals";

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
  return withUser((userId) => listMealsForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createMeal(userId, body as Parameters<typeof createMeal>[1])
  );
}
