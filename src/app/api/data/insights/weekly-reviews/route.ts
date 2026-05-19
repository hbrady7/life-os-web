import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  dismissWeeklyReview,
  listWeeklyReviews,
  upsertWeeklyReview,
} from "@/lib/data/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listWeeklyReviews(userId));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { weekStart, ...rest } = body as {
      weekStart: string;
    } & Parameters<typeof upsertWeeklyReview>[2];
    await upsertWeeklyReview(userId, weekStart, rest);
    return { ok: true };
  });
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { weekStart } = body as { weekStart: string };
    await dismissWeeklyReview(userId, weekStart);
    return { ok: true };
  });
}
