"use client";

import * as React from "react";
import {
  useGoalsRaw,
  useHabitsRaw,
  useHealthMap,
  useJournalRaw,
  useRoutineRaw,
} from "@/store/selectors";
import { lastNDates, format, fromDateStr } from "@/lib/date";
import { dayScore } from "@/lib/score";

function bin(s: number) {
  if (s <= 0) return 0;
  if (s < 0.25) return 1;
  if (s < 0.5) return 2;
  if (s < 0.75) return 3;
  return 4;
}

const BIN_BG = [
  "var(--color-elevated)",
  "color-mix(in srgb, var(--color-accent-strong) 18%, transparent)",
  "color-mix(in srgb, var(--color-accent-strong) 42%, transparent)",
  "color-mix(in srgb, var(--color-accent-strong) 70%, transparent)",
  "var(--color-accent-strong)",
];

export function Heatmap({ days = 30 }: { days?: number }) {
  const goals = useGoalsRaw();
  const habits = useHabitsRaw();
  const routine = useRoutineRaw();
  const journal = useJournalRaw();
  const health = useHealthMap();

  const data = React.useMemo(() => {
    const dates = lastNDates(days);
    return dates.map((date) => ({
      date,
      score: dayScore({
        goalsForDay: goals.filter((g) => g.date === date),
        habits,
        routine,
        health: health[date],
        journalsForDay: journal.filter((j) => j.date === date),
        date,
      }),
    }));
  }, [days, goals, habits, routine, journal, health]);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="label">Last {days} days</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-fg-3)]">Less</span>
          {BIN_BG.map((c, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: c }}
            />
          ))}
          <span className="text-[10px] text-[var(--color-fg-3)]">More</span>
        </div>
      </div>
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(days / 7)}, minmax(0, 1fr))`,
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, minmax(0, 1fr))",
        }}
      >
        {data.map((c) => (
          <div
            key={c.date}
            title={`${format(fromDateStr(c.date), "MMM d")} — ${Math.round(c.score * 100)}%`}
            className="aspect-square rounded-[4px]"
            style={{ background: BIN_BG[bin(c.score)] }}
          />
        ))}
      </div>
    </div>
  );
}
