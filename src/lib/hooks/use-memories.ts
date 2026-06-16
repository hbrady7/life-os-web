"use client";

import useSWR, { mutate } from "swr";
import type { MemoryRow, MemoryKind } from "@/lib/data/memories";

const KEY = "/api/data/memories";

export function useMemories() {
  const swr = useSWR<MemoryRow[]>(KEY);
  return {
    memories: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function createMemoryItem(input: {
  content: string;
  kind?: MemoryKind;
  tags?: string[];
}): Promise<void> {
  const tempId = "temp-" + Date.now().toString(36);
  await mutate<MemoryRow[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: MemoryRow = await res.json();
      return [created, ...list.filter((m) => m.id !== tempId)];
    },
    {
      optimisticData: (current) => [
        {
          id: tempId,
          content: input.content,
          kind: input.kind ?? "note",
          tags: input.tags ?? [],
          createdAt: new Date(),
        } as unknown as MemoryRow,
        ...(current ?? []),
      ],
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function deleteMemoryItem(id: string): Promise<void> {
  await mutate<MemoryRow[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(`${KEY}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return list.filter((m) => m.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((m) => m.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
