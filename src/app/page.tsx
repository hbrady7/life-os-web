"use client";

import * as React from "react";
import { motion, PanInfo } from "motion/react";
import { Screen } from "@/components/screen";
import { DeckHeader } from "@/components/today/deck-header";
import { AttentionTicker } from "@/components/today/attention-ticker";
import { MorningBriefing } from "@/components/today/morning-briefing";
import { MorningRoutine } from "@/components/today/morning-routine";
import { EveningRoutine } from "@/components/today/evening-routine";
import { Goals } from "@/components/today/goals";
import { TodayRoutineCard } from "@/components/today/today-routine-card";
import { DailyStrainCard } from "@/components/today/daily-strain-card";
import { ReflectionCard } from "@/components/today/reflection";
import { WeeklyReviewCard } from "@/components/today/weekly-review-card";
import { PatternCard } from "@/components/today/pattern-card";
import { InsightsCard } from "@/components/today/insights-card";
import { DayHero } from "@/components/today/day-hero";
import { MorningGlance } from "@/components/today/morning-glance";
import { FuelCard } from "@/components/today/fuel-card";
import { PerformanceLane } from "@/components/today/performance-lane";
import { RecoveryLane } from "@/components/today/recovery-lane";
import { MovementLane } from "@/components/today/movement-lane";
import { DayProvider, useDay } from "@/components/today/day-context";
import { useDaypart } from "@/components/daypart-provider";
import type { Daypart } from "@/lib/daypart";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";
import { maybeAutoSync } from "@/lib/integrations/google-health/sync-client";
import { PhotoDayBanner } from "@/components/body/photo-day-banner";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { mutate as swrMutate } from "swr";

export default function Page() {
  React.useEffect(() => {
    // Fire-and-forget; the sync client guards against concurrency and
    // freshness so this is safe to call on every mount.
    void maybeAutoSync();
  }, []);
  return (
    <DayProvider>
      <DaySurface />
    </DayProvider>
  );
}

/**
 * The command deck. One canonical set of cards, arranged into two
 * columns on desktop — OPERATE (left: things you do) and MONITOR
 * (right: things you read) — and one daypart-ordered stack on mobile.
 * Ordering is a keyed-array sort, so React keeps each card's identity
 * when the day moves between dawn/day/dusk/night.
 */

type CardKey =
  | "hero"
  | "glance"
  | "goals"
  | "todayRoutine"
  | "morningRoutine"
  | "eveningRoutine"
  | "reflection"
  | "briefing"
  | "performance"
  | "recovery"
  | "fuel"
  | "movement"
  | "strain"
  | "insights"
  | "weekly"
  | "pattern";

/** Anchor ids the AttentionTicker scrolls to — must survive reordering. */
const ANCHOR_FOR: Partial<Record<CardKey, string>> = {
  morningRoutine: "anchor-morning",
  goals: "anchor-goals",
  eveningRoutine: "anchor-evening",
};

const CARD: Record<CardKey, React.ComponentType> = {
  hero: DayHero,
  glance: MorningGlance,
  goals: Goals,
  todayRoutine: TodayRoutineCard,
  morningRoutine: MorningRoutine,
  eveningRoutine: EveningRoutine,
  reflection: ReflectionCard,
  briefing: MorningBriefing,
  performance: PerformanceLane,
  recovery: RecoveryLane,
  fuel: FuelCard,
  movement: MovementLane,
  strain: DailyStrainCard,
  insights: InsightsCard,
  weekly: WeeklyReviewCard,
  pattern: PatternCard,
};

/**
 * OPERATE zone order per daypart. The hero always anchors; the ritual
 * for the current daypart climbs to the top slot beneath it.
 */
const OPERATE_ORDER: Record<Daypart, CardKey[]> = {
  dawn: ["hero", "glance", "morningRoutine", "goals", "todayRoutine", "eveningRoutine", "reflection"],
  day: ["hero", "glance", "goals", "todayRoutine", "morningRoutine", "eveningRoutine", "reflection"],
  dusk: ["hero", "eveningRoutine", "reflection", "goals", "todayRoutine", "glance", "morningRoutine"],
  night: ["hero", "eveningRoutine", "reflection", "goals", "todayRoutine", "glance", "morningRoutine"],
};

/** MONITOR zone: morning reads recovery first, evening reads strain first. */
const MONITOR_ORDER: Record<Daypart, CardKey[]> = {
  dawn: ["briefing", "recovery", "performance", "fuel", "movement", "strain", "insights", "weekly", "pattern"],
  day: ["performance", "fuel", "movement", "strain", "recovery", "briefing", "insights", "weekly", "pattern"],
  dusk: ["strain", "fuel", "performance", "movement", "recovery", "insights", "weekly", "pattern", "briefing"],
  night: ["strain", "fuel", "performance", "movement", "recovery", "insights", "weekly", "pattern", "briefing"],
};

function CardStack({ order }: { order: CardKey[] }) {
  return (
    <>
      {order.map((key) => {
        const Component = CARD[key];
        const anchor = ANCHOR_FOR[key];
        return anchor ? (
          <div key={key} id={anchor} style={{ scrollMarginTop: "5rem" }}>
            <Component />
          </div>
        ) : (
          <div key={key}>
            <Component />
          </div>
        );
      })}
    </>
  );
}

function DaySurface() {
  const { step, canGoBack, canGoForward, isToday } = useDay();
  const swipeEnabled = useStore((s) => s.settings.dayNavigation.swipeEnabled);
  const daypart = useDaypart();

  // Past days read in canonical (day) order — time-of-day emphasis only
  // applies to the live day.
  const effective: Daypart = isToday && daypart ? daypart : "day";

  const onPanEnd = (
    _e: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo
  ) => {
    if (!swipeEnabled) return;
    // Require a decisive horizontal swipe; ignore drift / vertical motion.
    const dx = info.offset.x;
    const dy = info.offset.y;
    const vx = info.velocity.x;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const fast = Math.abs(vx) > 400;
    const far = Math.abs(dx) > 80;
    if (!fast && !far) return;
    if (dx < 0 && canGoForward) {
      haptic("tap");
      step(1);
    } else if (dx > 0 && canGoBack) {
      haptic("tap");
      step(-1);
    }
  };

  /** Revalidate every /api/data/* SWR cache key + nudge a sync. The
   *  pull-to-refresh handler awaits this so the spinner stays up until
   *  the new data lands. */
  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      swrMutate(
        (k) => typeof k === "string" && k.startsWith("/api/data/"),
        undefined,
        { revalidate: true }
      ),
      maybeAutoSync(),
    ]);
  }, []);

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <motion.div
        onPanEnd={swipeEnabled ? onPanEnd : undefined}
        // Allow vertical scroll; only intercept horizontal pans
        style={{ touchAction: "pan-y" }}
      >
        <Screen width="wide">
          <DeckHeader />
          <PhotoDayBanner placement="today" />
          <AttentionTicker />
          <div className="space-y-3 md:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start">
            <div className="space-y-3 md:space-y-4 lg:col-span-7">
              <CardStack order={OPERATE_ORDER[effective]} />
            </div>
            <div className="space-y-3 md:space-y-4 lg:col-span-5">
              <CardStack order={MONITOR_ORDER[effective]} />
            </div>
          </div>
        </Screen>
      </motion.div>
    </PullToRefresh>
  );
}
