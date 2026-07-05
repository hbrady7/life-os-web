"use client";

import { Search, Settings } from "lucide-react";
import Link from "next/link";
import { HorizonBand } from "@/components/horizon-band";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";

/**
 * Mobile-only top chrome: the horizon band runs along the top edge as
 * the app's signature, with Search and Settings as the only icons —
 * domains live in the bottom nav, siblings in each page's DomainTabs.
 * Buttons are 44x44 targets.
 */
export function MobileTopBar() {
  const setQuickLogSearch = useStore((s) => s.setQuickLogSearch);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 pointer-events-none md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <HorizonBand height={2} className="pointer-events-none" />
      <div className="flex justify-end items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-label="Search everything"
          onClick={() => {
            haptic("tap");
            setQuickLogSearch(true);
          }}
          className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full bg-[var(--color-card)]/85 backdrop-blur-md border border-[var(--color-stroke)] text-[var(--color-fg-2)] active:scale-95 transition"
        >
          <Search size={17} />
        </button>
        <Link
          href="/settings"
          aria-label="Settings"
          className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full bg-[var(--color-card)]/85 backdrop-blur-md border border-[var(--color-stroke)] text-[var(--color-fg-2)] active:scale-95 transition"
        >
          <Settings size={17} />
        </Link>
      </div>
    </div>
  );
}
