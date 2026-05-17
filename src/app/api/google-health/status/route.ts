import { NextResponse } from "next/server";
import { readStatus } from "@/lib/integrations/google-health/tokens-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await readStatus();
  return NextResponse.json(status);
}
