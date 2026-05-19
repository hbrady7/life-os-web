import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteRecurringGoal,
  updateRecurringGoal,
} from "@/lib/data/goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateRecurringGoal(
      userId,
      id,
      body as Parameters<typeof updateRecurringGoal>[2]
    )
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteRecurringGoal(userId, id);
    return { ok: true };
  });
}
