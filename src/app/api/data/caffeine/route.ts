import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createCaffeineLog, listCaffeineForDate } from "@/lib/data/caffeine";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  return withUser((userId) => listCaffeineForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as { mg?: number; label?: string };
    if (typeof input?.mg !== "number" || !Number.isFinite(input.mg) || input.mg <= 0) {
      throw new Error("valid mg required");
    }
    return createCaffeineLog(userId, {
      mg: Math.round(input.mg),
      label: input.label?.trim() || null,
    });
  });
}
