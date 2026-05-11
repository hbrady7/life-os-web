"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultData, LifeOSData, STORAGE_KEY } from "./types";

type Updater = (prev: LifeOSData) => LifeOSData;

function readFromStorage(): LifeOSData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as Partial<LifeOSData>;
    return { ...defaultData(), ...parsed };
  } catch {
    return defaultData();
  }
}

export function useLifeOS() {
  const [data, setData] = useState<LifeOSData>(() => defaultData());
  const [hydrated, setHydrated] = useState(false);
  const writeTimer = useRef<number | null>(null);

  // hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    setData(readFromStorage());
    setHydrated(true);
  }, []);

  // debounced write
  useEffect(() => {
    if (!hydrated) return;
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // storage full / disabled — ignore
      }
    }, 120);
    return () => {
      if (writeTimer.current) window.clearTimeout(writeTimer.current);
    };
  }, [data, hydrated]);

  const update = useCallback((updater: Updater) => {
    setData((prev) => updater(prev));
  }, []);

  const replace = useCallback((next: LifeOSData) => {
    setData({ ...defaultData(), ...next });
  }, []);

  return { data, update, replace, hydrated };
}
