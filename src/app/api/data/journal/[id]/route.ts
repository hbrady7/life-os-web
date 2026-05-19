import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteJournalEntry,
  updateJournalEntry,
} from "@/lib/data/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateJournalEntry(userId, id, body as Parameters<typeof updateJournalEntry>[2])
  );
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withUser(async (userId) => {
    await deleteJournalEntry(userId, id);
    return { ok: true };
  });
}
