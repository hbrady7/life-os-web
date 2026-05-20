import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteBodyPhotoSession,
  updateBodyPhotoSession,
  type BodyPhotoEntry,
} from "@/lib/data/body-photo-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateBodyPhotoSession(
      userId,
      id,
      body as Partial<{ notes: string | null; photoKeys: BodyPhotoEntry[] }>
    )
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteBodyPhotoSession(userId, id);
    return { ok: true };
  });
}
