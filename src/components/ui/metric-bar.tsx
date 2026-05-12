"use client";

import * as React from "react";
import { motion } from "motion/react";
import { metricColors, type Metric } from "@/lib/metric-colors";
import { cn } from "@/lib/utils";

type Props = {
  metric: Metric;
  /** Current value as fraction 0..1 (clamped). Pass values >1 for "overshoot" glow. */
  value: number;
  height?: number;
  className?: string;
  showGlowAtFull?: boolean;
};

/**
 * Colored, animated progress bar. Track tinted in metric color, fill
 * uses a base→light gradient, snappy spring on width change, and an
 * optional soft glow when value reaches 1.0+.
 */
export function MetricBar({
  metric,
  value,
  height = 6,
  className,
  showGlowAtFull = true,
}: Props) {
  const c = metricColors(metric);
  const clamped = Math.max(0, Math.min(1, value));
  const overshoot = value >= 1;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full", className)}
      style={{
        height,
        background: c.soft,
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${c.base} 0%, ${c.light} 100%)`,
          boxShadow:
            showGlowAtFull && overshoot
              ? `0 0 12px 0 color-mix(in srgb, ${c.base} 55%, transparent)`
              : "none",
        }}
      />
    </div>
  );
}
