import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createPlanBlocks,
  listPlanBlocksForDate,
  type PlanBlockInput,
} from "@/lib/data/plan-blocks";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  return withUser((userId) => listPlanBlocksForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as { date?: string; blocks?: PlanBlockInput[] };
    if (!input?.blocks?.length) throw new Error("blocks required");
    return createPlanBlocks(userId, input.date ?? todayStr(), input.blocks);
  });
}
