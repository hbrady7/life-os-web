import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { deleteHabit, updateHabit } from "@/lib/data/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateHabit(
      userId,
      id,
      body as Partial<{
        name: string;
        icon: string;
        target: number | null;
        order: number;
      }>
    )
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteHabit(userId, id);
    return { ok: true };
  });
}
