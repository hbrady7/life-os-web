import { getCurrentUser } from "@/lib/auth-server";
import { getUserContext, type UserContext } from "@/lib/user-context";
import { MentorClient } from "@/components/mentor/mentor-client";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
  const user = await getCurrentUser();
  let ctx: UserContext | null = null;
  if (user) {
    // getUserContext hits Neon; if it's unreachable we still render the
    // chat (which rebuilds context server-side per message) with a null
    // snapshot rather than 500-ing the page.
    try {
      ctx = await getUserContext(user.id);
    } catch {
      ctx = null;
    }
  }
  return <MentorClient initialContext={ctx} firstName={firstName(user?.name)} />;
}

function firstName(name?: string | null): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] ?? null;
}
