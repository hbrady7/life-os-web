/**
 * predictEnergyCurve(userId, date) — 24 hourly energy scores (0–100).
 *
 * A transparent, hand-tuned heuristic (no ML):
 *   1. A circadian base template — low overnight, post-wake ramp,
 *      late-morning/midday peak, an early-afternoon dip, an evening
 *      second wind, then decline into night.
 *   2. The whole curve is scaled by a readiness factor derived from last
 *      night's sleep + recovery + HRV (the same Peak State inputs), so a
 *      well-recovered day rides higher than a depleted one.
 *   3. Decaying caffeine bumps are added at the hours of today's logged
 *      caffeine.
 *
 * The math is intentionally simple and commented so the chart stays
 * explainable ("why is 3pm low?" → the dip × your poor recovery).
 */

import { computePeakState } from "@/lib/peak-state/compute";
import { gatherPeakStateInputs } from "@/lib/peak-state/gather";
import { listCaffeineForDate } from "@/lib/data/caffeine";
import { todayStr } from "@/lib/date";

/** Baseline alertness by hour (0–23) for a typical day, pre-modulation. */
export const CIRCADIAN_BASE: number[] = [
  22, 18, 16, 16, 18, 24, // 0–5 overnight trough
  34, 48, 62, 74, 82, 86, // 6–11 wake ramp → late-morning peak
  82, 66, 62, 70, 74, 73, // 12–17 lunch dip → afternoon recovery
  68, 60, 52, 44, 36, 28, // 18–23 evening second wind → decline
];

export type EnergyCurvePoint = {
  hour: number;
  /** Final 0–100 score for the hour. */
  score: number;
  /** Caffeine contribution baked into `score`, for the tooltip. */
  caffeineBump: number;
};

export type EnergyCurve = {
  points: EnergyCurvePoint[];
  /** Multiplier applied to the base template (≈0.65 depleted → 1.2 peak). */
  readinessFactor: number;
  inputs: { recovery: number | null; sleepScore: number | null; hrvToday: number | null };
  caffeineMgToday: number;
};

/** Felt-state → numeric score, shared with the mood check-in row. */
export const ENERGY_STATE_SCORE = {
  foggy: 20,
  tired: 40,
  steady: 60,
  sharp: 80,
  peak: 95,
} as const;

export type EnergyState = keyof typeof ENERGY_STATE_SCORE;

export const ENERGY_STATES: EnergyState[] = [
  "foggy",
  "tired",
  "steady",
  "sharp",
  "peak",
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Caffeine alertness shape vs hours since intake: a quick ramp to peak
 * (~1h) then exponential decay with a 5-hour time constant (roughly the
 * 5–6h half-life of caffeine).
 */
function caffeineShape(hoursSince: number): number {
  if (hoursSince < 0) return 0;
  if (hoursSince < 1) return 0.5 + 0.5 * hoursSince; // 0.5 → 1.0 over the first hour
  return Math.exp(-(hoursSince - 1) / 5);
}

/** Pure builder — given modulation inputs + caffeine events, build 24 points. */
export function buildEnergyCurve(args: {
  recovery: number | null;
  sleepScore: number | null;
  caffeine: Array<{ hour: number; mg: number }>;
}): { points: EnergyCurvePoint[]; readinessFactor: number } {
  // Readiness blends recovery + sleep score (each 0–100). Missing inputs
  // drop out; if both are absent the factor is neutral (1.0).
  const readinessParts = [args.recovery, args.sleepScore].filter(
    (v): v is number => v != null
  );
  const readiness =
    readinessParts.length > 0
      ? readinessParts.reduce((a, b) => a + b, 0) / readinessParts.length
      : 50;
  // Map readiness 0..100 → factor 0.65..1.2 (centred so 50 ≈ 0.925).
  const readinessFactor = clamp(0.65 + (readiness / 100) * 0.55, 0.65, 1.2);

  const points: EnergyCurvePoint[] = CIRCADIAN_BASE.map((base, hour) => {
    let bump = 0;
    for (const c of args.caffeine) {
      bump += (c.mg / 100) * 9 * caffeineShape(hour - c.hour);
    }
    bump = Math.min(22, bump);
    const score = clamp(base * readinessFactor + bump, 0, 100);
    return { hour, score: Math.round(score), caffeineBump: Math.round(bump) };
  });

  return { points, readinessFactor };
}

export async function predictEnergyCurve(
  userId: string,
  date: string = todayStr()
): Promise<EnergyCurve> {
  const [peakInputs, caffeineRows] = await Promise.all([
    gatherPeakStateInputs(userId, date),
    listCaffeineForDate(userId, date),
  ]);
  const peak = computePeakState(peakInputs);

  const caffeine = caffeineRows.map((r) => ({
    hour: new Date(r.loggedAt).getHours(),
    mg: r.mg ?? 0,
  }));

  const { points, readinessFactor } = buildEnergyCurve({
    recovery: peak.recovery,
    sleepScore: peakInputs.sleepScoreLastNight,
    caffeine,
  });

  return {
    points,
    readinessFactor,
    inputs: {
      recovery: peak.recovery,
      sleepScore: peakInputs.sleepScoreLastNight,
      hrvToday: peakInputs.hrvToday,
    },
    caffeineMgToday: caffeine.reduce((a, c) => a + c.mg, 0),
  };
}
