"use client";

import useSWR, { mutate } from "swr";
import type {
  BodyPhotoEntry,
  BodyPhotoSessionRow,
} from "@/lib/data/body-photo-sessions";

const KEY = "/api/data/body-photo-sessions";

export type { BodyPhotoEntry, BodyPhotoSessionRow };

export function useBodyPhotoSessions() {
  const swr = useSWR<BodyPhotoSessionRow[]>(KEY);
  return {
    sessions: swr.data ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export async function createBodyPhotoSession(input: {
  date: string;
  captureDate: string;
  photoKeys: BodyPhotoEntry[];
  notes?: string | null;
}): Promise<BodyPhotoSessionRow> {
  const res = await fetch(KEY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`create photo session failed: ${res.status}`);
  const row = (await res.json()) as BodyPhotoSessionRow;
  await mutate(KEY);
  return row;
}

export async function updateBodyPhotoSession(
  id: string,
  patch: Partial<{ notes: string | null; photoKeys: BodyPhotoEntry[] }>
): Promise<void> {
  await fetch(`${KEY}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  await mutate(KEY);
}

export async function deleteBodyPhotoSession(id: string): Promise<void> {
  await fetch(`${KEY}/${id}`, { method: "DELETE" });
  await mutate(KEY);
}
