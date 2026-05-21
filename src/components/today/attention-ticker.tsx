"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  Camera,
  CheckCircle2,
  Droplet,
  ListChecks,
  Moon,
  Scale,
  Sunrise,
  Target,
} from "lucide-react";
import { useStore } from "@/store";
import {
  useTodayGoals,
  useRoutine,
  useEveningRoutine,
  useHabits,
} from "@/store/selectors";
import { useBodyPhotoSessions } from "@/lib/hooks/use-body-photo-sessions";
import { getPhotoDayWindow } from "@/lib/reminders";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { WeightLogModal } from "./log-modals/weight-modal";
import { WaterLogModal } from "./log-modals/water-modal";
import { useIsActualToday } from "./day-context";

/**
 * Attention Ticker — top-of-Today strip surfacing what still needs doing.
 *
 * Each chip is an actionable shortcut to the relevant section (scroll, route,
 * or open a log modal). Chips only appear when their condition is unmet, and
 * disappear live as the user resolves them. When nothing is pending the strip
 * collapses to a calm "All caught up" state.
 *
 * Pinned to actual today: a coach watching you right now, not the viewed day.
 */
export function AttentionTicker() {
  const router = useRouter();
  const isActualToday = useIsActualToday();
  const reduceMotion = useReducedMotion();

  // todayKey is re-derived inside the chip builder so this component
  // doesn't pin a stale "today" across midnight crossings.
  const goals = useTodayGoals();
  const routine = useRoutine();
  const evening = useEveningRoutine();
  const habits = useHabits();
  const waterTargetOz = useStore((s) => s.settings.waterTargetOz);
  const liquidUnit = useStore((s) => s.settings.units.liquid);
  const health = useStore((s) => s.health);
  const { sessions: photoSessions } = useBodyPhotoSessions();

  const [weightOpen, setWeightOpen] = React.useState(false);
  const [waterOpen, setWaterOpen] = React.useState(false);

  // Re-tick once per minute so morning / evening window crossovers update
  // without requiring user interaction. Cheap — just bumps a state counter.
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    if (!isActualToday) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [isActualToday]);

  const chips = React.useMemo<Chip[]>(() => {
    if (!isActualToday) return [];
    const now = new Date();
    const hour = now.getHours();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    const result: Chip[] = [];

    // Morning routine — past 11am with items left
    if (routine.length > 0 && hour >= 11) {
      const left = routine.filter((r) => !r.history[todayKey]?.completed).length;
      if (left > 0) {
        result.push({
          id: "morning",
          icon: Sunrise,
          label: `Morning routine · ${left} left`,
          tone: hour >= 14 ? "danger" : "warn",
          onTap: () => scrollToId("anchor-morning"),
        });
      }
    }

    // Evening routine — after 6pm with items left
    if (evening.length > 0 && hour >= 18) {
      const left = evening.filter((r) => !r.history[todayKey]?.completed).length;
      if (left > 0) {
        result.push({
          id: "evening",
          icon: Moon,
          label: `Evening routine · ${left} left`,
          tone: "warn",
          onTap: () => scrollToId("anchor-evening"),
        });
      }
    }

    // Open goals
    const openGoals = goals.filter((g) => !g.completed).length;
    if (openGoals > 0) {
      result.push({
        id: "goals",
        icon: Target,
        label: `Goals · ${openGoals} open`,
        tone: "warn",
        onTap: () => scrollToId("anchor-goals"),
      });
    }

    // Habits pending
    if (habits.length > 0) {
      const pending = habits.filter((h) => !h.history[todayKey]).length;
      if (pending > 0) {
        result.push({
          id: "habits",
          icon: ListChecks,
          label: `Habits · ${pending} pending`,
          tone: "warn",
          onTap: () => router.push("/habits"),
        });
      }
    }

    // Water below target
    const waterOz = health[todayKey]?.waterOz ?? 0;
    if (waterTargetOz > 0 && waterOz < waterTargetOz) {
      result.push({
        id: "water",
        icon: Droplet,
        label: formatWaterChip(waterOz, waterTargetOz, liquidUnit),
        tone: "warn",
        onTap: () => setWaterOpen(true),
      });
    }

    // Weight not logged today
    if (health[todayKey]?.weight == null) {
      result.push({
        id: "weight",
        icon: Scale,
        label: "Log weight",
        tone: "warn",
        onTap: () => setWeightOpen(true),
      });
    }

    // Body photo day — urgent
    const photoWindow = getPhotoDayWindow(todayKey);
    if (photoWindow && !photoSessions.some((s) => s.date === photoWindow.target)) {
      result.push({
        id: "photo-day",
        icon: Camera,
        label: "Photo day",
        tone: "danger",
        onTap: () => router.push("/body"),
      });
    }

    return result;
  }, [
    isActualToday,
    routine,
    evening,
    goals,
    habits,
    waterTargetOz,
    liquidUnit,
    health,
    photoSessions,
    router,
  ]);

  if (!isActualToday) return null;

  const isEmpty = chips.length === 0;
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };

  return (
    <>
      <section
        aria-label="Attention ticker"
        className="-mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto hide-scroll"
        style={{
          touchAction: "pan-x",
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-max py-0.5">
          <AnimatePresence initial={false}>
            {isEmpty ? (
              <ChipShell key="caught-up" tone="good" transition={spring}>
                <CheckCircle2 size={13} />
                <span>All caught up</span>
              </ChipShell>
            ) : (
              chips.map((chip) => (
                <ChipShell
                  key={chip.id}
                  tone={chip.tone}
                  transition={spring}
                  onClick={() => {
                    haptic("tap");
                    chip.onTap();
                  }}
                >
                  <chip.icon size={13} />
                  <span className="tnum">{chip.label}</span>
                </ChipShell>
              ))
            )}
          </AnimatePresence>
        </div>
      </section>

      <WeightLogModal open={weightOpen} onClose={() => setWeightOpen(false)} />
      <WaterLogModal open={waterOpen} onClose={() => setWaterOpen(false)} />
    </>
  );
}

type Chip = {
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  tone: "warn" | "danger" | "good";
  onTap: () => void;
};

type ChipShellProps = {
  tone: "warn" | "danger" | "good";
  children: React.ReactNode;
  onClick?: () => void;
  transition: { type?: "spring"; stiffness?: number; damping?: number } | { duration: number };
};

const TONE_CLASSES: Record<"warn" | "danger" | "good", string> = {
  warn:
    "bg-[color:color-mix(in_srgb,var(--color-warning)_12%,transparent)] " +
    "text-[var(--color-warning)] " +
    "border-[color:color-mix(in_srgb,var(--color-warning)_28%,transparent)]",
  danger:
    "bg-[color:color-mix(in_srgb,var(--color-danger)_14%,transparent)] " +
    "text-[var(--color-danger)] " +
    "border-[color:color-mix(in_srgb,var(--color-danger)_32%,transparent)]",
  good:
    "bg-[color:color-mix(in_srgb,var(--color-success)_10%,transparent)] " +
    "text-[var(--color-success)] " +
    "border-[color:color-mix(in_srgb,var(--color-success)_26%,transparent)]",
};

function ChipShell({ tone, children, onClick, transition }: ChipShellProps) {
  const Element = onClick ? motion.button : motion.div;
  return (
    <Element
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={transition}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium border",
        "shrink-0 scroll-snap-align-start whitespace-nowrap",
        "active:scale-[0.96] transition-[transform]",
        TONE_CLASSES[tone]
      )}
      style={{ scrollSnapAlign: "start" }}
    >
      {children}
    </Element>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatWaterChip(
  haveOz: number,
  targetOz: number,
  unit: "oz" | "ml"
): string {
  if (unit === "ml") {
    const haveL = haveOz * 0.0295735;
    const targetL = targetOz * 0.0295735;
    return `Water · ${haveL.toFixed(1)}/${targetL.toFixed(1)} L`;
  }
  return `Water · ${Math.round(haveOz)}/${Math.round(targetOz)} oz`;
}
