/**
 * assembleInsightSeries(userId) — the server-side data gather for the Insight
 * Engine. Reads a window of every relevant domain and aligns them into
 * per-date tracks the pure engine (lib/insight-engine.ts) can correlate.
 *
 * Attribution notes (deliberate, honest choices):
 *  - Daily-singleton metrics (sleep, mood, steps, hrv, rhr, peak state) come
 *    straight off their (userId, date) rows — no timezone ambiguity.
 *  - Caffeine timing is the one tz-sensitive predictor: `loggedAt` is a
 *    timestamp, so the caller passes the client's `tzOffsetMinutes`
 *    (Date.getTimezoneOffset()) and we resolve each drink to the user's local
 *    wall-clock hour/date. Without it we'd read the server's UTC hour and the
 *    "past your cutoff" test would be wrong.
 *  - Sparse predictors (caffeine, supplements, protein, water) are only
 *    recorded on days the user actually logged them, so an unlogged day is
 *    treated as "unknown", never silently as a zero — that keeps the low arm
 *    honest.
 *  - workoutDay is set for every window day (true/false) because, for an
 *    active logger, a day with no session is a genuine rest day.
 */

import { and, between, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  caffeineLogs,
  liftSessions,
  meals,
  supplementLogs,
  workouts,
} from "@/lib/db/schema";
import {
  readHrvRange,
  readMoodRange,
  readRestingHeartRateRange,
  readSleepRange,
  readStepsRange,
  readWaterRange,
} from "@/lib/data/metrics";
import { readPeakStateRange } from "@/lib/data/peak-state";
import { listBehaviors } from "@/lib/data/behaviors";
import { listSupplements } from "@/lib/data/supplements";
import { listEnergyCheckinsSince } from "@/lib/data/energy-checkins";
import { getSettings } from "@/lib/data/settings";
import { readVitalitySettings } from "@/lib/vitality";
import { shiftDate, todayStr } from "@/lib/date";
import type { InsightSeries, SeriesMap } from "@/lib/insight-engine";

const WATER_TARGET_FALLBACK_OZ = 96;

/** Resolve a timestamp to the user's local wall-clock via a UTC-minute offset. */
function localParts(ts: Date, tzOffsetMinutes: number): { date: string; hour: number } {
  // getTimezoneOffset() is minutes BEHIND UTC (EST = 300). Shifting the epoch
  // by that amount makes the Date's UTC fields read as local wall-clock.
  const shifted = new Date(ts.getTime() - tzOffsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hour = shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
  return { date: `${y}-${m}-${d}`, hour };
}

export async function assembleInsightSeries(
  userId: string,
  opts: { days?: number; tzOffsetMinutes?: number } = {}
): Promise<{ series: InsightSeries; windowDays: number; end: string }> {
  const days = opts.days ?? 90;
  const tz = opts.tzOffsetMinutes ?? 0;
  const end = todayStr();
  const start = shiftDate(end, -(days - 1));

  const [
    sleepRows,
    moodRows,
    stepRows,
    hrvRows,
    rhrRows,
    waterRows,
    peakRows,
    behaviorRows,
    caffeineRows,
    supLogRows,
    stack,
    mealRows,
    workoutRows,
    liftRows,
    checkins,
    settings,
  ] = await Promise.all([
    readSleepRange(userId, start, end),
    readMoodRange(userId, start, end),
    readStepsRange(userId, start, end),
    readHrvRange(userId, start, end),
    readRestingHeartRateRange(userId, start, end),
    readWaterRange(userId, start, end),
    readPeakStateRange(userId, start, end),
    listBehaviors(userId, { start, end }),
    db
      .select()
      .from(caffeineLogs)
      .where(
        and(
          eq(caffeineLogs.userId, userId),
          gte(caffeineLogs.loggedAt, new Date(start + "T00:00:00.000Z"))
        )
      ),
    db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          between(supplementLogs.date, start, end)
        )
      ),
    listSupplements(userId),
    db
      .select({ date: meals.date, protein: meals.protein })
      .from(meals)
      .where(and(eq(meals.userId, userId), between(meals.date, start, end))),
    db
      .select({ date: workouts.date })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), between(workouts.date, start, end))),
    db
      .select({ date: liftSessions.date })
      .from(liftSessions)
      .where(
        and(eq(liftSessions.userId, userId), between(liftSessions.date, start, end))
      ),
    listEnergyCheckinsSince(userId, start),
    getSettings(userId),
  ]);

  const vitality = readVitalitySettings(settings as Record<string, unknown>);
  const cutoffHour = vitality.caffeine.cutoffHour;
  const s = settings as { waterTargetOz?: number };
  const waterTarget =
    s.waterTargetOz && s.waterTargetOz > 0 ? s.waterTargetOz : WATER_TARGET_FALLBACK_OZ;

  // ── Daily singletons ──────────────────────────────────────────────────────
  const sleepHours: SeriesMap = {};
  const sleepScore: SeriesMap = {};
  for (const r of sleepRows) {
    if (r.hours != null) sleepHours[r.date] = r.hours;
    if (r.score != null) sleepScore[r.date] = r.score;
  }
  const mood: SeriesMap = {};
  for (const r of moodRows) mood[r.date] = r.value;
  const steps: SeriesMap = {};
  for (const r of stepRows) steps[r.date] = r.count;
  const peakState: SeriesMap = {};
  for (const r of peakRows) if (r.peakState != null) peakState[r.date] = r.peakState;
  const waterPct: SeriesMap = {};
  for (const r of waterRows) waterPct[r.date] = ((r.oz ?? 0) / waterTarget) * 100;

  // ── Behaviors ─────────────────────────────────────────────────────────────
  const alcohol: SeriesMap = {};
  const stress: SeriesMap = {};
  const meditation: SeriesMap = {};
  const screenBeforeBed: SeriesMap = {};
  const lateMeal: SeriesMap = {};
  for (const b of behaviorRows) {
    if (b.alcoholDrinks != null) alcohol[b.date] = b.alcoholDrinks;
    if (b.stressLevel != null) stress[b.date] = b.stressLevel;
    if (b.meditationMin != null) meditation[b.date] = b.meditationMin;
    if (b.screenTimeMinBeforeBed != null)
      screenBeforeBed[b.date] = b.screenTimeMinBeforeBed;
    if (b.lateMeal != null) lateMeal[b.date] = b.lateMeal;
  }

  // ── Caffeine (tz-resolved) ────────────────────────────────────────────────
  const caffTotals: Record<string, { mg: number; latestHour: number; anyPastCutoff: boolean }> =
    {};
  for (const c of caffeineRows) {
    const { date, hour } = localParts(c.loggedAt, tz);
    if (date < start || date > end) continue;
    const cur = caffTotals[date] ?? { mg: 0, latestHour: 0, anyPastCutoff: false };
    cur.mg += c.mg ?? 0;
    cur.latestHour = Math.max(cur.latestHour, hour);
    if (hour >= cutoffHour) cur.anyPastCutoff = true;
    caffTotals[date] = cur;
  }
  const caffeineMg: SeriesMap = {};
  const caffeineLatestHour: SeriesMap = {};
  const caffeineAfterCutoff: SeriesMap = {};
  for (const [date, v] of Object.entries(caffTotals)) {
    caffeineMg[date] = v.mg;
    caffeineLatestHour[date] = v.latestHour;
    caffeineAfterCutoff[date] = v.anyPastCutoff;
  }

  // ── Supplement adherence (among logged days) ──────────────────────────────
  const stackSize = stack.length;
  const supByDate: Record<string, number> = {};
  for (const l of supLogRows) supByDate[l.date] = (supByDate[l.date] ?? 0) + 1;
  const supplementAdherence: SeriesMap = {};
  if (stackSize > 0) {
    for (const [date, taken] of Object.entries(supByDate)) {
      supplementAdherence[date] = Math.min(1, taken / stackSize) * 100;
    }
  }

  // ── Protein (among logged days) ───────────────────────────────────────────
  const proteinByDate: Record<string, number> = {};
  for (const m of mealRows)
    proteinByDate[m.date] = (proteinByDate[m.date] ?? 0) + (m.protein ?? 0);
  const protein: SeriesMap = { ...proteinByDate };

  // ── Felt energy (avg of check-in scores per day) ──────────────────────────
  const energyAgg: Record<string, { sum: number; n: number }> = {};
  for (const c of checkins) {
    const cur = energyAgg[c.date] ?? { sum: 0, n: 0 };
    cur.sum += c.score;
    cur.n += 1;
    energyAgg[c.date] = cur;
  }
  const energyDay: SeriesMap = {};
  for (const [date, v] of Object.entries(energyAgg)) energyDay[date] = v.sum / v.n;

  // ── Workout day (dense boolean over the window) ───────────────────────────
  const trained = new Set<string>();
  for (const w of workoutRows) trained.add(w.date);
  for (const l of liftRows) trained.add(l.date);
  const workoutDay: SeriesMap = {};
  // Only mark days that fall within the window and have SOME signal that the
  // user was logging that day (any tracked metric present), so idle stretches
  // before the user started using the app don't flood the "rest" arm.
  const activeDates = new Set<string>([
    ...Object.keys(sleepHours),
    ...Object.keys(mood),
    ...Object.keys(steps),
    ...Object.keys(peakState),
    ...Object.keys(waterPct),
    ...trained,
  ]);
  for (const date of activeDates) {
    if (date < start || date > end) continue;
    workoutDay[date] = trained.has(date);
  }

  const series: InsightSeries = {
    sleepHours,
    sleepScore,
    peakState,
    mood,
    energyDay,
    caffeineMg,
    caffeineLatestHour,
    caffeineAfterCutoff,
    waterPct,
    supplementAdherence,
    workoutDay,
    steps,
    alcohol,
    stress,
    meditation,
    screenBeforeBed,
    lateMeal,
    protein,
  };

  return { series, windowDays: days, end };
}
