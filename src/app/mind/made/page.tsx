import { getTodaysLearning } from "@/lib/daily-learning";
import { listRecentLearnings } from "@/lib/data/daily-learnings";
import { MadeClient } from "@/components/mind/made-client";

export const dynamic = "force-dynamic";

export default async function MadePage() {
  // First load of the day generates + persists today's entry; subsequent
  // loads read it. Wrapped so a generation/DB failure renders a graceful
  // empty state instead of 500-ing.
  let today = null;
  let archive: Awaited<ReturnType<typeof listRecentLearnings>> = [];
  try {
    [today, archive] = await Promise.all([
      getTodaysLearning(),
      listRecentLearnings(30),
    ]);
  } catch {
    today = null;
  }
  const past = today ? archive.filter((a) => a.id !== today!.id) : archive;
  return <MadeClient today={today} archive={past} />;
}
