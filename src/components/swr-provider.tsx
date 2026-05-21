"use client";

import * as React from "react";
import { SWRConfig, type Cache } from "swr";
import { openDB, type IDBPDatabase } from "idb";

/**
 * App-wide SWR defaults, with an IndexedDB-backed cache provider.
 *
 *  - SWR semantics for server truth + optimistic mutations
 *  - IDB persistence so cold loads paint instantly from disk before the
 *    network round-trip lands (the "offline-first feel" carter had with
 *    a single Zustand snapshot, but per-key here so we don't blow the
 *    cache on every write)
 *
 * Hydration: the SWR cache provider must be returned synchronously, so
 * we seed the Map empty and async-rehydrate. Within ~50ms of first paint
 * IDB-loaded entries land in the cache; SWR's revalidate-on-mount fetch
 * runs in parallel and wins whichever is fresher.
 *
 * Flush: writes go to IDB opportunistically on visibilitychange (hidden)
 * + beforeunload. Both are cheap, and either firing is enough to
 * persist the working set.
 */

const DB_NAME = "life-os-swr-cache";
const DB_VERSION = 1;
const STORE = "kv";

type Entry = { ts: number; value: unknown };

async function openCacheDb(): Promise<IDBPDatabase | null> {
  if (typeof window === "undefined") return null;
  try {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE);
        }
      },
    });
  } catch {
    return null;
  }
}

function asyncHydrate(map: Map<string, unknown>) {
  void openCacheDb().then(async (db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, "readonly");
      const keys = (await tx.store.getAllKeys()) as IDBValidKey[];
      const values = (await tx.store.getAll()) as Entry[];
      for (let i = 0; i < keys.length; i++) {
        const key = String(keys[i]);
        const entry = values[i];
        if (!entry || typeof entry !== "object") continue;
        // Don't overwrite: a network response that landed first is fresher.
        if (!map.has(key)) map.set(key, entry.value);
      }
    } catch {
      /* hydrate failure is non-fatal — start with empty cache */
    } finally {
      db.close();
    }
  });
}

async function flushCacheToDisk(map: Map<string, unknown>) {
  const db = await openCacheDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    await tx.store.clear();
    for (const [k, v] of map.entries()) {
      try {
        await tx.store.put({ ts: Date.now(), value: v } satisfies Entry, k);
      } catch {
        /* skip non-cloneable entries (Functions, etc) */
      }
    }
    await tx.done;
  } catch {
    /* flush failure is non-fatal */
  } finally {
    db.close();
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

function makeProvider(): Cache {
  const map = new Map<string, unknown>();
  if (typeof window !== "undefined") {
    asyncHydrate(map);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushCacheToDisk(map);
    });
    window.addEventListener("beforeunload", () => void flushCacheToDisk(map));
  }
  return map as unknown as Cache;
}

export function SwrProvider({ children }: { children: React.ReactNode }) {
  const provider = React.useMemo(() => makeProvider, []);
  return (
    <SWRConfig
      value={{
        provider,
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
