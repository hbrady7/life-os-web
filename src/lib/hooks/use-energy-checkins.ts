"use client";

import useSWR, { mutate } from "swr";
import type { EnergyCheckinRow } from "@/lib/data/energy-checkins";
import type { EnergyState } from "@/lib/energy-curve";

const keyFor = (date: string) => `/api/data/energy-checkins?date=${date}`;

export function useEnergyCheckins(date: string) {
  const swr = useSWR<EnergyCheckinRow[]>(keyFor(date));
  return {
    checkins: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function createEnergyCheckinItem(
  date: string,
  state: EnergyState
): Promise<void> {
  const KEY = keyFor(date);
  await mutate<EnergyCheckinRow[]>(
    KEY,
    async (current) => {
      const res = await fetch("/api/data/energy-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date, state }),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: EnergyCheckinRow = await res.json();
      return [...(current ?? []), created];
    },
    { revalidate: true }
  );
}

export async function deleteEnergyCheckinItem(
  date: string,
  id: string
): Promise<void> {
  const KEY = keyFor(date);
  await mutate<EnergyCheckinRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`/api/data/energy-checkins/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return (current ?? []).filter((c) => c.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((c) => c.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
