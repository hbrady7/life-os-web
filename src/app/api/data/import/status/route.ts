import { withUser } from "@/lib/api-helpers";
import { getImportStatus } from "@/lib/data/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser((userId) => getImportStatus(userId));
}
