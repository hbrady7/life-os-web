"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Apple,
  BarChart3,
  BookOpen,
  Brain,
  CheckSquare,
  Dumbbell,
  Home,
  Plus,
  Scale,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";
import { HorizonBand } from "@/components/horizon-band";
import { DAYPART_LABEL, currentDaypart } from "@/lib/daypart";

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
};

type Group = { label: string | null; items: Item[] };

/**
 * Domain-grouped IA. Routes are unchanged for now — the grouping is the
 * map of where the hubs land (Health / Mind / Trends consolidation).
 */
const GROUPS: Group[] = [
  {
    label: null,
    items: [{ href: "/", label: "Today", Icon: Home }],
  },
  {
    label: "Health",
    items: [
      { href: "/vitality", label: "Vitality", Icon: Activity },
      { href: "/gym", label: "Gym", Icon: Dumbbell },
      { href: "/nutrition", label: "Nutrition", Icon: Apple },
      { href: "/body", label: "Body", Icon: Scale },
    ],
  },
  {
    label: "Mind",
    items: [
      { href: "/mind", label: "Mind", Icon: Brain },
      { href: "/journal", label: "Journal", Icon: BookOpen },
      { href: "/mentor", label: "Mentor", Icon: Sparkles },
    ],
  },
  {
    label: "Trends",
    items: [
      { href: "/stats", label: "Stats", Icon: BarChart3 },
      { href: "/habits", label: "Habits", Icon: CheckSquare },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const openQuickLog = useStore((s) => s.openQuickLog);
  const setQuickLogSearch = useStore((s) => s.setQuickLogSearch);

  return (
    <aside
      className="hidden md:flex fixed inset-y-0 left-0 z-30 w-60 flex-col border-r border-[var(--color-stroke)] glass"
      aria-label="Primary"
    >
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="block group">
          <span className="display font-extrabold text-[17px] tracking-[-0.01em] leading-none">
            LIFE{" "}
            <span className="text-[var(--color-accent)] transition-colors">
              OS
            </span>
          </span>
        </Link>
        <div className="mt-4">
          <HorizonBand height={2} />
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              openQuickLog();
            }}
            className="flex-1 h-9 rounded-lg bg-[var(--color-accent-strong)] text-[var(--color-accent-contrast)] text-sm font-medium flex items-center justify-center gap-1.5 shadow-[var(--shadow-glow)] active:scale-[0.97] transition accent-ring"
          >
            <Plus size={15} strokeWidth={2.4} />
            Log
            <kbd className="font-mono text-[9px] opacity-60">⌘J</kbd>
          </button>
          <button
            type="button"
            aria-label="Search (⌘K)"
            onClick={() => setQuickLogSearch(true)}
            className="h-9 w-9 grid place-items-center rounded-lg border border-[var(--color-stroke)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)] transition accent-ring"
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto nice-scroll px-3 pb-4 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.label ?? "root"}>
            {g.label && <div className="label px-2 mb-1.5">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 h-9 px-2 rounded-lg text-sm transition accent-ring",
                        active
                          ? "text-[var(--color-fg)] bg-[var(--color-elevated)]"
                          : "text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)]/60"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--color-accent)]" />
                      )}
                      <item.Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                      <span className={cn(active && "font-medium")}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-3 border-t border-[var(--color-stroke)] space-y-1">
        <DaypartClock />
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 h-9 px-2 rounded-lg text-sm transition accent-ring",
            pathname.startsWith("/settings")
              ? "text-[var(--color-fg)] bg-[var(--color-elevated)]"
              : "text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)]/60"
          )}
        >
          <Settings size={16} strokeWidth={1.8} />
          Settings
        </Link>
      </div>
    </aside>
  );
}

/** Live daypart + clock chip — the instrument's heartbeat. */
function DaypartClock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!now) return <div className="h-9" />;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className="flex items-center justify-between h-9 px-2">
      <span className="label">{DAYPART_LABEL[currentDaypart(now)]}</span>
      <span className="font-mono text-xs text-[var(--color-fg-2)] tnum">
        {hh}:{mm}
      </span>
    </div>
  );
}
