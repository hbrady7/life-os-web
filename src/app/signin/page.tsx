import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/sign-in-button";

export const metadata = {
  title: "Sign in · Life OS",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) {
    redirect(params.callbackUrl || "/");
  }
  const callbackUrl = params.callbackUrl || "/";

  return (
    <main className="min-h-dvh grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-[28px] font-bold tracking-tight">Life OS</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-2)]">
            Sign in to sync across your devices.
          </p>
        </div>

        <SignInButton callbackUrl={callbackUrl} />

        <div className="mt-8 rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] p-4 text-[12px] text-[var(--color-fg-2)] space-y-1.5">
          <p className="font-medium text-[var(--color-fg)]">
            On iOS &amp; using Life OS as a home-screen app?
          </p>
          <p>
            Sign-in may open in Safari. After you authorize GitHub, reopen
            the Life OS icon — your session will be active.
          </p>
        </div>
      </div>
    </main>
  );
}
