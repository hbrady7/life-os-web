import { NextRequest } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { deleteBehavior } from "@/lib/data/behaviors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ date: string }> }
) {
  const { date } = await ctx.params;
  return withUser(async (userId) => {
    await deleteBehavior(userId, date);
    return { ok: true };
  });
}
