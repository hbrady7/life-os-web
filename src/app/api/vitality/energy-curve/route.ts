import { NextRequest } from "next/server";
import { withUser } from "@/lib/api-helpers";
import { predictEnergyCurve } from "@/lib/energy-curve";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  return withUser((userId) => predictEnergyCurve(userId, date));
}
