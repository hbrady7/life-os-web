import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createRecurringGoal,
  listRecurringGoals,
} from "@/lib/data/goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listRecurringGoals(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createRecurringGoal(
      userId,
      body as Parameters<typeof createRecurringGoal>[1]
    )
  );
}
