"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { ENERGY_STATES, type EnergyState } from "@/lib/energy-curve";
import {
  useEnergyCheckins,
  createEnergyCheckinItem,
  deleteEnergyCheckinItem,
} from "@/lib/hooks/use-energy-checkins";

const STATE_LABEL: Record<EnergyState, string> = {
  foggy: "Foggy",
  tired: "Tired",
  steady: "Steady",
  sharp: "Sharp",
  peak: "Peak",
};

const STATE_COLOR: Record<EnergyState, string> = {
  foggy: "var(--color-fg-3)",
  tired: "var(--mc-sleep)",
  steady: "var(--mc-water)",
  sharp: "var(--mc-peak)",
  peak: "var(--mc-energy)",
};

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}:${m}${ap}`;
}

export function MoodCheckinRow({ date }: { date: string }) {
  const { checkins } = useEnergyCheckins(date);

  return (
    <Card>
      <CardHeader>
        <CardTitle>How do you feel right now?</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-5 gap-1.5">
        {ENERGY_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              haptic("tap");
              createEnergyCheckinItem(date, s);
            }}
            className="flex flex-col items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] py-2.5 transition active:scale-[0.97] hover:border-[var(--color-stroke-strong)]"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATE_COLOR[s] }}
            />
            <span className="text-[11px] text-[var(--color-fg-2)]">
              {STATE_LABEL[s]}
            </span>
          </button>
        ))}
      </div>

      {checkins.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {checkins.map((c) => (
            <span
              key={c.id}
              className="group inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-stroke)] bg-[var(--color-card)] py-1 pl-2 pr-1 text-xs"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STATE_COLOR[c.state as EnergyState] }}
              />
              <span className="text-[var(--color-fg-2)]">
                {STATE_LABEL[c.state as EnergyState]}
              </span>
              <span className="text-[var(--color-fg-3)] tnum">
                {fmtTime(new Date(c.loggedAt))}
              </span>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => {
                  haptic("soft");
                  deleteEnergyCheckinItem(date, c.id);
                }}
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[var(--color-fg-3)]",
                  "hover:text-[var(--color-danger)]"
                )}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
