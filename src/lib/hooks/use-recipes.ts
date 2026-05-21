"use client";

import useSWR, { mutate } from "swr";
import type { Recipe } from "@/lib/types";

const KEY = "/api/data/recipes";

export function useRecipes() {
  const swr = useSWR<Recipe[]>(KEY);
  return {
    recipes: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function createRecipeItem(
  input: Omit<Recipe, "id">
): Promise<Recipe | undefined> {
  let created: Recipe | undefined;
  const tempId = "temp-" + Date.now().toString(36);
  await mutate<Recipe[]>(
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
      created = await res.json();
      return [created!, ...list.filter((r) => r.id !== tempId)];
    },
    {
      optimisticData: (current) => [
        { ...input, id: tempId } as Recipe,
        ...(current ?? []),
      ],
      rollbackOnError: true,
      revalidate: true,
    }
  );
  return created;
}

export async function updateRecipeItem(
  id: string,
  patch: Partial<Omit<Recipe, "id">>
): Promise<void> {
  await mutate<Recipe[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(`${KEY}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`update failed: ${res.status}`);
      const next: Recipe = await res.json();
      return list.map((r) => (r.id === id ? next : r));
    },
    {
      optimisticData: (current) =>
        (current ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}

export async function deleteRecipeItem(id: string): Promise<void> {
  await mutate<Recipe[]>(
    KEY,
    async (current) => {
      const list = current ?? [];
      const res = await fetch(`${KEY}/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      return list.filter((r) => r.id !== id);
    },
    {
      optimisticData: (current) => (current ?? []).filter((r) => r.id !== id),
      rollbackOnError: true,
      revalidate: true,
    }
  );
}
