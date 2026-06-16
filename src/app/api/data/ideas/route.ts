import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createIdea, listIdeas, type IdeaStatus } from "@/lib/data/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listIdeas(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      title?: string;
      body?: string;
      status?: IdeaStatus;
      tags?: string[];
    };
    if (!input?.title?.trim()) throw new Error("title required");
    return createIdea(userId, {
      title: input.title.trim(),
      body: input.body?.trim() || null,
      status: input.status,
      tags: input.tags,
    });
  });
}
