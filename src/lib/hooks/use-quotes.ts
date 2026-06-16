"use client";

import useSWR, { mutate } from "swr";
import type { QuoteRow } from "@/lib/data/quotes";

const KEY = "/api/data/quotes";

export function useQuotes() {
  const swr = useSWR<QuoteRow[]>(KEY);
  return { quotes: swr.data ?? [], isLoading: swr.isLoading, error: swr.error };
}

export async function createQuoteItem(input: {
  text: string;
  saidBy?: string;
  context?: string;
  heardAt?: string;
}): Promise<void> {
  const tempId = "temp-" + Date.now().toString(36);
  await mutate<QuoteRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const created: QuoteRow = await res.json();
      return [created, ...(current ?? []).filter((q) => q.id !== tempId)];
    },
    {
      optimisticData: (current) => [
        {
          id: tempId,
          text: input.text,
          saidBy: input.saidBy ?? null,
          context: input.context ?? null,
          heardAt: input.heardAt ?? null,
          createdAt: new Date(),
        } as unknown as QuoteRow,
        ...(current ?? []),
      ],
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function updateQuoteItem(
  id: string,
  patch: Partial<{ text: string; saidBy: string | null; context: string | null; heardAt: string | null }>
): Promise<void> {
  await mutate<QuoteRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`${KEY}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      const next: QuoteRow = await res.json();
      return (current ?? []).map((q) => (q.id === id ? next : q));
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((q) => (q.id === id ? { ...q, ...patch } : q)),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function deleteQuoteItem(id: string): Promise<void> {
  await mutate<QuoteRow[]>(
    KEY,
    async (current) => {
      const res = await fetch(`${KEY}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return (current ?? []).filter((q) => q.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((q) => q.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
