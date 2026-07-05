import { getCurrentUser } from "@/lib/auth-server";
import { DeckClient } from "@/components/today/deck-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  return <DeckClient firstName={firstName(user?.name)} />;
}

function firstName(name?: string | null): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] ?? null;
}
