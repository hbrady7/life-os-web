import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  dismissPattern,
  listDismissedPatterns,
  restoreDismissedPattern,
} from "@/lib/data/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listDismissedPatterns(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { fingerprint, headline } = body as {
      fingerprint: string;
      headline: string;
    };
    await dismissPattern(userId, fingerprint, headline);
    return { ok: true };
  });
}

export async function DELETE(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { fingerprint } = body as { fingerprint: string };
    await restoreDismissedPattern(userId, fingerprint);
    return { ok: true };
  });
}
