import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { listBehaviors, upsertBehavior } from "@/lib/data/behaviors";
import type { BehaviorLog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withUser((userId) => {
    const start = req.nextUrl.searchParams.get("start") ?? undefined;
    const end = req.nextUrl.searchParams.get("end") ?? undefined;
    return listBehaviors(userId, { start, end });
  });
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as { date: string; patch: Partial<Omit<BehaviorLog, "date">> };
    if (!input?.date) throw new Error("date required");
    return upsertBehavior(userId, input.date, input.patch ?? {});
  });
}
