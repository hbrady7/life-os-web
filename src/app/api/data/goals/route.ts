import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createGoal, listAllGoals, listGoalsForDate } from "@/lib/data/goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  return withUser((userId) =>
    date ? listGoalsForDate(userId, date) : listAllGoals(userId)
  );
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createGoal(
      userId,
      body as {
        text: string;
        priority: "P1" | "P2" | "P3";
        date: string;
        emoji?: string | null;
        category?: string | null;
        timeEstimateMin?: number | null;
        order?: number;
        recurringGoalId?: string | null;
      }
    )
  );
}
