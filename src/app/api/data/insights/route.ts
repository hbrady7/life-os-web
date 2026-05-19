import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createInsight, listInsights } from "@/lib/data/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listInsights(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createInsight(
      userId,
      body as { date: string; content: unknown; type: string }
    )
  );
}
