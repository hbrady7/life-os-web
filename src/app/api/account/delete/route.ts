/**
 * POST /api/account/delete
 *
 * Hard-deletes the authenticated user's row from the `users` table. Because
 * every per-user table is declared with `references(() => users.id, {
 * onDelete: "cascade" })`, this cascades through every entity in the schema
 * (settings, day entries, goals, habits, journal, lift sessions, meals,
 * metrics, behaviors, recipes, fasting windows, workout routines, workout HR
 * series, push subscriptions, integrations, etc.).
 *
 * This endpoint is the in-app account-deletion path required by App Store
 * Review Guideline 5.1.1(v) for any app that supports account creation —
 * Apple will reject without it.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const userOr = await requireUser();
  if (userOr instanceof NextResponse) return userOr;

  try {
    await db.delete(users).where(eq(users.id, userOr.id));
  } catch (e) {
    console.error("[account/delete] cascade delete failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
