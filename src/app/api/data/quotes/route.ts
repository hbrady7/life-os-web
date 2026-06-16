import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createQuote, listQuotes } from "@/lib/data/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listQuotes(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      text?: string;
      saidBy?: string;
      context?: string;
      heardAt?: string;
    };
    if (!input?.text?.trim()) throw new Error("text required");
    return createQuote(userId, {
      text: input.text.trim(),
      saidBy: input.saidBy?.trim() || null,
      context: input.context?.trim() || null,
      heardAt: input.heardAt || null,
    });
  });
}
