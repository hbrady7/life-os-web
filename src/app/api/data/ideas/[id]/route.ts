import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { deleteIdea, updateIdea, type IdeaStatus } from "@/lib/data/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateIdea(
      userId,
      id,
      body as Partial<{
        title: string;
        body: string | null;
        status: IdeaStatus;
        tags: string[] | null;
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
    await deleteIdea(userId, id);
    return { ok: true };
  });
}
