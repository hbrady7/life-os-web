import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  clearEnergy,
  getEnergyForDate,
  setEnergy,
  type EnergyPeriod,
} from "@/lib/data/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return missing();
  return withUser((userId) => getEnergyForDate(userId, date));
}

export async function PUT(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, period, value } = body as {
      date: string;
      period: EnergyPeriod;
      value: number;
    };
    await setEnergy(userId, date, period, value);
    return getEnergyForDate(userId, date);
  });
}

export async function DELETE(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const { date, period } = body as {
      date: string;
      period: EnergyPeriod;
    };
    await clearEnergy(userId, date, period);
    return getEnergyForDate(userId, date);
  });
}

function missing() {
  return new Response(JSON.stringify({ error: "missing_date" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
