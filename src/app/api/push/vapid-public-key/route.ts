import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the VAPID public key so the client can subscribe. 404 when
 * unconfigured — the Settings card uses that to render a "not available"
 * empty state instead of trying to subscribe and failing.
 */
export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "vapid_not_configured" }, { status: 404 });
  }
  return NextResponse.json({ key });
}
