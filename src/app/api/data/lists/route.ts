import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createListItem,
  listListItems,
  type ListKind,
} from "@/lib/data/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") as ListKind | null;
  const date = req.nextUrl.searchParams.get("date") ?? undefined;
  if (!kind) {
    return new Response(JSON.stringify({ error: "missing_kind" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return withUser((userId) => listListItems(userId, kind, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const { kind, ...rest } = body as {
      kind: ListKind;
      text: string;
      date: string;
      order?: number;
    };
    return createListItem(userId, kind, rest);
  });
}
