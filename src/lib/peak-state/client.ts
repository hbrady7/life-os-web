"use client";

import { mutate } from "swr";

/**
 * Fire-and-forget recompute trigger. Safe to call from any input
 * mutation hook or sync handler — it deduplicates concurrent calls
 * for the same date so a burst of writes (e.g. saving four energy
 * periods in a row) only triggers one recompute round-trip.
 *
 * On success it nudges the SWR cache for today's peak_state row so
 * the hero card refreshes immediately.
 */

const inflight = new Map<string, Promise<void>>();

export function triggerPeakStateRecompute(date?: string): Promise<void> {
  const key = date ?? "_today";
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      await fetch("/api/peak-state/recompute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(date ? { date } : {}),
        credentials: "same-origin",
      });
    } catch {
      // Silent — recompute is best-effort. Next mutation or app load
      // will try again.
    } finally {
      inflight.delete(key);
      // Revalidate the relevant SWR caches.
      await mutate(
        (k) =>
          typeof k === "string" && k.startsWith("/api/data/peak-state"),
        undefined,
        { revalidate: true }
      );
    }
  })();
  inflight.set(key, p);
  return p;
}
