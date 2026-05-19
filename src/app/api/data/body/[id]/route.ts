import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteBodyMeasurement,
  deleteBodyPhotoMeta,
  updateBodyMeasurement,
} from "@/lib/data/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateBodyMeasurement(
      userId,
      id,
      body as Parameters<typeof updateBodyMeasurement>[2]
    )
  );
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind");
  return withUser(async (userId) => {
    if (kind === "photo") await deleteBodyPhotoMeta(userId, id);
    else await deleteBodyMeasurement(userId, id);
    return { ok: true };
  });
}
