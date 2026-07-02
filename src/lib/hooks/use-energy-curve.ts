"use client";

import useSWR from "swr";
import type { EnergyCurve } from "@/lib/energy-curve";

const TZ_OFFSET =
  typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;

export function useEnergyCurve(date: string) {
  const swr = useSWR<EnergyCurve>(
    `/api/vitality/energy-curve?date=${date}&tz=${TZ_OFFSET}`
  );
  return { curve: swr.data, isLoading: swr.isLoading, error: swr.error };
}
