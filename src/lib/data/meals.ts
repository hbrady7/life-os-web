import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { meals, savedMeals } from "@/lib/db/schema";

export type MealRow = typeof meals.$inferSelect;
export type SavedMealRow = typeof savedMeals.$inferSelect;

export async function listMealsForDate(userId: string, date: string) {
  return db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.date, date)))
    .orderBy(asc(meals.time), asc(meals.createdAt));
}

export async function createMeal(
  userId: string,
  input: Omit<MealRow, "id" | "userId" | "createdAt"> & {
    aiAnalysis?: unknown;
  }
) {
  const [row] = await db
    .insert(meals)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function updateMeal(
  userId: string,
  id: string,
  patch: Partial<MealRow>
) {
  const [row] = await db
    .update(meals)
    .set(patch)
    .where(and(eq(meals.id, id), eq(meals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteMeal(userId: string, id: string): Promise<void> {
  await db
    .delete(meals)
    .where(and(eq(meals.id, id), eq(meals.userId, userId)));
}

// ── Saved meals (quick-tap chips) ──────────────────────────────────────────

export async function listSavedMeals(userId: string) {
  return db
    .select()
    .from(savedMeals)
    .where(eq(savedMeals.userId, userId))
    .orderBy(asc(savedMeals.useCount));
}

export async function createSavedMeal(
  userId: string,
  input: Omit<SavedMealRow, "id" | "userId" | "createdAt" | "useCount">
) {
  const [row] = await db
    .insert(savedMeals)
    .values({ userId, ...input, useCount: 0 })
    .returning();
  return row;
}

export async function updateSavedMeal(
  userId: string,
  id: string,
  patch: Partial<SavedMealRow>
) {
  const [row] = await db
    .update(savedMeals)
    .set(patch)
    .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteSavedMeal(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(savedMeals)
    .where(and(eq(savedMeals.id, id), eq(savedMeals.userId, userId)));
}
