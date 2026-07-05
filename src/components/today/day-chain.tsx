"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store";
import { dayScore } from "@/lib/score";
import { fromDateStr, lastNDates, todayStr } from "@/lib/date";
import { useDay } from "./day-context";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { DateStr } from "@/lib/types";

const CHAIN_DAYS = 14;
/** A day "counts" toward the chain at 60% — matches the score ring's green zone. */
const CHAIN_THRESHOLD = 0.6;

/**
 * The last two weeks as a tappable heat strip — the habit-forming
 * "don't break the chain" surface. Each cell tints by day score;
 * tapping one navigates the deck to that day.
 */
export function DayChain() {
  const { date: selected, setDate } = useDay();
  const today = todayStr();

  const dates = React.useMemo<DateStr[]>(
    () => lastNDates(CHAIN_DAYS, fromDateStr(today)),
    [today]
  );

  const scores = useStore(
    useShallow((s) =>
      dates.map((d) =>
        dayScore({
          goalsForDay: s.goals.filter((g) => g.date === d),
          habits: s.habits,
          routine: s.routine,
          date: d,
        })
      )
    )
  );

  const chain = React.useMemo(() => {
    // Count consecutive kept days ending at today — today itself gets a
    // pass while still in progress so an unfinished morning doesn't
    // read as a broken chain.
    let n = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      const kept = scores[i] >= CHAIN_THRESHOLD;
      if (dates[i] === today && !kept) continue;
      if (kept) n++;
      else break;
    }
    return n;
  }, [dates, scores, today]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-[5px]">
        {dates.map((d, i) => {
          const score = scores[i];
          const isSelected = d === selected;
          const kept = score >= CHAIN_THRESHOLD;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                haptic("tap");
                setDate(d);
              }}
              aria-label={`${d} — ${Math.round(score * 100)}%`}
              title={`${d} · ${Math.round(score * 100)}%`}
              className={cn(
                "h-3 w-3 rounded-[4px] transition-transform hover:scale-125 accent-ring",
                isSelected && "ring-1 ring-[var(--color-fg)] ring-offset-1 ring-offset-[var(--color-card)]"
              )}
              style={{
                background: kept
                  ? `color-mix(in srgb, var(--color-accent) ${Math.round(
                      35 + score * 65
                    )}%, var(--color-elevated))`
                  : score > 0
                  ? `color-mix(in srgb, var(--color-accent) ${Math.round(
                      score * 40
                    )}%, var(--color-elevated))`
                  : "var(--color-elevated)",
              }}
            />
          );
        })}
      </div>
      <span className="label whitespace-nowrap">
        {chain > 0 ? `${chain}-day chain` : "start the chain"}
      </span>
    </div>
  );
}
