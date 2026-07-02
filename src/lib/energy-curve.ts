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
import { listEnergyCheckinsSince } from "@/lib/data/energy-checkins";
import { shiftDate, todayStr } from "@/lib/date";

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

/** A single learned hour: mean felt-energy across check-ins logged at it. */
export type HourStat = { hour: number; mean: number; n: number };

export type EnergyCurve = {
  points: EnergyCurvePoint[];
  /** Multiplier applied to the base template (≈0.65 depleted → 1.2 peak). */
  readinessFactor: number;
  inputs: { recovery: number | null; sleepScore: number | null; hrvToday: number | null };
  caffeineMgToday: number;
  /** How many distinct hours-of-day the personalized shape learned from. */
  learnedHours: number;
  /** Total check-ins that fed the learned profile. */
  learnedCheckins: number;
  /** True once the shape is meaningfully personalized (not the flat template). */
  personalized: boolean;
  /** Today's actual felt-energy check-ins, for the predicted-vs-actual overlay. */
  actual: Array<{ hour: number; score: number }>;
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

/** Local wall-clock hour (0–23) of a timestamp, given a client tz offset. */
function localHour(ts: Date, tzOffsetMinutes: number): number {
  const shifted = new Date(ts.getTime() - tzOffsetMinutes * 60_000);
  return shifted.getUTCHours();
}

/**
 * Learn a per-hour felt-energy profile from the user's own check-ins. Each
 * check-in's `score` (0–100) is bucketed by the local hour it was logged at;
 * we return the mean + count per observed hour. This is what lets the peak
 * *hour* of the forecast shift over time — the static template only ever moved
 * amplitude.
 */
export function learnHourlyProfile(
  checkins: Array<{ loggedAt: Date; score: number }>,
  tzOffsetMinutes: number
): HourStat[] {
  const agg: Array<{ sum: number; n: number }> = Array.from(
    { length: 24 },
    () => ({ sum: 0, n: 0 })
  );
  for (const c of checkins) {
    if (typeof c.score !== "number" || !Number.isFinite(c.score)) continue;
    const h = localHour(c.loggedAt, tzOffsetMinutes);
    agg[h].sum += c.score;
    agg[h].n += 1;
  }
  const out: HourStat[] = [];
  for (let h = 0; h < 24; h++) {
    if (agg[h].n > 0) out.push({ hour: h, mean: agg[h].sum / agg[h].n, n: agg[h].n });
  }
  return out;
}

/**
 * Blend the learned profile into the circadian template, preserving level and
 * only reshaping. We rescale the learned means to the template's average level
 * over the *same* observed hours (so amplitude keeps coming from the readiness
 * factor, not from double-counting the check-ins' own good/bad days), then mix
 * per hour by a confidence weight w = n/(n+K) capped at MAX_W. Hours with no
 * check-ins keep the template value.
 */
function personalizeBase(learned: HourStat[]): number[] {
  const K = 4;
  const MAX_W = 0.7;
  if (learned.length === 0) return CIRCADIAN_BASE.slice();

  const templateMean =
    learned.reduce((a, s) => a + CIRCADIAN_BASE[s.hour], 0) / learned.length;
  const learnedMean = learned.reduce((a, s) => a + s.mean, 0) / learned.length;
  const scale = learnedMean > 0 ? templateMean / learnedMean : 1;

  const byHour = new Map(learned.map((s) => [s.hour, s]));
  return CIRCADIAN_BASE.map((base, hour) => {
    const s = byHour.get(hour);
    if (!s) return base;
    const w = Math.min(MAX_W, s.n / (s.n + K));
    return (1 - w) * base + w * (s.mean * scale);
  });
}

/** Pure builder — given modulation inputs + caffeine events, build 24 points. */
export function buildEnergyCurve(args: {
  recovery: number | null;
  sleepScore: number | null;
  caffeine: Array<{ hour: number; mg: number }>;
  /** Learned per-hour profile from the user's check-ins (optional). */
  learnedProfile?: HourStat[];
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

  // Reshape the template toward the user's learned per-hour profile.
  const baseCurve = personalizeBase(args.learnedProfile ?? []);

  const points: EnergyCurvePoint[] = baseCurve.map((base, hour) => {
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

/** Days of check-in history the learned hourly profile is trained on. */
const LEARN_WINDOW_DAYS = 45;
/** Minimums before we call the shape "personalized" rather than the template. */
const PERSONALIZED_MIN_HOURS = 4;
const PERSONALIZED_MIN_CHECKINS = 10;

export async function predictEnergyCurve(
  userId: string,
  date: string = todayStr(),
  tzOffsetMinutes = 0
): Promise<EnergyCurve> {
  const [peakInputs, caffeineRows, checkins] = await Promise.all([
    gatherPeakStateInputs(userId, date),
    listCaffeineForDate(userId, date),
    listEnergyCheckinsSince(userId, shiftDate(date, -(LEARN_WINDOW_DAYS - 1))),
  ]);
  const peak = computePeakState(peakInputs);

  const caffeine = caffeineRows.map((r) => ({
    hour: localHour(new Date(r.loggedAt), tzOffsetMinutes),
    mg: r.mg ?? 0,
  }));

  const learnedProfile = learnHourlyProfile(checkins, tzOffsetMinutes);
  const learnedCheckins = learnedProfile.reduce((a, s) => a + s.n, 0);
  const personalized =
    learnedProfile.length >= PERSONALIZED_MIN_HOURS &&
    learnedCheckins >= PERSONALIZED_MIN_CHECKINS;

  const { points, readinessFactor } = buildEnergyCurve({
    recovery: peak.recovery,
    sleepScore: peakInputs.sleepScoreLastNight,
    caffeine,
    learnedProfile,
  });

  // Today's actual check-ins for the predicted-vs-actual overlay.
  const actual = checkins
    .filter((c) => (c.date as unknown as string) === date)
    .map((c) => ({ hour: localHour(new Date(c.loggedAt), tzOffsetMinutes), score: c.score }));

  return {
    points,
    readinessFactor,
    inputs: {
      recovery: peak.recovery,
      sleepScore: peakInputs.sleepScoreLastNight,
      hrvToday: peakInputs.hrvToday,
    },
    caffeineMgToday: caffeine.reduce((a, c) => a + c.mg, 0),
    learnedHours: learnedProfile.length,
    learnedCheckins,
    personalized,
    actual,
  };
}
