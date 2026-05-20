"use client";

import * as React from "react";
import useSWR from "swr";
import type { PeakStateRow } from "@/lib/data/peak-state";
import type { Contributor, Recommendation, BaselineStatus } from "@/lib/peak-state/compute";
import { triggerPeakStateRecompute } from "@/lib/peak-state/client";

/**
 * Reads today's peak-state row from /api/data/peak-state and triggers
 * a server-side recompute when:
 *   • the row doesn't exist yet (first compute of the day)
 *   • the row's computed_at is older than 1h (stale)
 *
 * The trigger fires once per mount; concurrent calls collapse via
 * triggerPeakStateRecompute's inflight map.
 */

const STALE_AFTER_MS = 60 * 60 * 1000;
const keyFor = (date: string) => `/api/data/peak-state?date=${date}`;

export type PeakStateView = {
  row: PeakStateRow | null;
  isLoading: boolean;
  /** Sub-score numbers + contributors hydrated from the row. */
  contributors: Contributor[];
  recommendation: Recommendation | null;
  baselineStatus: BaselineStatus | null;
  /** True while a recompute is in flight after the initial fetch. */
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export function usePeakState(date: string): PeakStateView {
  const swr = useSWR<PeakStateRow | null>(keyFor(date));
  const [refreshing, setRefreshing] = React.useState(false);

  // Trigger a recompute if the row is missing or stale. We do this in
  // an effect (not during render) so React doesn't yell about side
  // effects in the render phase.
  React.useEffect(() => {
    if (swr.isLoading) return;
    const row = swr.data;
    const stale =
      !row ||
      !row.computedAt ||
      Date.now() - new Date(row.computedAt).getTime() > STALE_AFTER_MS;
    if (!stale) return;
    setRefreshing(true);
    triggerPeakStateRecompute(date).finally(() => setRefreshing(false));
  }, [date, swr.isLoading, swr.data]);

  const row = swr.data ?? null;
  // `contributors` is JSONB — Drizzle returns it as `unknown`; we narrow
  // here so consumers don't repeat the cast.
  const contributors = (row?.contributors as Contributor[] | undefined) ?? [];
  const recommendation = (row?.recommendation as Recommendation | null) ?? null;
  return {
    row,
    isLoading: swr.isLoading,
    contributors,
    recommendation,
    baselineStatus: null, // hydrated client-side from inputs in detail sheet
    refreshing,
    refresh: async () => {
      setRefreshing(true);
      await triggerPeakStateRecompute(date);
      setRefreshing(false);
    },
  };
}
