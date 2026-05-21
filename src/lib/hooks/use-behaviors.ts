"use client";

import useSWR, { mutate } from "swr";
import type { BehaviorLog } from "@/lib/types";

const KEY = "/api/data/behaviors";

export function useBehaviors() {
  const swr = useSWR<BehaviorLog[]>(KEY);
  return {
    behaviors: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

/**
 * Optimistic upsert — patches the date row immediately in cache, then
 * round-trips to the server. Rolls back on error.
 */
export async function setBehavior(
  date: string,
  patch: Partial<Omit<BehaviorLog, "date">>
): Promise<void> {
  await mutate<BehaviorLog[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(KEY, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date, patch }),
      });
      if (!res.ok) throw new Error(`upsert failed: ${res.status}`);
      const next: BehaviorLog = await res.json();
      const without = list.filter((b) => b.date !== date);
      return [next, ...without];
    },
    {
      optimisticData: (current) => {
        const list = current ?? [];
        const existing = list.find((b) => b.date === date);
        const merged: BehaviorLog = {
          ...(existing ?? { date }),
          ...patch,
          date,
        };
        const without = list.filter((b) => b.date !== date);
        return [merged, ...without];
      },
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function removeBehavior(date: string): Promise<void> {
  await mutate<BehaviorLog[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(`${KEY}/${date}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return list.filter((b) => b.date !== date);
    },
    {
      optimisticData: (current) => (current ?? []).filter((b) => b.date !== date),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
