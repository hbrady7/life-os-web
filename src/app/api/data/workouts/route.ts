import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  getWorkoutForDate,
  listWorkouts,
  upsertWorkout,
} from "@/lib/data/workouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  return withUser((userId) =>
    date ? getWorkoutForDate(userId, date) : listWorkouts(userId)
  );
}

/** Upsert the workout meta for a given date — one workout per day. */
export async function PUT(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const { date, ...patch } = body as {
      date: string;
      type?: string;
      durationMin?: number;
      intensity?: number;
      notes?: string | null;
    };
    return upsertWorkout(userId, date, patch);
  });
}
