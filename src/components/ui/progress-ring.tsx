"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * WHOOP-style glowing progress ring. The one signature visual lifted from
 * Vitality — used for hydration bottles, the supplement taken/total
 * counter, and the energy "now" score.
 *
 * Built like score-ring.tsx (a hand-rolled SVG arc) rather than a charting
 * lib so the glow + animated stroke stay cheap. Color is passed as a raw
 * CSS value (a token like `var(--mc-peak)` or a hex) and used directly for
 * the stroke + the soft glow; defaults to the teal Peak-State accent.
 */

type Props = {
  /** Current value. Arc fills value/max, clamped to [0, max]. */
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  /** CSS color for the arc + glow. Defaults to the teal --mc-peak token. */
  color?: string;
  /** Big center content. Defaults to the rounded value. */
  label?: React.ReactNode;
  /** Small content under the big label. */
  sublabel?: React.ReactNode;
  glow?: boolean;
  className?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  color = "var(--mc-peak)",
  label,
  sublabel,
  glow = true,
  className,
}: Props) {
  const gradId = React.useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const offset = c * (1 - frac);
  const atFull = frac >= 1;

  return (
    <div
      role="img"
      aria-label={`${Math.round(frac * 100)}%`}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={{
          filter:
            glow && frac > 0
              ? `drop-shadow(0 0 ${atFull ? 14 : 9}px color-mix(in srgb, ${color} ${atFull ? 65 : 45}%, transparent))`
              : "none",
          transition: "filter 320ms ease",
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--mc-sleep)" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-stroke-strong)"
          strokeWidth={stroke}
          fill="none"
          opacity={0.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="ring-anim"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center px-2">
        <div className="leading-none">
          <div className="text-[26px] font-bold tracking-tight tnum">
            {label ?? Math.round(value)}
          </div>
          {sublabel && (
            <div className="mt-1 text-[11px] text-[var(--color-fg-2)]">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
