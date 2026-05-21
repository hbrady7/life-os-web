import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { insertFact, listFacts, type FactValue } from "@/lib/data/user-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser(async (userId): Promise<unknown> => listFacts(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }): Promise<unknown> => {
    const input = body as Partial<FactValue> | undefined;
    const text = input?.text?.trim();
    if (!text) throw new Error("missing_text");
    const value: FactValue = {
      text,
      ...(input?.category ? { category: input.category } : {}),
    };
    return insertFact(userId, value);
  });
}
