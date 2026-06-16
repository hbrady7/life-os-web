/**
 * getUserContext(userId) — the single server-side snapshot of a user's
 * recent state, consumed by the Mentor chat (Phase 1) and the energy
 * curve (Phase 2). Pure I/O + the Peak State formula; no Date.now beyond
 * "today".
 *
 * Reuses the existing data layer (lib/data/*) and the Peak State pipeline
 * (gather + compute) rather than re-querying by hand. Extended per
 * Vitality phase: memories (P1), caffeine (P3), supplements (P4) get
 * folded into the returned object as those tables land.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { shiftDate, todayStr } from "@/lib/date";
import { getSettings } from "@/lib/data/settings";
import { listGoalsForDate } from "@/lib/data/goals";
import { getWater, readSleepRange, readWeightRange } from "@/lib/data/metrics";
import { listMealsForDate } from "@/lib/data/meals";
import { getWorkoutForDate, listWorkouts } from "@/lib/data/workouts";
import { listMemories } from "@/lib/data/memories";
import { listCaffeineForDate } from "@/lib/data/caffeine";
import { getSupplementSummary } from "@/lib/data/supplements";
import { gatherPeakStateInputs } from "@/lib/peak-state/gather";
import { computePeakState } from "@/lib/peak-state/compute";
import { DEFAULT_MACRO_TARGETS, type MacroTargets } from "@/lib/types";

const WATER_TARGET_FALLBACK_OZ = 96;

export type UserContext = {
  name: string | null;
  today: string;
  goalsToday: Array<{
    text: string;
    priority: string;
    done: boolean;
    emoji: string | null;
  }>;
  recovery: {
    peakState: number | null;
    recovery: number | null;
    strain: number | null;
    lifestyle: number | null;
    recommendation: string | null;
  };
  sleep: { hours: number | null; score: number | null };
  hrv: { today: number | null; baselineDays: number };
  workoutsToday: Array<{ type: string; durationMin: number; intensity: number }>;
  workouts7d: number;
  nutritionToday: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    targets: MacroTargets;
  };
  water: { oz: number; targetOz: number };
  weight: { latest: number | null; deltaLb7d: number | null };
  caffeine: { mgToday: number };
  supplements: { takenToday: number; total: number };
  memories: Array<{ content: string; kind: string }>;
};

export async function getUserContext(
  userId: string,
  date: string = todayStr()
): Promise<UserContext> {
  const [
    userRow,
    settings,
    goals,
    workoutToday,
    allWorkouts,
    mealsToday,
    waterRow,
    weightRange,
    peakInputs,
    sleepRange,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    getSettings(userId),
    listGoalsForDate(userId, date),
    getWorkoutForDate(userId, date),
    listWorkouts(userId),
    listMealsForDate(userId, date),
    getWater(userId, date),
    readWeightRange(userId, shiftDate(date, -7), date),
    gatherPeakStateInputs(userId, date),
    readSleepRange(userId, date, date),
  ]);

  const [memoryRows, caffeineToday, supplementSummary] = await Promise.all([
    listMemories(userId, 12),
    listCaffeineForDate(userId, date),
    getSupplementSummary(userId, date),
  ]);
  const memories = memoryRows.map((m) => ({ content: m.content, kind: m.kind }));
  const caffeineMgToday = caffeineToday.reduce((a, c) => a + (c.mg ?? 0), 0);

  const peak = computePeakState(peakInputs);

  const totals = mealsToday.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const s = settings as {
    waterTargetOz?: number;
    macroTargets?: MacroTargets;
  };
  const targetOz =
    s.waterTargetOz && s.waterTargetOz > 0
      ? s.waterTargetOz
      : WATER_TARGET_FALLBACK_OZ;

  // Weight trend: latest reading vs the earliest in the trailing window.
  const sortedWeights = [...weightRange].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  const latestWeight =
    sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].lb : null;
  const deltaLb7d =
    sortedWeights.length >= 2
      ? Math.round((latestWeight! - sortedWeights[0].lb) * 10) / 10
      : null;

  const sevenAgo = shiftDate(date, -7);
  const workouts7d = allWorkouts.filter(
    (w) => w.date >= sevenAgo && w.date <= date
  ).length;

  return {
    name: userRow[0]?.name ?? null,
    today: date,
    goalsToday: goals.map((g) => ({
      text: g.text,
      priority: g.priority,
      done: g.completed,
      emoji: g.emoji ?? null,
    })),
    recovery: {
      peakState: peak.peakState,
      recovery: peak.recovery,
      strain: peak.strain,
      lifestyle: peak.lifestyle,
      recommendation: peak.recommendation,
    },
    sleep: {
      hours: sleepRange.find((r) => r.date === date)?.hours ?? null,
      score: peakInputs.sleepScoreLastNight,
    },
    hrv: {
      today: peakInputs.hrvToday,
      baselineDays: peak.baselineStatus.hrv,
    },
    workoutsToday: workoutToday
      ? [
          {
            type: workoutToday.type,
            durationMin: workoutToday.durationMin,
            intensity: workoutToday.intensity,
          },
        ]
      : [],
    workouts7d,
    nutritionToday: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      targets: s.macroTargets ?? DEFAULT_MACRO_TARGETS,
    },
    water: { oz: waterRow?.oz ?? 0, targetOz },
    weight: { latest: latestWeight, deltaLb7d },
    caffeine: { mgToday: caffeineMgToday },
    supplements: supplementSummary,
    memories,
  };
}

/** Render the context as a compact text block for LLM system prompts. */
export function renderUserContext(ctx: UserContext): string {
  const goals = ctx.goalsToday.length
    ? ctx.goalsToday
        .map(
          (g) => `  - [${g.done ? "x" : " "}] (${g.priority}) ${g.text}`
        )
        .join("\n")
    : "  (none set today)";

  const workouts = ctx.workoutsToday.length
    ? ctx.workoutsToday
        .map((w) => `  - ${w.type}, ${w.durationMin}min, intensity ${w.intensity}/10`)
        .join("\n")
    : "  (none today)";

  const mem = ctx.memories.length
    ? ctx.memories.map((m) => `  - [${m.kind}] ${m.content}`).join("\n")
    : "  (none captured yet)";

  const t = ctx.nutritionToday.targets;

  return [
    `Today: ${ctx.today}`,
    ctx.name ? `User: ${ctx.name}` : "",
    "",
    "Recovery / Peak State:",
    `  - peak state: ${ctx.recovery.peakState ?? "—"}/100` +
      (ctx.recovery.recommendation
        ? ` (recommendation: ${ctx.recovery.recommendation})`
        : ""),
    `  - recovery ${ctx.recovery.recovery ?? "—"} · strain ${ctx.recovery.strain ?? "—"} · lifestyle ${ctx.recovery.lifestyle ?? "—"}`,
    `  - sleep score last night: ${ctx.sleep.score ?? "—"}`,
    `  - HRV today: ${ctx.hrv.today ?? "—"}ms (baseline days: ${ctx.hrv.baselineDays})`,
    "",
    "Goals today:",
    goals,
    "",
    "Workouts today:",
    workouts,
    `Workouts last 7 days: ${ctx.workouts7d}`,
    "",
    "Nutrition today:",
    `  - ${ctx.nutritionToday.calories} kcal · ${ctx.nutritionToday.protein}g protein · ${ctx.nutritionToday.carbs}g carbs · ${ctx.nutritionToday.fat}g fat`,
    `  - targets: ${t.calories ?? "—"} kcal · ${t.protein ?? "—"}g protein`,
    "",
    "Hydration / stimulants today:",
    `  - water: ${Math.round(ctx.water.oz)}oz of ${ctx.water.targetOz}oz target`,
    `  - caffeine: ${Math.round(ctx.caffeine.mgToday)}mg`,
    `  - supplements: ${ctx.supplements.takenToday}/${ctx.supplements.total} taken`,
    "",
    "Body weight:",
    `  - latest: ${ctx.weight.latest ?? "—"}lb` +
      (ctx.weight.deltaLb7d != null
        ? ` (${ctx.weight.deltaLb7d >= 0 ? "+" : ""}${ctx.weight.deltaLb7d}lb over 7d)`
        : ""),
    "",
    "Recent memories (things the user told the mentor to remember):",
    mem,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
