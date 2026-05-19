import { and, desc, eq } from "drizzle-orm";
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
