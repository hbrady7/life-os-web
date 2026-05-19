import { NextRequest } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { deleteWorkout } from "@/lib/data/workouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteWorkout(userId, id);
    return { ok: true };
  });
}
