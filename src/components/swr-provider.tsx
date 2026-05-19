"use client";

import * as React from "react";
import { SWRConfig } from "swr";

/**
 * App-wide SWR defaults.
 *
 * - `fetcher`: thin wrapper that JSON-parses and throws on non-2xx so
 *   route-handler errors propagate to the hook's `error` field.
 * - `revalidateOnFocus: false` — Life OS is a personal dashboard; we
 *   don't need an interactive-document feel. Visibility changes can
 *   trigger their own targeted revalidations (e.g. the Vitals tier
 *   calls maybeAutoSync on visibility return).
 * - `revalidateIfStale: true` — default; keeps reads fresh on mount.
 * - `dedupingInterval: 2000` — collapses the burst of identical reads
 *   that happen when many cards mount in the same frame.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
