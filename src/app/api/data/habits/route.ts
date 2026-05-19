import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import { createHabit, listHabits } from "@/lib/data/habits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listHabits(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      name: string;
      icon: string;
      target?: number | null;
      order?: number;
    };
    return createHabit(userId, input);
  });
}
