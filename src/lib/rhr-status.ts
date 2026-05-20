/**
 * RHR status indicator — compares today's resting heart rate against
 * the user's personal 30-day rolling baseline. Pure + unit-testable.
 *
 * Staged for the Peak State feature; not rendered in UI yet.
 *
 * Decision logic (mirrors lib/hrv-status.ts so Peak State can use the
 * same z-score machinery):
 *   1. If fewer than 14 baseline days are available → "insufficient"
 *      (under 14 days the mean/SD is too noisy to draw conclusions
 *      from a single morning reading).
 *   2. Otherwise compute (today − mean) / sample-SD = z:
 *        z >  +1  → "elevated"  (concerning — possible stress / illness
 *                                / under-recovery / dehydration)
 *        z <  −1  → "low"       (usually benign — fitness gains; rarely
 *                                sleep deprivation if accompanied by
 *                                low HRV)
 *        else     → "normal"    (baseline range)
 *
 * Note on semantic flip from HRV: for HRV, "elevated" is good. For
 * RHR, "elevated" is the warning condition. Same math, opposite
 * interpretation — UI layer (Peak State) is responsible for picking
 * tones / icons that match.
 *
 * Sample SD (n − 1 denominator) — we treat the 30-day window as a
 * sample of the user's "real" baseline, not the population.
 *
 * The baseline excludes today by convention — caller passes only
 * the prior days. (If you accidentally include today, the band gets
 * pulled toward today and biases the comparison.)
 */

export type RhrStatus = "normal" | "low" | "elevated" | "insufficient";

export const RHR_STATUS_LABEL: Record<RhrStatus, string> = {
  normal: "normal",
  low: "low",
  elevated: "elevated",
  insufficient: "insufficient data",
};

export type RhrStatusResult = {
  status: RhrStatus;
  /** 30-day mean (excluding today). undefined when insufficient. */
  mean?: number;
  /** Sample standard deviation. undefined when insufficient. */
  sd?: number;
  /** (today − mean) / sd. undefined when insufficient or today missing. */
  zScore?: number;
};

const MIN_BASELINE_DAYS = 14;

export function computeRhrStatus(
  todayRhr: number | null | undefined,
  baselineValues: Array<number | null | undefined>
): RhrStatusResult {
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

  if (todayRhr == null || !Number.isFinite(todayRhr)) {
    return { status: "insufficient", mean, sd };
  }

  const z = sd > 0 ? (todayRhr - mean) / sd : 0;
  let status: RhrStatus;
  if (z > 1) status = "elevated";
  else if (z < -1) status = "low";
  else status = "normal";
  return { status, mean, sd, zScore: z };
}

/**
 * Quick sanity-check examples (mental unit tests). Inputs lead to the
 * commented outputs — if any of these diverge in a code change, the
 * Peak State feature will surface the wrong label.
 *
 *   computeRhrStatus(55, []) → { status: "insufficient" }            (no baseline)
 *   computeRhrStatus(55, Array(13).fill(60))                          (too few days)
 *     → { status: "insufficient" }
 *   const fourteenAt60 = Array(14).fill(60);
 *   computeRhrStatus(60, fourteenAt60) → { status: "normal", z ≈ 0 } (no spread → z=0)
 *   computeRhrStatus(70, [...mix with σ≈3]) → { status: "elevated" } (z > +1)
 *   computeRhrStatus(50, [...mix with σ≈3]) → { status: "low" }      (z < −1)
 */
