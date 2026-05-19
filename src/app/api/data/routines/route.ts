import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createRoutineItem,
  listRoutineItems,
  listRoutineLogs,
  type RoutineKind,
} from "@/lib/data/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function kindOrError(req: NextRequest): RoutineKind | Response {
  const kind = req.nextUrl.searchParams.get("kind") as RoutineKind | null;
  if (kind !== "morning" && kind !== "evening") {
    return new Response(JSON.stringify({ error: "invalid_kind" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return kind;
}

export async function GET(req: NextRequest) {
  const k = kindOrError(req);
  if (k instanceof Response) return k;
  const includeLogs = req.nextUrl.searchParams.get("logs") === "1";
  return withUser(async (userId) => {
    const items = await listRoutineItems(userId, k);
    if (!includeLogs) return { items };
    const logs = await listRoutineLogs(userId, k);
    return { items, logs };
  });
}

export async function POST(req: NextRequest) {
  const k = kindOrError(req);
  if (k instanceof Response) return k;
  return withUserRequest(req, ({ userId, body }) =>
    createRoutineItem(userId, k, body as { name: string; order?: number })
  );
}
