import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { updateRecipe, deleteRecipe } from "@/lib/data/recipes";
import type { Recipe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateRecipe(userId, id, body as Partial<Omit<Recipe, "id">>)
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteRecipe(userId, id);
    return { ok: true };
  });
}
