import { NextRequest } from "next/server";
import { withUser, withUserRequest } from "@/lib/api-helpers";
import {
  createJournalEntry,
  listJournalEntries,
  listJournalEntriesForDate,
} from "@/lib/data/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  return withUser((userId) =>
    date ? listJournalEntriesForDate(userId, date) : listJournalEntries(userId)
  );
}

export async function POST(req: NextRequest) {
  return withUserRequest(req, ({ userId, body }) =>
    createJournalEntry(
      userId,
      body as Parameters<typeof createJournalEntry>[1]
    )
  );
}
