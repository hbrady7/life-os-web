import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createBodyPhotoSession,
  listBodyPhotoSessions,
  type BodyPhotoEntry,
} from "@/lib/data/body-photo-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => listBodyPhotoSessions(userId));
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const input = body as {
      date: string;
      captureDate: string;
      photoKeys: BodyPhotoEntry[];
      notes?: string | null;
    };
    return createBodyPhotoSession(userId, input);
  });
}
