import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { addWater, getWater, setWater } from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return missing();
  return withUser((userId) => getWater(userId, date));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, oz, deltaOz } = body as {
      date: string;
      oz?: number;
      deltaOz?: number;
    };
    if (typeof deltaOz === "number") await addWater(userId, date, deltaOz);
    else if (typeof oz === "number") await setWater(userId, date, oz);
    return getWater(userId, date);
  });
}

function missing() {
  return new Response(JSON.stringify({ error: "missing_date" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
