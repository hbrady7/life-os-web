import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createSavedMeal, listSavedMeals } from "@/lib/data/meals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listSavedMeals(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createSavedMeal(userId, body as Parameters<typeof createSavedMeal>[1])
  );
}
