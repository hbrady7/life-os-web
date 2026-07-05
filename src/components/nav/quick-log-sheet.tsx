"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  Droplets,
  Dumbbell,
  Footprints,
  Scale,
  Search,
  SmilePlus,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useStore, type QuickLogKind } from "@/store";
import { addWater } from "@/lib/hooks/use-metrics";
import { todayStr } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * The center-button sheet: one-tap water chips log instantly; metric
 * tiles hand off to the full log modals (mounted by QuickLogHost);
 * compound flows (meal, workout, journal) navigate to their domain.
 */
export function QuickLogSheet() {
  const open = useStore((s) => s.quickLog.sheetOpen);
  const closeQuickLog = useStore((s) => s.closeQuickLog);
  const openQuickLog = useStore((s) => s.openQuickLog);
  const setQuickLogSearch = useStore((s) => s.setQuickLogSearch);
  const unit = useStore((s) => s.settings.units.liquid);
  const router = useRouter();

  const [flash, setFlash] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (flash == null) return;
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  const fmt = (oz: number) =>
    unit === "ml" ? `${Math.round(oz * 29.5735)} ml` : `${oz} oz`;

  const logWater = (oz: number) => {
    void addWater(todayStr(), oz);
    haptic("success");
    setFlash(oz);
  };

  const openModal = (kind: QuickLogKind) => {
    haptic("tap");
    openQuickLog(kind);
  };

  const go = (href: string) => {
    haptic("tap");
    closeQuickLog();
    router.push(href);
  };

  return (
    <Modal open={open} onClose={closeQuickLog} title="Log" size="md">
      <div className="space-y-3 pb-1">
        {/* Instant water — the highest-frequency log gets zero friction. */}
        <div>
          <div className="label mb-1.5">Water · instant</div>
          <div className="grid grid-cols-3 gap-2">
            {[8, 16, 32].map((oz) => (
              <button
                key={oz}
                type="button"
                onClick={() => logWater(oz)}
                className={cn(
                  "h-12 rounded-[var(--radius-control)] border text-sm font-medium flex items-center justify-center gap-1.5 transition active:scale-[0.97] accent-ring",
                  flash === oz
                    ? "border-[color:color-mix(in_srgb,var(--mc-water)_50%,transparent)] bg-[var(--mc-water-soft)] text-[var(--mc-water)]"
                    : "border-[var(--color-stroke)] bg-[var(--color-elevated)] text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)]"
                )}
              >
                <Droplets size={14} style={{ color: "var(--mc-water)" }} />
                {flash === oz ? "Added" : `+${fmt(oz)}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label mb-1.5">Check in</div>
          <div className="grid grid-cols-2 gap-2">
            <Tile
              label="Mood"
              sub="1–10 right now"
              mc="var(--mc-mood)"
              Icon={SmilePlus}
              onClick={() => openModal("mood")}
            />
            <Tile
              label="Energy"
              sub="This block of the day"
              mc="var(--mc-energy)"
              Icon={Zap}
              onClick={() => openModal("energy")}
            />
            <Tile
              label="Weight"
              sub="Morning weigh-in"
              mc="var(--mc-weight)"
              Icon={Scale}
              onClick={() => openModal("weight")}
            />
            <Tile
              label="Steps"
              sub="Manual count"
              mc="var(--mc-steps)"
              Icon={Footprints}
              onClick={() => openModal("steps")}
            />
          </div>
        </div>

        <div>
          <div className="label mb-1.5">Bigger logs</div>
          <div className="grid grid-cols-3 gap-2">
            <Tile
              compact
              label="Meal"
              mc="var(--mc-calories)"
              Icon={Apple}
              onClick={() => go("/nutrition")}
            />
            <Tile
              compact
              label="Workout"
              mc="var(--pillar-strain)"
              Icon={Dumbbell}
              onClick={() => go("/gym")}
            />
            <Tile
              compact
              label="Journal"
              mc="var(--mc-sleep)"
              Icon={BookOpen}
              onClick={() => go("/journal")}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setQuickLogSearch(true);
          }}
          className="w-full h-11 rounded-[var(--radius-control)] border border-[var(--color-stroke)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)] transition flex items-center justify-center gap-2 text-sm accent-ring"
        >
          <Search size={14} />
          Search everything
          <kbd className="hidden md:inline font-mono text-[10px] text-[var(--color-fg-3)] border border-[var(--color-stroke)] rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </button>
      </div>
    </Modal>
  );
}

function Tile({
  label,
  sub,
  mc,
  Icon,
  onClick,
  compact,
}: {
  label: string;
  sub?: string;
  mc: string;
  Icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius-control)] bg-[var(--color-elevated)] border border-[var(--color-stroke)] hover:border-[var(--color-stroke-strong)] active:scale-[0.98] transition text-left accent-ring",
        compact
          ? "p-3 flex flex-col items-center gap-1.5 text-center"
          : "p-3.5 flex items-center gap-3"
      )}
    >
      <span
        className={cn(
          "shrink-0 grid place-items-center rounded-full",
          compact ? "h-9 w-9" : "h-10 w-10"
        )}
        style={{
          background: `color-mix(in srgb, ${mc} 14%, transparent)`,
          color: mc,
        }}
      >
        <Icon size={compact ? 16 : 18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {sub && (
          <span className="block text-xs text-[var(--color-fg-3)] truncate">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}
