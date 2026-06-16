"use client";

import useSWR, { mutate } from "swr";
import type { PlanBlockRow } from "@/lib/data/plan-blocks";

const keyFor = (date: string) => `/api/data/plan-blocks?date=${date}`;

export function usePlanBlocks(date: string) {
  const swr = useSWR<PlanBlockRow[]>(keyFor(date));
  return { blocks: swr.data ?? [], isLoading: swr.isLoading, error: swr.error };
}

/** Parse natural language into blocks (Gemini) + persist. Returns an error
 * message string on failure, or null on success. */
export async function parsePlanText(
  date: string,
  text: string
): Promise<string | null> {
  const res = await fetch("/api/vitality/plan-parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ date, text }),
  });
  if (!res.ok) {
    if (res.status === 503) return "AI isn't configured (missing Gemini key).";
    if (res.status === 422) return "Couldn't find any time blocks in that.";
    return "Couldn't parse that plan. Try again.";
  }
  await mutate(keyFor(date));
  return null;
}

export async function deletePlanBlockItem(
  date: string,
  id: string
): Promise<void> {
  const KEY = keyFor(date);
  await mutate<PlanBlockRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`/api/data/plan-blocks/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return (current ?? []).filter((b) => b.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((b) => b.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
