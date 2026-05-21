import { NextRequest } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { deleteWorkoutHrSeries } from "@/lib/data/workout-hr-series";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return withUser(async (userId) => {
    await deleteWorkoutHrSeries(userId, sessionId);
    return { ok: true };
  });
}
