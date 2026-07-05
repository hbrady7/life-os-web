/**
 * Gather all Peak State inputs for (userId, date) from Neon. Pure I/O —
 * no computation lives here. The output of this function feeds directly
 * into computePeakState in compute.ts.
 *
 * Designed to be invoked from server code (route handlers, server
 * actions). All reads run in parallel via Promise.all so a recompute
 * round-trip stays within Vercel's serverless request budget on the
 * free tier.
 *
 * Default sleep target: 8h/night. Default water target: pulled from
 * userSettings.settings.waterTargetOz, fallback 96 oz (matches the
 * Zustand-era default).
 */

import { shiftDate } from "@/lib/date";
import { getSettings } from "@/lib/data/settings";
import {
  getMood,
  getWater,
  readCardioLoadRange,
  readEnergyRange,
  readHrvRange,
  readRestingHeartRateRange,
  readSleepRange,
} from "@/lib/data/metrics";
import { listRoutineItems, listRoutineLogs } from "@/lib/data/routines";
import { listWorkouts } from "@/lib/data/workouts";
import { computeSleepScore } from "@/lib/sleep-score";
import type { PeakStateInputs } from "./compute";

const SLEEP_TARGET_HOURS = 8;
const WATER_TARGET_FALLBACK_OZ = 96;

export async function gatherPeakStateInputs(
  userId: string,
  date: string
): Promise<PeakStateInputs> {
  const thirtyAgo = shiftDate(date, -30);
  const sevenAgo = shiftDate(date, -7);
  const twentyEightAgo = shiftDate(date, -28);

  const [
    hrvRange,
    rhrRange,
    sleepRange,
    cardioRange,
    energyRange,
    moodRow,
    waterRow,
    settingsBlob,
    routineItems,
    routineLogs,
    workouts,
  ] = await Promise.all([
    readHrvRange(userId, thirtyAgo, date),
    readRestingHeartRateRange(userId, thirtyAgo, date),
    readSleepRange(userId, sevenAgo, date),
    readCardioLoadRange(userId, twentyEightAgo, date),
    readEnergyRange(userId, date, date),
    getMood(userId, date),
    getWater(userId, date),
    getSettings(userId),
    listRoutineItems(userId, "morning"),
    listRoutineLogs(userId, "morning"),
    listWorkouts(userId),
  ]);

  // ── HRV: today + trailing 30 days excluding today ─────────────────────────
  const hrvByDate = new Map<string, number>();
  for (const r of hrvRange) hrvByDate.set(r.date, r.ms);
  const hrvToday = hrvByDate.get(date) ?? null;
  const hrvLast30Days: Array<number | null> = [];
  for (let i = 30; i >= 1; i -= 1) {
    hrvLast30Days.push(hrvByDate.get(shiftDate(date, -i)) ?? null);
  }

  // ── RHR ───────────────────────────────────────────────────────────────────
  const rhrByDate = new Map<string, number>();
  for (const r of rhrRange) rhrByDate.set(r.date, r.bpm);
  const rhrToday = rhrByDate.get(date) ?? null;
  const rhrLast30Days: Array<number | null> = [];
  for (let i = 30; i >= 1; i -= 1) {
    rhrLast30Days.push(rhrByDate.get(shiftDate(date, -i)) ?? null);
  }

  // ── Sleep: score for last night + 7-day debt ─────────────────────────────
  const sleepByDate = new Map<string, (typeof sleepRange)[number]>();
  for (const r of sleepRange) sleepByDate.set(r.date, r);
  const sleepToday = sleepByDate.get(date);
  let sleepScoreLastNight: number | null = sleepToday?.score ?? null;
  // If the provider didn't ship a native score but we have hours, fall
  // back to the composite computation that powers the Sleep tile.
  if (sleepScoreLastNight == null && sleepToday?.hours != null) {
    const breakdown = computeSleepScore({
      sleepHours: sleepToday.hours,
      sleepStages: (sleepToday.stages as Parameters<typeof computeSleepScore>[0]["sleepStages"]) ?? undefined,
    });
    sleepScoreLastNight = breakdown?.score ?? null;
  }

  let sleepDebt: number | null = null;
  {
    let debt = 0;
    let hasAny = false;
    for (let i = 0; i < 7; i += 1) {
      const row = sleepByDate.get(shiftDate(date, -i));
      if (row?.hours != null) {
        debt += Math.max(0, SLEEP_TARGET_HOURS - row.hours);
        hasAny = true;
      }
    }
    if (hasAny) sleepDebt = debt;
  }

  // ── Cardio load: 7-day rolling vs 4-week average ─────────────────────────
  const cardioByDate = new Map<string, number>();
  for (const r of cardioRange) cardioByDate.set(r.date, r.value);
  let cardioLoadLast7Days: number | null = null;
  let cardioLoadLast4WeekAvg: number | null = null;
  let cardioBaselineDays = 0;
  {
    const dailyValues: number[] = [];
    for (let i = 27; i >= 0; i -= 1) {
      const v = cardioByDate.get(shiftDate(date, -i));
      if (v != null) {
        dailyValues.push(v);
        cardioBaselineDays += 1;
      } else {
        // Missing days count as 0 toward sums; baselineDays tracks
        // how many real readings we have.
        dailyValues.push(0);
      }
    }
    if (cardioBaselineDays > 0) {
      const recent7 = dailyValues.slice(-7);
      cardioLoadLast7Days = recent7.reduce((a, b) => a + b, 0);
    }
    if (cardioBaselineDays > 0) {
      // 4-week avg = sum over 28d / 4 → weekly total.
      cardioLoadLast4WeekAvg =
        dailyValues.reduce((a, b) => a + b, 0) / 4;
    }
  }

  // ── Days since last rest day ─────────────────────────────────────────────
  // Workouts table is the canonical "training happened on this date" set.
  // 0 = today is a rest day; N = N consecutive workout-days ending today.
  const workoutDates = new Set<string>();
  for (const w of workouts) workoutDates.add(w.date);
  let daysSinceLastRest: number | null = null;
  {
    let count = 0;
    let cursor = date;
    while (workoutDates.has(cursor) && count < 30) {
      count += 1;
      cursor = shiftDate(cursor, -1);
    }
    // Only emit when we have at least *some* signal — i.e. workouts have
    // been logged anywhere in the trailing 30 days. Otherwise a brand-new
    // user looks like a 0-day streak which would skew strain low.
    if (
      workouts.some(
        (w) => w.date >= shiftDate(date, -30) && w.date <= date
      )
    ) {
      daysSinceLastRest = count;
    }
  }

  // ── Mood / energy / hydration / routine ──────────────────────────────────
  const moodToday = moodRow?.value ?? null;
  const energyToday =
    energyRange.length > 0
      ? energyRange.reduce((a, e) => a + e.value, 0) / energyRange.length
      : null;

  const settingsObj = settingsBlob as { waterTargetOz?: number } | undefined;
  const waterTargetOz =
    settingsObj?.waterTargetOz && settingsObj.waterTargetOz > 0
      ? settingsObj.waterTargetOz
      : WATER_TARGET_FALLBACK_OZ;
  const hydrationPctToday =
    waterRow?.oz != null ? waterRow.oz / waterTargetOz : null;

  const completedToday = routineLogs.filter((l) => l.date === date).length;
  const totalRoutineItems = routineItems.length;
  const morningRoutineCompletionPct =
    totalRoutineItems > 0 ? completedToday / totalRoutineItems : 0;

  return {
    hrvToday,
    hrvLast30Days,
    rhrToday,
    rhrLast30Days,
    sleepScoreLastNight,
    sleepDebtLast7Days: sleepDebt,
    cardioLoadLast7Days,
    cardioLoadLast4WeekAvg,
    cardioBaselineDays,
    daysSinceLastRest,
    moodToday,
    energyToday,
    hydrationPctToday,
    morningRoutineCompletionPct,
  };
}
