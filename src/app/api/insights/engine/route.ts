/**
 * GET /api/insights/engine — compute the Insight Engine's cross-domain
 * correlations for the signed-in user and return them strongest-first.
 *
 * Side effect (intentional, mirrors the daily-learning lazy-generate
 * precedent): the freshly computed correlations are persisted into the
 * `insights` table under type "correlation" so the Mentor/Overseer can read
 * the same findings server-side without recomputing. Dismissed findings
 * (via the shared dismissed-patterns fingerprint blocklist) are filtered out.
 *
 * Query params:
 *   tz   — client timezone offset in minutes (Date.getTimezoneOffset()); makes
 *          caffeine-timing predictors use the user's local clock, not UTC.
 *   days — window size (default 90, clamped 30–180).
 */

import { NextRequest } from "next/server";
import { withUserRequest } from "@/lib/api-helpers";
import { assembleInsightSeries } from "@/lib/data/insight-series";
import { mineInsights } from "@/lib/insight-engine";
import {
  listDismissedPatterns,
  replaceInsightsOfType,
} from "@/lib/data/insights";
import { todayStr } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return withUserRequest(req, async ({ userId }) => {
    const url = new URL(req.url);
    const tz = clampInt(url.searchParams.get("tz"), -840, 840, 0);
    const days = clampInt(url.searchParams.get("days"), 30, 180, 90);

    const { series, windowDays } = await assembleInsightSeries(userId, {
      days,
      tzOffsetMinutes: tz,
    });
    const all = mineInsights(series, 8);

    // Drop anything the user has already dismissed (shared fingerprint list).
    const dismissed = new Set(
      (await listDismissedPatterns(userId)).map((d) => d.fingerprint)
    );
    const surviving = all.filter((i) => !dismissed.has(i.id));

    // Persist the snapshot for server-side consumers (the Mentor).
    await replaceInsightsOfType(
      userId,
      "correlation",
      todayStr(),
      surviving.map((i) => ({ content: i }))
    );

    return {
      insights: surviving,
      windowDays,
      computedAt: new Date().toISOString(),
    };
  });
}

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
