import { withUser } from "@/lib/api-helpers";
import { deleteLearning } from "@/lib/data/daily-learnings";
import { getTodaysLearning } from "@/lib/daily-learning";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Manual "regenerate today" — drops today's row and generates a fresh one.
 * Auth-gated (any signed-in user); the daily learning is shared app-wide. */
export async function POST() {
  return withUser(async () => {
    const date = todayStr();
    await deleteLearning(date);
    const row = await getTodaysLearning(date);
    if (!row) throw new Error("generation_failed");
    return row;
  });
}
