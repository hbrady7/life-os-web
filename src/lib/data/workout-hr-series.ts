import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutHrSeries } from "@/lib/db/schema";
import type { WorkoutHRSeries, HRSample, ZoneMinutes } from "@/lib/types";

export type WorkoutHrSeriesRow = typeof workoutHrSeries.$inferSelect;

function rowToSeries(r: WorkoutHrSeriesRow): WorkoutHRSeries {
  return {
    sessionId: r.sessionId,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt.toISOString(),
    samples: (r.samples as HRSample[]) ?? [],
    peakBpm: r.peakBpm ?? undefined,
    avgBpm: r.avgBpm ?? undefined,
    caloriesBurned: r.caloriesBurned ?? undefined,
    zoneMinutes: (r.zoneMinutes as ZoneMinutes | null) ?? undefined,
    syncedAt: r.syncedAt.toISOString(),
  };
}

export async function listWorkoutHrSeries(userId: string): Promise<WorkoutHRSeries[]> {
  const rows = await db
    .select()
    .from(workoutHrSeries)
    .where(eq(workoutHrSeries.userId, userId))
    .orderBy(desc(workoutHrSeries.startedAt));
  return rows.map(rowToSeries);
}

export async function getWorkoutHrSeries(
  userId: string,
  sessionId: string
): Promise<WorkoutHRSeries | null> {
  const [row] = await db
    .select()
    .from(workoutHrSeries)
    .where(and(eq(workoutHrSeries.userId, userId), eq(workoutHrSeries.sessionId, sessionId)));
  return row ? rowToSeries(row) : null;
}

export async function upsertWorkoutHrSeries(
  userId: string,
  sessionId: string,
  input: Omit<WorkoutHRSeries, "sessionId" | "syncedAt">
): Promise<WorkoutHRSeries> {
  const payload = {
    sessionId,
    userId,
    startedAt: new Date(input.startedAt),
    endedAt: new Date(input.endedAt),
    samples: input.samples ?? [],
    peakBpm: input.peakBpm ?? null,
    avgBpm: input.avgBpm ?? null,
    caloriesBurned: input.caloriesBurned ?? null,
    zoneMinutes: input.zoneMinutes ?? null,
    syncedAt: new Date(),
  };
  const [row] = await db
    .insert(workoutHrSeries)
    .values(payload)
    .onConflictDoUpdate({
      target: workoutHrSeries.sessionId,
      set: {
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        samples: payload.samples,
        peakBpm: payload.peakBpm,
        avgBpm: payload.avgBpm,
        caloriesBurned: payload.caloriesBurned,
        zoneMinutes: payload.zoneMinutes,
        syncedAt: payload.syncedAt,
      },
    })
    .returning();
  return rowToSeries(row);
}

export async function deleteWorkoutHrSeries(
  userId: string,
  sessionId: string
): Promise<void> {
  await db
    .delete(workoutHrSeries)
    .where(and(eq(workoutHrSeries.userId, userId), eq(workoutHrSeries.sessionId, sessionId)));
}
