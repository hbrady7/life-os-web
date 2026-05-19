import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exercises, liftSessions, workouts } from "@/lib/db/schema";

export type WorkoutRow = typeof workouts.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type LiftSessionRow = typeof liftSessions.$inferSelect;

export async function getWorkoutForDate(
  userId: string,
  date: string
): Promise<WorkoutRow | null> {
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.date, date)));
  return row ?? null;
}

export async function listWorkouts(userId: string) {
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(asc(workouts.date));
}

export async function upsertWorkout(
  userId: string,
  date: string,
  patch: Partial<Pick<WorkoutRow, "type" | "durationMin" | "intensity" | "notes">>
): Promise<WorkoutRow> {
  const [row] = await db
    .insert(workouts)
    .values({
      userId,
      date,
      type: patch.type ?? "Other",
      durationMin: patch.durationMin ?? 0,
      intensity: patch.intensity ?? 0,
      notes: patch.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [workouts.userId, workouts.date],
      set: { ...patch },
    })
    .returning();
  return row;
}

export async function deleteWorkout(userId: string, id: string): Promise<void> {
  await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
}

// ── Exercises (children of workouts) ───────────────────────────────────────

export async function listExercises(userId: string, workoutId: string) {
  return db
    .select()
    .from(exercises)
    .where(
      and(eq(exercises.userId, userId), eq(exercises.workoutId, workoutId))
    );
}

export async function addExercise(
  userId: string,
  workoutId: string,
  input: { name: string; sets: unknown[] }
) {
  const [row] = await db
    .insert(exercises)
    .values({ userId, workoutId, name: input.name, sets: input.sets })
    .returning();
  return row;
}

export async function updateExercise(
  userId: string,
  id: string,
  patch: { name?: string; sets?: unknown[] }
) {
  const [row] = await db
    .update(exercises)
    .set(patch)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteExercise(userId: string, id: string): Promise<void> {
  await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, userId)));
}

// ── Lift sessions (RepCount-style) ─────────────────────────────────────────

export async function listLiftSessions(userId: string) {
  return db
    .select()
    .from(liftSessions)
    .where(eq(liftSessions.userId, userId))
    .orderBy(asc(liftSessions.date));
}

export async function createLiftSession(
  userId: string,
  input: { date: string; raw?: string; exercises: unknown[] }
) {
  const [row] = await db
    .insert(liftSessions)
    .values({
      userId,
      date: input.date,
      raw: input.raw ?? null,
      exercises: input.exercises,
    })
    .returning();
  return row;
}

export async function updateLiftSession(
  userId: string,
  id: string,
  patch: Partial<Pick<LiftSessionRow, "date" | "raw" | "exercises">>
) {
  const [row] = await db
    .update(liftSessions)
    .set(patch)
    .where(and(eq(liftSessions.id, id), eq(liftSessions.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteLiftSession(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(liftSessions)
    .where(and(eq(liftSessions.id, id), eq(liftSessions.userId, userId)));
}
