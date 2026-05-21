import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { listRecipes, createRecipe } from "@/lib/data/recipes";
import type { Recipe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listRecipes(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    return createRecipe(userId, body as Omit<Recipe, "id">);
  });
}
