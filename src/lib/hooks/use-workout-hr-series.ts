"use client";
import useSWR, { mutate } from "swr";
import type { WorkoutHRSeries } from "@/lib/types";

const KEY_LIST = "/api/data/workout-hr-series";

export function useWorkoutHrSeriesList() {
  const swr = useSWR<WorkoutHRSeries[]>(KEY_LIST);
  return {
    series: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export function useWorkoutHrSeries(sessionId: string | null | undefined) {
  const key = sessionId ? `${KEY_LIST}?sessionId=${encodeURIComponent(sessionId)}` : null;
  const swr = useSWR<WorkoutHRSeries | null>(key);
  return {
    series: swr.data ?? null,
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function upsertHrSeries(
  sessionId: string,
  input: Omit<WorkoutHRSeries, "sessionId" | "syncedAt">
): Promise<WorkoutHRSeries | undefined> {
  const res = await fetch(KEY_LIST, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sessionId, ...input }),
  });
  if (!res.ok) throw new Error(`upsert failed: ${res.status}`);
  const saved: WorkoutHRSeries = await res.json();
  mutate(KEY_LIST);
  mutate(`${KEY_LIST}?sessionId=${encodeURIComponent(sessionId)}`, saved, { revalidate: false });
  return saved;
}

export async function deleteHrSeries(sessionId: string): Promise<void> {
  const res = await fetch(`${KEY_LIST}/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
  mutate(KEY_LIST);
  mutate(`${KEY_LIST}?sessionId=${encodeURIComponent(sessionId)}`, null, { revalidate: false });
}
