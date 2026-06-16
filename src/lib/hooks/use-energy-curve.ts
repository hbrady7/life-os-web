"use client";

import useSWR from "swr";
import type { EnergyCurve } from "@/lib/energy-curve";

export function useEnergyCurve(date: string) {
  const swr = useSWR<EnergyCurve>(`/api/vitality/energy-curve?date=${date}`);
  return { curve: swr.data, isLoading: swr.isLoading, error: swr.error };
}
