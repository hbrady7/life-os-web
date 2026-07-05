"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeMember, domainForPath } from "@/lib/domains";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * Sibling-page pills for the current domain. Mounted automatically by
 * <Screen> on every member page — one consistent wayfinding row.
 */
export function DomainTabs() {
  const pathname = usePathname();
  const domain = domainForPath(pathname);
  if (!domain) return null;

  const active = activeMember(domain, pathname);

  return (
    <nav
      aria-label={`${domain.label} pages`}
      className="flex items-center gap-1.5 overflow-x-auto hide-scroll -mx-1 px-1"
    >
      {domain.members.map((m) => {
        const isActive = m.href === active?.href;
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={() => haptic("tap")}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-8 px-3.5 inline-flex items-center rounded-full text-[13px] font-medium whitespace-nowrap transition shrink-0 accent-ring",
              isActive
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)] border border-[var(--color-stroke)]"
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
