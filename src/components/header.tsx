"use client";

import * as React from "react";
import { LifeOSData } from "@/lib/types";
import { CompletionRing } from "./completion-ring";

type Props = {
  data: LifeOSData;
  onChange: (patch: Partial<LifeOSData>) => void;
};

function formatDate(d: Date) {
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const rest = d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  return { weekday, rest };
}

export function Header({ data, onChange }: Props) {
  const today = React.useMemo(() => new Date(), []);
  const { weekday, rest } = formatDate(today);

  const completion = React.useMemo(() => {
    if (data.goals.length === 0) return 0;
    const done = data.goals.filter((g) => g.done).length;
    return done / data.goals.length;
  }, [data.goals]);

  return (
    <header className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-[var(--color-fg-muted)]">
            {weekday}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {rest}
          </div>
          <input
            value={data.dayType}
            onChange={(e) => onChange({ dayType: e.target.value })}
            placeholder="Day type — e.g. Pull Day, Rest Day"
            className="mt-2 w-full bg-transparent text-sm text-[var(--color-accent)] placeholder:text-[var(--color-fg-dim)] outline-none no-zoom"
            maxLength={64}
          />
        </div>
        <CompletionRing value={completion} />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)] mb-1">
          Reminder
        </div>
        <input
          value={data.reminder}
          onChange={(e) => onChange({ reminder: e.target.value })}
          placeholder="Set a banner for yourself"
          className="w-full bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] outline-none no-zoom"
          maxLength={140}
        />
      </div>
    </header>
  );
}
