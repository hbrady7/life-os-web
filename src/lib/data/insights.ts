import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dismissedPatterns,
  insights,
  weeklyReviews,
} from "@/lib/db/schema";

export type InsightRow = typeof insights.$inferSelect;
export type WeeklyReviewRow = typeof weeklyReviews.$inferSelect;

export async function listInsights(userId: string, limit = 30) {
  return db
    .select()
    .from(insights)
    .where(eq(insights.userId, userId))
    .orderBy(desc(insights.date))
    .limit(limit);
}

export async function createInsight(
  userId: string,
  input: { date: string; content: unknown; type: string }
) {
  const [row] = await db
    .insert(insights)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function dismissInsight(userId: string, id: string) {
  await db
    .update(insights)
    .set({ dismissedAt: new Date() })
    .where(and(eq(insights.id, id), eq(insights.userId, userId)));
}

/** All non-dismissed insight rows of a given `type`, newest first. */
export async function listInsightsByType(
  userId: string,
  type: string,
  limit = 12
) {
  return db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.type, type),
        isNull(insights.dismissedAt)
      )
    )
    .orderBy(desc(insights.date))
    .limit(limit);
}

/**
 * Idempotently replace the current snapshot of a computed insight `type`
 * (e.g. the Insight Engine's "correlation" rows). Old rows of that type are
 * cleared and the fresh set is written under today's date — so the table
 * always holds exactly the latest computation for the Mentor to read.
 * Additive to the schema; only ever touches rows of this `type`.
 */
export async function replaceInsightsOfType(
  userId: string,
  type: string,
  date: string,
  rows: Array<{ content: unknown }>
) {
  await db
    .delete(insights)
    .where(and(eq(insights.userId, userId), eq(insights.type, type)));
  if (rows.length === 0) return [];
  return db
    .insert(insights)
    .values(rows.map((r) => ({ userId, date, type, content: r.content })))
    .returning();
}

// ── Dismissed patterns (fingerprint blocklist) ─────────────────────────────

export async function listDismissedPatterns(userId: string) {
  return db
    .select()
    .from(dismissedPatterns)
    .where(eq(dismissedPatterns.userId, userId));
}

export async function dismissPattern(
  userId: string,
  fingerprint: string,
  headline: string
) {
  await db
    .insert(dismissedPatterns)
    .values({ userId, fingerprint, headline })
    .onConflictDoNothing({
      target: [dismissedPatterns.userId, dismissedPatterns.fingerprint],
    });
}

export async function restoreDismissedPattern(
  userId: string,
  fingerprint: string
) {
  await db
    .delete(dismissedPatterns)
    .where(
      and(
        eq(dismissedPatterns.userId, userId),
        eq(dismissedPatterns.fingerprint, fingerprint)
      )
    );
}

// ── Weekly reviews ─────────────────────────────────────────────────────────

export async function listWeeklyReviews(userId: string) {
  return db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.userId, userId))
    .orderBy(desc(weeklyReviews.weekStart));
}

export async function upsertWeeklyReview(
  userId: string,
  weekStart: string,
  data: Omit<WeeklyReviewRow, "userId" | "weekStart" | "generatedAt">
) {
  await db
    .insert(weeklyReviews)
    .values({ userId, weekStart, ...data })
    .onConflictDoUpdate({
      target: [weeklyReviews.userId, weeklyReviews.weekStart],
      set: { ...data },
    });
}

export async function dismissWeeklyReview(userId: string, weekStart: string) {
  await db
    .update(weeklyReviews)
    .set({ dismissed: true })
    .where(
      and(
        eq(weeklyReviews.userId, userId),
        eq(weeklyReviews.weekStart, weekStart)
      )
    );
}
