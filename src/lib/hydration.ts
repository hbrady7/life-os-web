/**
 * computeHydrationTarget(userId, date) — a daily water target in oz with a
 * "show your math" breakdown. Each contribution is itemized so the UI can
 * render a transparent table that sums to the target.
 *
 *   base       = bodyweight(kg) × ml/kg            (personalized; needs a weight)
 *   exercise   = avg daily training minutes (7d) → +12oz per 30 min
 *   caffeine   = today's caffeine mg              → +4oz per 100mg (mild diuretic)
 *   modifiers  = user-entered extras (hot day, etc.)
 *
 * Nothing personal is hardcoded — weight comes from logged data, the
 * ratios + bottle size + modifiers come from settings.
 */

import { shiftDate, todayStr } from "@/lib/date";
import { getSettings } from "@/lib/data/settings";
import { readWeightRange } from "@/lib/data/metrics";
import { listBodyMeasurements } from "@/lib/data/body";
import { listWorkouts } from "@/lib/data/workouts";
import { listCaffeineForDate } from "@/lib/data/caffeine";
import { ML_PER_OZ, readVitalitySettings } from "@/lib/vitality";

export type HydrationLine = {
  key: "base" | "exercise" | "caffeine" | "modifier";
  label: string;
  oz: number;
  detail: string;
};

export type HydrationTarget = {
  targetOz: number;
  bottleOz: number;
  bottles: number;
  breakdown: HydrationLine[];
  weightLb: number | null;
  personalized: boolean;
};

const DEFAULT_BASE_OZ = 96;

export async function computeHydrationTarget(
  userId: string,
  date: string = todayStr()
): Promise<HydrationTarget> {
  const [weightRange, body, workouts, caffeine, settings] = await Promise.all([
    readWeightRange(userId, shiftDate(date, -30), date),
    listBodyMeasurements(userId),
    listWorkouts(userId),
    listCaffeineForDate(userId, date),
    getSettings(userId),
  ]);
  const v = readVitalitySettings(settings).hydration;

  // Latest weight: prefer weight_logs, fall back to body_measurements.
  const sortedWeights = [...weightRange].sort((a, b) => (a.date < b.date ? -1 : 1));
  let weightLb: number | null =
    sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].lb : null;
  if (weightLb == null) {
    const withWeight = body
      .filter((m) => m.weight != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    weightLb = withWeight.length ? withWeight[withWeight.length - 1].weight! : null;
  }

  const breakdown: HydrationLine[] = [];

  // Base.
  let baseOz: number;
  if (weightLb != null) {
    const kg = weightLb / 2.20462;
    baseOz = Math.round((kg * v.mlPerKg) / ML_PER_OZ);
    breakdown.push({
      key: "base",
      label: "Body weight",
      oz: baseOz,
      detail: `${Math.round(weightLb)}lb × ${v.mlPerKg}ml/kg`,
    });
  } else {
    baseOz = DEFAULT_BASE_OZ;
    breakdown.push({
      key: "base",
      label: "Base (default)",
      oz: baseOz,
      detail: "log your weight to personalize",
    });
  }

  // Exercise add-on from weekly training volume.
  const sevenAgo = shiftDate(date, -7);
  const weeklyMin = workouts
    .filter((w) => w.date >= sevenAgo && w.date <= date)
    .reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const avgDailyMin = weeklyMin / 7;
  const exerciseOz = Math.round((avgDailyMin / 30) * 12);
  if (exerciseOz > 0) {
    breakdown.push({
      key: "exercise",
      label: "Training",
      oz: exerciseOz,
      detail: `~${Math.round(avgDailyMin)}min/day avg this week`,
    });
  }

  // Caffeine add-on.
  const caffeineMg = caffeine.reduce((a, c) => a + (c.mg ?? 0), 0);
  const caffeineOz = Math.round((caffeineMg / 100) * 4);
  if (caffeineOz > 0) {
    breakdown.push({
      key: "caffeine",
      label: "Caffeine offset",
      oz: caffeineOz,
      detail: `${Math.round(caffeineMg)}mg today`,
    });
  }

  // User modifiers.
  for (const m of v.modifiers) {
    if (!m.oz) continue;
    breakdown.push({ key: "modifier", label: m.label, oz: Math.round(m.oz), detail: "custom" });
  }

  const targetOz = breakdown.reduce((a, l) => a + l.oz, 0);
  const bottleOz = v.bottleOz > 0 ? v.bottleOz : 20;

  return {
    targetOz,
    bottleOz,
    bottles: targetOz / bottleOz,
    breakdown,
    weightLb,
    personalized: weightLb != null,
  };
}
