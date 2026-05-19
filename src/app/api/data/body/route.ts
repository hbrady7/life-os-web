import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createBodyMeasurement,
  createBodyPhotoMeta,
  listBodyMeasurements,
  listBodyPhotos,
} from "@/lib/data/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  return withUser((userId) =>
    kind === "photos" ? listBodyPhotos(userId) : listBodyMeasurements(userId)
  );
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) => {
    const payload = body as { kind: "measurement" | "photo" } & Record<
      string,
      unknown
    >;
    const { kind, ...rest } = payload;
    if (kind === "photo") {
      return createBodyPhotoMeta(
        userId,
        rest as Parameters<typeof createBodyPhotoMeta>[1]
      );
    }
    return createBodyMeasurement(
      userId,
      rest as Parameters<typeof createBodyMeasurement>[1]
    );
  });
}
