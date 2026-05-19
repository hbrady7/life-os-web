import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { markImportSkipped, runImport } from "@/lib/data/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { action: "import", payload }  → runs the import + returns counts.
 *  POST { action: "skip" }            → marks the user as opted-out. */
export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const action = (body as { action?: string })?.action;
    if (action === "skip") {
      await markImportSkipped(userId);
      return { ok: true, skipped: true };
    }
    if (action === "import") {
      const payload = (body as { payload?: Record<string, unknown> })?.payload;
      if (!payload) throw new Error("missing payload");
      const counts = await runImport(
        userId,
        payload as Parameters<typeof runImport>[1]
      );
      return { ok: true, counts };
    }
    throw new Error("invalid action");
  });
}
