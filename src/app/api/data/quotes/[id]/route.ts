import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { deleteQuote, updateQuote } from "@/lib/data/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateQuote(
      userId,
      id,
      body as Partial<{
        text: string;
        saidBy: string | null;
        context: string | null;
        heardAt: string | null;
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
    await deleteQuote(userId, id);
    return { ok: true };
  });
}
