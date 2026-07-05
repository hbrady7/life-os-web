"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Brain, HeartPulse, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useStore } from "@/store";

/**
 * Four domain tabs around a raised center Log button — logging is the
 * one action the whole app optimizes for, so it owns the thumb's home
 * position. Domain tabs light up for every route inside their hub.
 */
const LEFT_TABS = [
  { href: "/", label: "Today", Icon: Home, match: ["/"] },
  {
    href: "/vitality",
    label: "Health",
    Icon: HeartPulse,
    match: ["/vitality", "/gym", "/nutrition", "/body"],
  },
] as const;

const RIGHT_TABS = [
  {
    href: "/mind",
    label: "Mind",
    Icon: Brain,
    match: ["/mind", "/journal", "/mentor"],
  },
  {
    href: "/stats",
    label: "Trends",
    Icon: BarChart3,
    match: ["/stats", "/habits"],
  },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  return match.some((m) =>
    m === "/" ? pathname === "/" : pathname.startsWith(m)
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const openQuickLog = useStore((s) => s.openQuickLog);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-[var(--color-stroke)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <ul className="flex items-stretch justify-around max-w-[640px] mx-auto">
          {LEFT_TABS.map((t) => (
            <Tab key={t.href} {...t} active={isActive(pathname, t.match)} />
          ))}

          <li className="flex-1 relative">
            <button
              type="button"
              aria-label="Log something"
              onClick={() => {
                haptic("tap");
                openQuickLog();
              }}
              className="absolute left-1/2 -translate-x-1/2 -top-4 h-14 w-14 grid place-items-center rounded-full bg-[var(--color-accent-strong)] text-[var(--color-accent-contrast)] shadow-[var(--shadow-glow)] active:scale-95 transition accent-ring"
            >
              <Plus size={24} strokeWidth={2.4} />
            </button>
          </li>

          {RIGHT_TABS.map((t) => (
            <Tab key={t.href} {...t} active={isActive(pathname, t.match)} />
          ))}
        </ul>
      </nav>
    </>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{
    size?: number | string;
    strokeWidth?: number | string;
    fill?: string;
    fillOpacity?: number | string;
  }>;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        onClick={() => haptic("tap")}
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-14 w-full flex flex-col items-center justify-center gap-0.5 relative transition active:scale-95",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-fg-3)]"
        )}
      >
        <Icon
          size={20}
          strokeWidth={active ? 2.4 : 2}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.15 : 0}
        />
        <span
          className={cn(
            "text-[10px] tracking-tight",
            active ? "font-semibold" : "font-normal"
          )}
        >
          {label}
        </span>
        {active && (
          <span className="absolute -top-px left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-[var(--color-accent)]" />
        )}
      </Link>
    </li>
  );
}
