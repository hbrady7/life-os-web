import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createSupplement,
  listSupplements,
  type SupplementWindow,
} from "@/lib/data/supplements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listSupplements(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, async ({ userId, body }) => {
    const input = body as {
      name?: string;
      dose?: string;
      window?: SupplementWindow;
      note?: string;
      order?: number;
    };
    if (!input?.name?.trim()) throw new Error("name required");
    return createSupplement(userId, {
      name: input.name.trim(),
      dose: input.dose?.trim() || null,
      window: input.window,
      note: input.note?.trim() || null,
      order: input.order,
    });
  });
}
