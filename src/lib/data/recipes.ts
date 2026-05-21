import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import type { Recipe, RecipeIngredient } from "@/lib/types";

export type RecipeRow = typeof recipes.$inferSelect;

export function rowToRecipe(r: RecipeRow): Recipe {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? undefined,
    servings: r.servings,
    ingredients: r.ingredients as RecipeIngredient[],
    caloriesPerServing: r.caloriesPerServing,
    proteinPerServing: r.proteinPerServing ?? undefined,
    carbsPerServing: r.carbsPerServing ?? undefined,
    fatPerServing: r.fatPerServing ?? undefined,
    fiberPerServing: r.fiberPerServing ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRecipes(userId: string): Promise<Recipe[]> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.createdAt));
  return rows.map(rowToRecipe);
}

export async function createRecipe(
  userId: string,
  input: Omit<Recipe, "id">
): Promise<Recipe> {
  const [row] = await db
    .insert(recipes)
    .values({
      userId,
      name: input.name,
      icon: input.icon ?? null,
      servings: input.servings,
      ingredients: input.ingredients,
      caloriesPerServing: input.caloriesPerServing,
      proteinPerServing: input.proteinPerServing ?? null,
      carbsPerServing: input.carbsPerServing ?? null,
      fatPerServing: input.fatPerServing ?? null,
      fiberPerServing: input.fiberPerServing ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return rowToRecipe(row);
}

export async function updateRecipe(
  userId: string,
  id: string,
  patch: Partial<Omit<Recipe, "id">>
): Promise<Recipe | null> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.icon !== undefined) set.icon = patch.icon ?? null;
  if (patch.servings !== undefined) set.servings = patch.servings;
  if (patch.ingredients !== undefined) set.ingredients = patch.ingredients;
  if (patch.caloriesPerServing !== undefined)
    set.caloriesPerServing = patch.caloriesPerServing;
  if (patch.proteinPerServing !== undefined)
    set.proteinPerServing = patch.proteinPerServing ?? null;
  if (patch.carbsPerServing !== undefined)
    set.carbsPerServing = patch.carbsPerServing ?? null;
  if (patch.fatPerServing !== undefined)
    set.fatPerServing = patch.fatPerServing ?? null;
  if (patch.fiberPerServing !== undefined)
    set.fiberPerServing = patch.fiberPerServing ?? null;
  if (patch.notes !== undefined) set.notes = patch.notes ?? null;

  const [row] = await db
    .update(recipes)
    .set(set)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();
  return row ? rowToRecipe(row) : null;
}

export async function deleteRecipe(
  userId: string,
  id: string
): Promise<void> {
  await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
}
