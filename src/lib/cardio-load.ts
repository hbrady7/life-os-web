/**
 * Cardio Load status — compares current week's accumulated load to the
 * user's rolling 4-week average. Pure + unit-testable.
 *
 * Status definitions (per Today screen spec):
 *   - Optimal:   current week within ±20% of the 4-week average
 *   - Building:  current week below 80% of the 4-week average
 *   - Strained:  current week above 130% of the 4-week average
 *   - (between 120% and 130% rolls up to Optimal — "approaching strained"
 *     but not yet there.)
 *
 * Insufficient when we don't have at least one full week of baseline.
 */

export type CardioStatus = "building" | "optimal" | "strained" | "insufficient";

export const CARDIO_STATUS_LABEL: Record<CardioStatus, string> = {
  building: "Building",
  optimal: "Optimal",
  strained: "Strained",
  insufficient: "—",
};

export const CARDIO_STATUS_COLOR: Record<CardioStatus, string> = {
  building: "var(--color-warning)", // amber — under-loaded
  optimal: "var(--color-success)",  // emerald — in the zone
  strained: "var(--color-danger)",  // coral/red — pushing too hard
  insufficient: "var(--color-fg-3)",
};

export const CARDIO_STATUS_TOOLTIP: Record<CardioStatus, string> = {
  building: "This week's cardio load is below your 4-week average — room to push.",
  optimal: "This week's cardio load is in line with your 4-week average. Sweet spot.",
  strained: "This week's cardio load is well above your 4-week average. Consider recovery.",
  insufficient: "Need at least a week of cardio data before we can compare against your baseline.",
};

export type CardioStatusResult = {
  status: CardioStatus;
  /** Current week's accumulated load. */
  weekTotal: number;
  /** Rolling 4-week average week total. undefined when insufficient. */
  fourWeekAvg?: number;
  /** weekTotal / fourWeekAvg, when both are present. */
  ratio?: number;
};

/**
 * @param weekTotal     Sum of daily cardio load for the current week (Mon–Sun).
 * @param priorWeekTotals  Array of prior weekly totals, oldest first. We use
 *                      the most recent 4 weeks for the baseline.
 */
export function computeCardioStatus(
  weekTotal: number,
  priorWeekTotals: number[]
): CardioStatusResult {
  const recent4 = priorWeekTotals.slice(-4).filter((v) => Number.isFinite(v));
  if (recent4.length < 1 || recent4.every((v) => v <= 0)) {
    return { status: "insufficient", weekTotal };
  }
  const sum = recent4.reduce((a, b) => a + b, 0);
  const fourWeekAvg = sum / recent4.length;
  if (fourWeekAvg <= 0) {
    return { status: "insufficient", weekTotal };
  }
  const ratio = weekTotal / fourWeekAvg;
  let status: CardioStatus;
  if (ratio > 1.3) status = "strained";
  else if (ratio < 0.8) status = "building";
  else status = "optimal";
  return { status, weekTotal, fourWeekAvg, ratio };
}

/**
 * Build weekly totals from a daily-values array, oldest first. Buckets
 * 7 days into each output entry; partial final buckets are kept (so the
 * "current week" is the last bucket, possibly shorter than 7 days).
 */
export function bucketIntoWeeks(daily: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const slice = daily.slice(i, i + 7);
    out.push(slice.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));
  }
  return out;
}
