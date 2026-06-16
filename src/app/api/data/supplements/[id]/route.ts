import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteSupplement,
  updateSupplement,
  type SupplementWindow,
} from "@/lib/data/supplements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateSupplement(
      userId,
      id,
      body as Partial<{
        name: string;
        dose: string | null;
        window: SupplementWindow;
        note: string | null;
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
    await deleteSupplement(userId, id);
    return { ok: true };
  });
}
