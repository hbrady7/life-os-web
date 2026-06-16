"use client";

import useSWR, { mutate } from "swr";
import type { IdeaRow, IdeaStatus } from "@/lib/data/ideas";

const KEY = "/api/data/ideas";

export function useIdeas() {
  const swr = useSWR<IdeaRow[]>(KEY);
  return { ideas: swr.data ?? [], isLoading: swr.isLoading, error: swr.error };
}

export async function createIdeaItem(input: {
  title: string;
  body?: string;
  status?: IdeaStatus;
  tags?: string[];
}): Promise<void> {
  const tempId = "temp-" + Date.now().toString(36);
  await mutate<IdeaRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: IdeaRow = await res.json();
      return [created, ...(current ?? []).filter((i) => i.id !== tempId)];
    },
    {
      optimisticData: (current) => [
        {
          id: tempId,
          title: input.title,
          body: input.body ?? null,
          status: input.status ?? "spark",
          tags: input.tags ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as IdeaRow,
        ...(current ?? []),
      ],
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function updateIdeaItem(
  id: string,
  patch: Partial<{ title: string; body: string | null; status: IdeaStatus; tags: string[] | null }>
): Promise<void> {
  await mutate<IdeaRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`${KEY}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      const next: IdeaRow = await res.json();
      return (current ?? []).map((i) => (i.id === id ? next : i));
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function deleteIdeaItem(id: string): Promise<void> {
  await mutate<IdeaRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`${KEY}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return (current ?? []).filter((i) => i.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((i) => i.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
