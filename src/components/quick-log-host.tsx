"use client";

import * as React from "react";
import { useStore } from "@/store";
import { QuickLogSheet } from "@/components/nav/quick-log-sheet";
import { UniversalSearchModal } from "@/components/universal-search-modal";
import { WaterLogModal } from "@/components/today/log-modals/water-modal";
import { MoodLogModal } from "@/components/today/log-modals/mood-modal";
import { EnergyLogModal } from "@/components/today/log-modals/energy-modal";
import { WeightLogModal } from "@/components/today/log-modals/weight-modal";
import { StepsLogModal } from "@/components/today/log-modals/steps-modal";

/**
 * One global mount point for the quick-log surfaces: the sheet, the
 * five metric log modals, and the command bar (⌘K). Everything opens
 * through store actions so the bottom-nav center button, the sidebar
 * Log button, and keyboard shortcuts all share state.
 *
 * Outside the Day screen these modals log against actual today
 * (useSelectedDate falls back when no DayProvider is mounted); on the
 * Day screen they respect the viewed date — same behavior the inline
 * vitals tiles have.
 */
export function QuickLogHost() {
  const active = useStore((s) => s.quickLog.active);
  const searchOpen = useStore((s) => s.quickLog.searchOpen);
  const closeQuickLog = useStore((s) => s.closeQuickLog);
  const setQuickLogSearch = useStore((s) => s.setQuickLogSearch);
  const openQuickLog = useStore((s) => s.openQuickLog);

  // ⌘K / Ctrl+K opens the command bar; ⌘J opens the log sheet.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setQuickLogSearch(true);
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        openQuickLog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setQuickLogSearch, openQuickLog]);

  return (
    <>
      <QuickLogSheet />
      <UniversalSearchModal
        open={searchOpen}
        onClose={() => setQuickLogSearch(false)}
      />
      <WaterLogModal open={active === "water"} onClose={closeQuickLog} />
      <MoodLogModal open={active === "mood"} onClose={closeQuickLog} />
      <EnergyLogModal open={active === "energy"} onClose={closeQuickLog} />
      <WeightLogModal open={active === "weight"} onClose={closeQuickLog} />
      <StepsLogModal open={active === "steps"} onClose={closeQuickLog} />
    </>
  );
}
