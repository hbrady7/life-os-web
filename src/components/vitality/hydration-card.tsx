"use client";

import * as React from "react";
import { Plus, Minus, Droplets, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useHydrationTarget } from "@/lib/hooks/use-hydration";
import { useWater, addWater } from "@/lib/hooks/use-metrics";

export function HydrationCard({ date }: { date: string }) {
  const { target } = useHydrationTarget(date);
  const { water } = useWater(date);
  const [showMath, setShowMath] = React.useState(false);

  const currentOz = water?.oz ?? 0;
  const bottleOz = target?.bottleOz ?? 20;
  const targetOz = target?.targetOz ?? 0;
  const currentBottles = currentOz / bottleOz;
  const targetBottles = target ? target.bottles : 0;

  const drink = (delta: number) => {
    haptic(delta > 0 ? "success" : "soft");
    addWater(date, delta);
  };

  const pace = paceMessage(currentOz, targetOz);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Droplets size={15} className="text-[var(--mc-water)]" /> Hydration
          </span>
        </CardTitle>
      </CardHeader>

      <div className="flex items-center gap-4">
        <ProgressRing
          value={currentBottles}
          max={Math.max(1, targetBottles)}
          size={112}
          stroke={10}
          color="var(--mc-water)"
          label={`${currentBottles.toFixed(1)}`}
          sublabel={`of ${targetBottles.toFixed(1)} bottles`}
        />
        <div className="flex-1">
          <p className="text-sm" style={{ color: pace.color }}>
            {pace.text}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-fg-3)] tnum">
            {Math.round(currentOz)} / {targetOz} oz · {bottleOz}oz bottles
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => drink(bottleOz)} className="flex-1">
              <Plus size={16} /> Drank a bottle
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Remove a bottle"
              disabled={currentOz <= 0}
              onClick={() => drink(-bottleOz)}
            >
              <Minus size={16} />
            </Button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMath((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-[var(--radius-control)] px-1 py-1.5 text-xs text-[var(--color-fg-2)] hover:text-[var(--color-fg)]"
      >
        <span>Why this target?</span>
        <ChevronDown
          size={15}
          className={cn("transition-transform", showMath && "rotate-180")}
        />
      </button>

      {showMath && target && (
        <table className="w-full text-sm">
          <tbody>
            {target.breakdown.map((line) => (
              <tr key={line.key + line.label} className="border-t border-[var(--color-stroke)]">
                <td className="py-1.5 text-[var(--color-fg)]">
                  {line.label}
                  <span className="ml-1.5 text-[11px] text-[var(--color-fg-3)]">
                    {line.detail}
                  </span>
                </td>
                <td className="py-1.5 text-right tnum text-[var(--color-fg-2)]">
                  +{line.oz} oz
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--color-stroke-strong)]">
              <td className="py-1.5 font-semibold">Daily target</td>
              <td className="py-1.5 text-right font-semibold tnum text-[var(--mc-water)]">
                {target.targetOz} oz
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Card>
  );
}

function paceMessage(
  currentOz: number,
  targetOz: number
): { text: string; color: string } {
  if (targetOz <= 0) return { text: "Set a target by logging your weight.", color: "var(--color-fg-2)" };
  if (currentOz >= targetOz) {
    return { text: "Target hit. Nicely done.", color: "var(--mc-water)" };
  }
  // Expected intake assumes waking hours 7am–11pm (16h).
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  const frac = Math.max(0, Math.min(1, (hours - 7) / 16));
  const expectedOz = targetOz * frac;
  const deficit = expectedOz - currentOz;
  if (deficit > 16) {
    return { text: "Behind pace — drink one in the next hour.", color: "var(--color-warning)" };
  }
  if (deficit > 6) {
    return { text: "Slightly behind — top up soon.", color: "var(--color-fg-2)" };
  }
  return { text: "On pace. Keep sipping.", color: "var(--mc-water)" };
}
