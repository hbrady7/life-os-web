import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  listSupplementLogsForDate,
  setSupplementTaken,
} from "@/lib/data/supplements";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  return withUser((userId) => listSupplementLogsForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      supplementId?: string;
      date?: string;
      taken?: boolean;
    };
    if (!input?.supplementId) throw new Error("supplementId required");
    await setSupplementTaken(
      userId,
      input.supplementId,
      input.date ?? todayStr(),
      input.taken ?? true
    );
    return { ok: true };
  });
}
