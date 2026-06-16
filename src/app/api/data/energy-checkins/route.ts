import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createEnergyCheckin,
  listEnergyCheckinsForDate,
} from "@/lib/data/energy-checkins";
import { ENERGY_STATE_SCORE, type EnergyState } from "@/lib/energy-curve";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayStr();
  return withUser((userId) => listEnergyCheckinsForDate(userId, date));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as { date?: string; state?: EnergyState };
    if (!input?.state || !(input.state in ENERGY_STATE_SCORE)) {
      throw new Error("valid state required");
    }
    return createEnergyCheckin(userId, {
      date: input.date ?? todayStr(),
      state: input.state,
    });
  });
}
