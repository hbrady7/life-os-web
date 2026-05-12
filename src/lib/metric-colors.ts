/**
 * Per-metric color access — never inline hex values across components.
 * The tokens themselves live in src/app/globals.css under `@theme`.
 *
 * `base` is the mid-saturation hue used for line strokes and bar fills.
 * `light` is the brighter sibling for fill gradients / glow highlights.
 * `soft` is the ~12% tint used as the empty-track background, so an
 * untouched progress bar still hints at color instead of dead gray.
 */
export type Metric =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "water"
  | "sleep"
  | "mood"
  | "energy"
  | "weight"
  | "steps";

export type MetricColors = {
  base: string;
  light: string;
  soft: string;
};

const PALETTE: Record<Metric, MetricColors> = {
  calories: {
    base: "var(--mc-calories)",
    light: "var(--mc-calories-2)",
    soft: "var(--mc-calories-soft)",
  },
  protein: {
    base: "var(--mc-protein)",
    light: "var(--mc-protein-2)",
    soft: "var(--mc-protein-soft)",
  },
  carbs: {
    base: "var(--mc-carbs)",
    light: "var(--mc-carbs-2)",
    soft: "var(--mc-carbs-soft)",
  },
  fat: {
    base: "var(--mc-fat)",
    light: "var(--mc-fat-2)",
    soft: "var(--mc-fat-soft)",
  },
  water: {
    base: "var(--mc-water)",
    light: "var(--mc-water-2)",
    soft: "var(--mc-water-soft)",
  },
  sleep: {
    base: "var(--mc-sleep)",
    light: "var(--mc-sleep-2)",
    soft: "var(--mc-sleep-soft)",
  },
  mood: {
    base: "var(--mc-mood-high)",
    light: "var(--mc-mood-high)",
    soft: "var(--mc-mood-soft)",
  },
  energy: {
    base: "var(--mc-energy)",
    light: "var(--mc-energy-high)",
    soft: "var(--mc-energy-soft)",
  },
  weight: {
    base: "var(--mc-weight)",
    light: "var(--mc-weight-2)",
    soft: "var(--mc-weight-soft)",
  },
  steps: {
    base: "var(--mc-steps)",
    light: "var(--mc-steps-2)",
    soft: "var(--mc-steps-soft)",
  },
};

export function metricColors(m: Metric): MetricColors {
  return PALETTE[m];
}

/** "linear-gradient(...)" string from base → light for fills. */
export function metricFillGradient(m: Metric): string {
  const c = PALETTE[m];
  return `linear-gradient(90deg, ${c.base} 0%, ${c.light} 100%)`;
}

/** Soft area-under-line gradient — base ~38% to transparent. */
export function metricAreaGradient(m: Metric): string {
  const c = PALETTE[m];
  return `linear-gradient(180deg, color-mix(in srgb, ${c.base} 38%, transparent) 0%, transparent 100%)`;
}

/** Hex resolution for recharts (which can't use CSS vars in stroke="...").
 * Falls back to the raw token reference if computed style isn't available
 * server-side — recharts coerces it to a literal string anyway. */
export function metricHex(m: Metric, variant: keyof MetricColors = "base"): string {
  if (typeof window === "undefined") return PALETTE[m][variant];
  const v = PALETTE[m][variant];
  // var(--xx) → "--xx"
  const match = /var\((--[^)]+)\)/.exec(v);
  if (!match) return v;
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();
  return css || v;
}

/** Streak tier — returns the right color + glow strength for a count. */
export function streakTier(streak: number): {
  color: string;
  glow: string;
  showFlame: boolean;
} {
  if (streak >= 30) {
    return {
      color: "var(--streak-gold)",
      glow: "0 0 14px 0 color-mix(in srgb, var(--streak-gold) 55%, transparent)",
      showFlame: true,
    };
  }
  if (streak >= 7) {
    return {
      color: "var(--streak-orange)",
      glow:
        "0 0 10px 0 color-mix(in srgb, var(--streak-orange) 40%, transparent)",
      showFlame: true,
    };
  }
  if (streak >= 3) {
    return {
      color: "var(--streak-amber)",
      glow: "none",
      showFlame: true,
    };
  }
  return {
    color: "var(--color-fg-3)",
    glow: "none",
    showFlame: false,
  };
}
