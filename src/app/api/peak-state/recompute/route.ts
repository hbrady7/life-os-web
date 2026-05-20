/**
 * POST /api/peak-state/recompute
 *
 * Gathers inputs, runs computePeakState, upserts the row. Body is
 * optional: `{ date?: "YYYY-MM-DD" }`. Defaults to today server-side.
 *
 * Clients fire-and-forget this whenever an input changes (mood, energy,
 * water entered) or a sync completes. The Today screen calls it on
 * mount if the cached row is missing or older than 1h.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { recomputeForUser } from "@/lib/peak-state/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let date: string | undefined;
  try {
    const body = (await req.json()) as { date?: string } | null;
    date = body?.date;
  } catch {
    /* empty body is fine */
  }
  try {
    const { row, output } = await recomputeForUser(user.id, date);
    return NextResponse.json({
      ok: true,
      row,
      output: {
        availableInputs: output.availableInputs,
        baselineStatus: output.baselineStatus,
      },
    });
  } catch (e) {
    console.error("[peak-state] recompute failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "compute_failed" },
      { status: 500 }
    );
  }
}
