"use client";

import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";
import { HorizonBand } from "@/components/horizon-band";

/**
 * Mobile-only top chrome: the horizon band runs along the top edge
 * (under the notch) as the app's signature, with Mentor + Settings as
 * the only two icons — every other surface now lives in the bottom
 * nav's four domains. Buttons are 44x44 targets.
 */
export function MobileTopBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 pointer-events-none md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <HorizonBand height={2} className="pointer-events-none" />
      <div className="flex justify-end items-center gap-2 px-3 py-2">
        <TopIcon href="/mentor" label="Mentor">
          <Sparkles size={17} />
        </TopIcon>
        <TopIcon href="/settings" label="Settings">
          <Settings size={17} />
        </TopIcon>
      </div>
    </div>
  );
}

function TopIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full bg-[var(--color-card)]/85 backdrop-blur-md border border-[var(--color-stroke)] text-[var(--color-fg-2)] active:scale-95 transition"
    >
      {children}
    </Link>
  );
}
