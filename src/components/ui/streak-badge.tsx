"use client";

import * as React from "react";
import { Flame } from "lucide-react";
import { streakTier } from "@/lib/metric-colors";
import { cn } from "@/lib/utils";

type Props = {
  streak: number;
  size?: number;
  className?: string;
  /** When true, render the flame icon + count even at low streaks (just no glow). */
  alwaysShow?: boolean;
};

/**
 * Tiered streak badge:
 *   1-2  → muted text only (no flame)
 *   3-6  → amber flame + amber count
 *   7-29 → orange flame + count with subtle glow
 *   30+  → gold flame + count with stronger glow
 */
export function StreakBadge({
  streak,
  size = 12,
  className,
  alwaysShow = false,
}: Props) {
  const tier = streakTier(streak);
  if (streak <= 0 && !alwaysShow) return null;
  if (!tier.showFlame && !alwaysShow) {
    return (
      <span
        className={cn(
          "text-[11px] tnum text-[var(--color-fg-3)]",
          className
        )}
      >
        {streak}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tnum",
        className
      )}
      style={{
        color: tier.color,
        textShadow: tier.glow !== "none" ? tier.glow : undefined,
      }}
    >
      <Flame
        size={size}
        fill="currentColor"
        style={{
          filter: tier.glow !== "none" ? `drop-shadow(${tier.glow})` : undefined,
        }}
      />
      {streak}
    </span>
  );
}
