import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { listHabitLogs, toggleHabitLog } from "@/lib/data/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listHabitLogs(userId));
}

/** Toggle a habit log entry for { habitId, date }. */
export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const { habitId, date } = body as { habitId: string; date: string };
    return toggleHabitLog(userId, habitId, date);
  });
}
