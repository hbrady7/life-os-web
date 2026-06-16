"use client";

import useSWR, { mutate } from "swr";
import type {
  SupplementRow,
  SupplementLogRow,
  SupplementWindow,
} from "@/lib/data/supplements";

const STACK_KEY = "/api/data/supplements";
const logsKey = (date: string) => `/api/data/supplements/logs?date=${date}`;

export function useSupplements() {
  const swr = useSWR<SupplementRow[]>(STACK_KEY);
  return { stack: swr.data ?? [], isLoading: swr.isLoading };
}

export function useSupplementLogs(date: string) {
  const swr = useSWR<SupplementLogRow[]>(logsKey(date));
  return {
    takenIds: new Set((swr.data ?? []).map((l) => l.supplementId)),
    isLoading: swr.isLoading,
  };
}

export async function createSupplementItem(input: {
  name: string;
  dose?: string;
  window?: SupplementWindow;
  note?: string;
}): Promise<void> {
  await mutate<SupplementRow[]>(
    STACK_KEY,
    async (current) => {
      const res = await fetch(STACK_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: SupplementRow = await res.json();
      return [...(current ?? []), created];
    },
    { revalidate: true }
  );
}

export async function updateSupplementItem(
  id: string,
  patch: Partial<Pick<SupplementRow, "name" | "dose" | "window" | "note" | "order">>
): Promise<void> {
  await mutate<SupplementRow[]>(
    STACK_KEY,
    async (current) => {
      const res = await fetch(`${STACK_KEY}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      const next: SupplementRow = await res.json();
      return (current ?? []).map((s) => (s.id === id ? next : s));
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function deleteSupplementItem(id: string): Promise<void> {
  await mutate<SupplementRow[]>(
    STACK_KEY,
    async (current) => {
      const res = await fetch(`${STACK_KEY}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return (current ?? []).filter((s) => s.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((s) => s.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function toggleSupplementTaken(
  date: string,
  supplementId: string,
  taken: boolean
): Promise<void> {
  const KEY = logsKey(date);
  await mutate<SupplementLogRow[]>(
    KEY,
    async (current) => {
      const res = await fetch("/api/data/supplements/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ supplementId, date, taken }),
      });
      if (!res.ok) throw new Error(`toggle failed: ${res.status}`);
      const list = current ?? [];
      return taken
        ? [...list.filter((l) => l.supplementId !== supplementId), {
            userId: "",
            supplementId,
            date,
            takenAt: new Date(),
          } as SupplementLogRow]
        : list.filter((l) => l.supplementId !== supplementId);
    },
    {
      optimisticData: (current) => {
        const list = current ?? [];
        return taken
          ? [...list.filter((l) => l.supplementId !== supplementId), {
              userId: "",
              supplementId,
              date,
              takenAt: new Date(),
            } as SupplementLogRow]
          : list.filter((l) => l.supplementId !== supplementId);
      },
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
