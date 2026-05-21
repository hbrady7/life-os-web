import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  listWorkoutHrSeries,
  getWorkoutHrSeries,
  upsertWorkoutHrSeries,
} from "@/lib/data/workout-hr-series";
import type { WorkoutHRSeries } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  return withUser(async (userId): Promise<unknown> =>
    sessionId ? getWorkoutHrSeries(userId, sessionId) : listWorkoutHrSeries(userId)
  );
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const input = body as { sessionId: string } & Omit<WorkoutHRSeries, "sessionId" | "syncedAt">;
    if (!input?.sessionId) throw new Error("sessionId required");
    const { sessionId, ...rest } = input;
    return upsertWorkoutHrSeries(userId, sessionId, rest);
  });
}
