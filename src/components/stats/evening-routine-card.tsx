"use client";

import * as React from "react";
import { Flame, Moon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computePerItemRate,
  useEveningCompletionRate,
  useEveningAvgCompletionMin,
  useEveningLongestStreak,
  useEveningRaw,
  useEveningStreak,
} from "@/store/selectors";
import { lastNDates, format, fromDateStr } from "@/lib/date";

const BIN_BG = [
  "var(--color-elevated)",
  "color-mix(in srgb, var(--color-accent-strong) 18%, transparent)",
  "color-mix(in srgb, var(--color-accent-strong) 42%, transparent)",
  "color-mix(in srgb, var(--color-accent-strong) 70%, transparent)",
  "var(--color-accent-strong)",
];

function bin(pct: number) {
  if (pct <= 0) return 0;
  if (pct < 0.25) return 1;
  if (pct < 0.5) return 2;
  if (pct < 0.75) return 3;
  return 4;
}

function formatTime(mins: number) {
  // Evening times can exceed 24h (post-midnight wrap). Display as
  // "12:34am" — fold back into 0..24 range for display.
  const folded = mins % (24 * 60);
  let h = Math.floor(folded / 60);
  const m = folded % 60;
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}

export function EveningRoutineStatsCard({ days }: { days: number }) {
  const routineRaw = useEveningRaw();
  const streak = useEveningStreak();
  const longest = useEveningLongestStreak();
  const rate = useEveningCompletionRate(days);
  const avgMin = useEveningAvgCompletionMin(days);
  const perItem = React.useMemo(
    () => computePerItemRate(routineRaw, days),
    [routineRaw, days]
  );

  const heatmapDays = Math.min(days, 30);
  const dates = React.useMemo(() => lastNDates(heatmapDays), [heatmapDays]);
  const dayPcts = React.useMemo(
    () =>
      dates.map((d) => {
        if (!routineRaw.length) return 0;
        const done = routineRaw.filter(
          (r) => r.history[d]?.completed
        ).length;
        return done / routineRaw.length;
      }),
    [dates, routineRaw]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Moon size={13} />
            Evening Routine
          </span>
        </CardTitle>
        <span className="text-xs text-[var(--color-fg-2)] tnum">
          {Math.round(rate * 100)}% · {days}d
        </span>
      </CardHeader>

      {routineRaw.length === 0 ? (
        <div className="text-xs text-[var(--color-fg-3)] text-center py-6">
          Set up your evening in Today to see stats.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Stat
              label="Current"
              value={`${streak}d`}
              icon={
                <Flame
                  size={11}
                  className="text-[var(--color-warning)]"
                  fill="currentColor"
                />
              }
            />
            <Stat label="Longest" value={`${longest}d`} />
            <Stat
              label="Avg wind-down"
              value={avgMin != null ? formatTime(avgMin) : "—"}
            />
          </div>

          <div
            className="grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))`,
            }}
          >
            {dayPcts.map((pct, i) => (
              <div
                key={dates[i]}
                title={`${format(fromDateStr(dates[i]), "MMM d")} · ${Math.round(
                  pct * 100
                )}%`}
                className="aspect-square rounded-[2px]"
                style={{ background: BIN_BG[bin(pct)] }}
              />
            ))}
          </div>
          <div className="mt-1 text-[10px] text-[var(--color-fg-3)] flex items-center justify-between">
            <span>
              {format(fromDateStr(dates[0]), "MMM d")} —{" "}
              {format(fromDateStr(dates[dates.length - 1]), "MMM d")}
            </span>
            <span className="inline-flex items-center gap-0.5">
              less
              {BIN_BG.map((c, i) => (
                <span
                  key={i}
                  className="inline-block h-2.5 w-2.5 rounded-[2px]"
                  style={{ background: c }}
                />
              ))}
              more
            </span>
          </div>

          {perItem.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {perItem.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="text-base shrink-0 w-6 text-center">
                    {r.icon}
                  </span>
                  <span className="text-xs text-[var(--color-fg-2)] flex-1 truncate">
                    {r.name}
                  </span>
                  <div className="h-1.5 w-24 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent-strong)]"
                      style={{
                        width: `${r.pct}%`,
                        transition: "width 280ms ease",
                      }}
                    />
                  </div>
                  <span className="text-[10px] tnum text-[var(--color-fg-3)] w-8 text-right">
                    {r.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-elevated)] border border-[var(--color-stroke)] p-2.5">
      <div className="text-[10px] text-[var(--color-fg-3)]">{label}</div>
      <div className="text-sm font-medium tnum inline-flex items-center gap-1 mt-0.5">
        {value}
        {icon}
      </div>
    </div>
  );
}
