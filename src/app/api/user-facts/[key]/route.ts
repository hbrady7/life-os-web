import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  deleteFact,
  updateFact,
  type FactValue,
} from "@/lib/data/user-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key } = await ctx.params;
  return withUserRequest(req, async ({ userId, body }): Promise<unknown> => {
    const input = body as Partial<FactValue> | undefined;
    const text = input?.text?.trim();
    if (!text) throw new Error("missing_text");
    const value: FactValue = {
      text,
      ...(input?.category ? { category: input.category } : {}),
    };
    const row = await updateFact(userId, key, value);
    if (!row) return { ok: false, error: "not_found" };
    return row;
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key } = await ctx.params;
  return withUser(async (userId): Promise<unknown> => {
    await deleteFact(userId, key);
    return { ok: true };
  });
}
