import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  archiveRoutineItem,
  deleteRoutineItem,
  updateRoutineItem,
  type RoutineKind,
} from "@/lib/data/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function kindOrError(req: NextRequest): RoutineKind | Response {
  const k = req.nextUrl.searchParams.get("kind") as RoutineKind | null;
  if (k !== "morning" && k !== "evening") {
    return new Response(JSON.stringify({ error: "invalid_kind" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return k;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const k = kindOrError(req);
  if (k instanceof Response) return k;
  const { id } = await ctx.params;
  return withUserRequest(req, ({ userId, body }) =>
    updateRoutineItem(userId, k, id, body as { name?: string; order?: number })
  );
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const k = kindOrError(req);
  if (k instanceof Response) return k;
  const { id } = await ctx.params;
  const archive = req.nextUrl.searchParams.get("archive") === "1";
  return withUser(async (userId) => {
    if (archive) await archiveRoutineItem(userId, k, id);
    else await deleteRoutineItem(userId, k, id);
    return { ok: true };
  });
}
