import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { toggleRoutineLog, type RoutineKind } from "@/lib/data/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const { kind, itemId, date } = body as {
      kind: RoutineKind;
      itemId: string;
      date: string;
    };
    return toggleRoutineLog(userId, kind, itemId, date);
  });
}
