import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { getWeight, setWeight } from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return missing();
  return withUser((userId) => getWeight(userId, date));
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
