"use client";

import useSWR, { mutate } from "swr";
import type { EngineInsight } from "@/lib/insight-engine";
import { dismissPattern } from "./use-insights";

export type EngineInsightsResponse = {
  insights: EngineInsight[];
  windowDays: number;
  computedAt: string;
};

/** Stable per-session tz offset so the key doesn't churn. */
const TZ_OFFSET =
  typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;

const KEY = `/api/insights/engine?tz=${TZ_OFFSET}&days=90`;

export function useEngineInsights() {
  const swr = useSWR<EngineInsightsResponse>(KEY);
  return {
    insights: swr.data?.insights ?? [],
    windowDays: swr.data?.windowDays ?? 90,
    computedAt: swr.data?.computedAt ?? null,
    isLoading: swr.isLoading,
    error: swr.error as Error | undefined,
  };
}

/**
 * Dismiss a correlation. Reuses the shared dismissed-patterns fingerprint
 * blocklist (the engine filters against it), then optimistically drops it from
 * the local list and revalidates.
 */
export async function dismissEngineInsight(
  insight: EngineInsight
): Promise<void> {
  await mutate<EngineInsightsResponse>(
    KEY,
    (cur) =>
      cur
        ? { ...cur, insights: cur.insights.filter((i) => i.id !== insight.id) }
        : cur,
    { revalidate: false }
  );
  await dismissPattern(insight.id, insight.headline);
  await mutate(KEY);
}
