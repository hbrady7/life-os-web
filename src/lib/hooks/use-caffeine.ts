"use client";

import useSWR, { mutate } from "swr";
import type { CaffeineRow } from "@/lib/data/caffeine";

const keyFor = (date: string) => `/api/data/caffeine?date=${date}`;

export function useCaffeine(date: string) {
  const swr = useSWR<CaffeineRow[]>(keyFor(date));
  const logs = swr.data ?? [];
  return {
    logs,
    totalMg: logs.reduce((a, c) => a + (c.mg ?? 0), 0),
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function createCaffeineItem(
  date: string,
  input: { mg: number; label?: string }
): Promise<void> {
  const KEY = keyFor(date);
  await mutate<CaffeineRow[]>(
    KEY,
    async (current) => {
      const res = await fetch("/api/data/caffeine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: CaffeineRow = await res.json();
      return [...(current ?? []), created];
    },
    { revalidate: true }
  );
  // Energy curve depends on caffeine — refresh it for the same date.
  await mutate(`/api/vitality/energy-curve?date=${date}`);
}

export async function deleteCaffeineItem(
  date: string,
  id: string
): Promise<void> {
  const KEY = keyFor(date);
  await mutate<CaffeineRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`/api/data/caffeine/${id}`, {
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
  await mutate(`/api/vitality/energy-curve?date=${date}`);
}
