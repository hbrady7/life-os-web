"use client";

import * as React from "react";
import type { Recommendation } from "@/lib/peak-state/compute";
import { recommendationLabel } from "@/lib/peak-state/compute";

/**
 * Tone mapping reuses existing semantic tokens per spec:
 *   go_hard / train_normal      → emerald (success)
 *   maintain                    → sky    (carbs token, our designated sky)
 *   easy_session / active_rec   → amber  (warning)
 *   full_rest                   → rose   (danger)
 */
const TONE: Record<
  Recommendation,
  { color: string; soft: string }
> = {
  go_hard: { color: "var(--color-success)", soft: "color-mix(in srgb, var(--color-success) 12%, transparent)" },
  maintain: { color: "var(--mc-carbs)", soft: "color-mix(in srgb, var(--mc-carbs) 12%, transparent)" },
  train_normal: { color: "var(--mc-carbs)", soft: "color-mix(in srgb, var(--mc-carbs) 12%, transparent)" },
  easy_session: { color: "var(--color-warning)", soft: "color-mix(in srgb, var(--color-warning) 14%, transparent)" },
  active_recovery: { color: "var(--color-warning)", soft: "color-mix(in srgb, var(--color-warning) 14%, transparent)" },
  full_rest: { color: "var(--color-danger)", soft: "color-mix(in srgb, var(--color-danger) 14%, transparent)" },
};

export function RecommendationPill({
  recommendation,
  size = "md",
}: {
  recommendation: Recommendation;
  size?: "sm" | "md";
}) {
  const tone = TONE[recommendation];
  const label = recommendationLabel(recommendation);
  const padding =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[12px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight ${padding}`}
      style={{
        background: tone.soft,
        color: tone.color,
        borderColor: `color-mix(in srgb, ${tone.color} 40%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: tone.color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** Color lookup for chart bars / dots that need to match the pill. */
export function recommendationColor(
  recommendation: Recommendation
): string {
  return TONE[recommendation].color;
}
