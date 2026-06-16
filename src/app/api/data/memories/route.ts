import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createMemory,
  listMemories,
  type MemoryKind,
} from "@/lib/data/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listMemories(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      content?: string;
      kind?: MemoryKind;
      tags?: string[];
    };
    if (!input?.content?.trim()) throw new Error("content required");
    return createMemory(userId, {
      content: input.content.trim(),
      kind: input.kind,
      tags: input.tags,
    });
  });
}
