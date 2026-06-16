"use client";

import useSWR from "swr";
import type { HydrationTarget } from "@/lib/hydration";

export function useHydrationTarget(date: string) {
  const swr = useSWR<HydrationTarget>(`/api/vitality/hydration?date=${date}`);
  return { target: swr.data, isLoading: swr.isLoading };
}
