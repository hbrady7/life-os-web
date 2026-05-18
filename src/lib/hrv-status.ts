/**
 * HRV status indicator — compares today's reading against the user's
 * personal 30-day rolling baseline. Pure + unit-testable.
 *
 * Decision logic:
 *   1. If fewer than 14 baseline days are available → "insufficient"
 *      (we need enough data to make the mean / SD meaningful — under 14
 *      days the band is noisy and would mislabel normal nights).
 *   2. Otherwise compute (today − mean) / sample-SD = z:
 *        z >  +1  → "elevated"
 *        z <  −1  → "low"
 *        else     → "balanced"
 *
 * Sample SD (n − 1 denominator) is used rather than population SD because
 * we treat the 30-day window as a sample of the user's "real" baseline.
 *
 * The baseline excludes today by convention — caller is responsible for
 * passing only the prior days. (If you accidentally include today, the
 * band gets pulled toward today and biases the comparison.)
 */

export type HrvStatus = "balanced" | "low" | "elevated" | "insufficient";

export const HRV_STATUS_LABEL: Record<HrvStatus, string> = {
  balanced: "balanced",
  low: "low",
  elevated: "elevated",
  insufficient: "insufficient data",
};

export const HRV_STATUS_COLOR: Record<HrvStatus, string> = {
  balanced: "var(--color-success)",   // emerald
  low: "var(--color-warning)",        // amber
  elevated: "var(--mc-carbs)",        // sky
  insufficient: "var(--color-fg-3)",  // muted
};

export const HRV_STATUS_TOOLTIP: Record<HrvStatus, string> = {
  balanced: "Within ±1 SD of your 30-day average. Recovery is on track.",
  low: "More than 1 SD below your 30-day average — could signal stress, illness, or under-recovery.",
  elevated: "More than 1 SD above your 30-day average — strong autonomic recovery.",
  insufficient: "Need at least 14 days of HRV readings before we can compare against your baseline.",
};

export type HrvStatusResult = {
  status: HrvStatus;
  /** 30-day mean (excluding today). undefined when insufficient. */
  mean?: number;
  /** Sample standard deviation. undefined when insufficient. */
  sd?: number;
  /** (today − mean) / sd. undefined when insufficient or today missing. */
  zScore?: number;
};

const MIN_BASELINE_DAYS = 14;

export function computeHrvStatus(
  todayHrv: number | null | undefined,
  baselineValues: Array<number | null | undefined>
): HrvStatusResult {
  const baseline = baselineValues.filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (baseline.length < MIN_BASELINE_DAYS) {
    return { status: "insufficient" };
  }

  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const variance =
    baseline.reduce((a, b) => a + (b - mean) ** 2, 0) /
    (baseline.length - 1);
  const sd = Math.sqrt(variance);

  if (todayHrv == null || !Number.isFinite(todayHrv)) {
    return { status: "insufficient", mean, sd };
  }

  const z = sd > 0 ? (todayHrv - mean) / sd : 0;
  let status: HrvStatus;
  if (z > 1) status = "elevated";
  else if (z < -1) status = "low";
  else status = "balanced";
  return { status, mean, sd, zScore: z };
}
