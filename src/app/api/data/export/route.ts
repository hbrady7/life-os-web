/**
 * GET /api/data/export — full personal-data export ("data ownership").
 *
 *   ?format=json (default) → one JSON document with every user-scoped table.
 *   ?format=csv            → a flattened daily-log CSV (one row per date) that
 *                            drops straight into a spreadsheet.
 *
 * Auth-gated + strictly user-scoped: every query filters by the session
 * userId. OAuth token columns on `integrations` are REDACTED — an export must
 * never leak the encrypted access/refresh tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** User-scoped tables to include. daily_learnings (app-wide) and the auth
 *  tables (users/accounts/sessions — credentials) are intentionally excluded. */
const TABLES: Array<[string, unknown]> = [
  ["settings", s.userSettings],
  ["dayEntries", s.dayEntries],
  ["habits", s.habits],
  ["habitLogs", s.habitLogs],
  ["goals", s.goals],
  ["recurringGoals", s.recurringGoals],
  ["recurringGoalGenerations", s.recurringGoalGenerations],
  ["morningRoutineItems", s.morningRoutineItems],
  ["morningRoutineLogs", s.morningRoutineLogs],
  ["eveningRoutineItems", s.eveningRoutineItems],
  ["eveningRoutineLogs", s.eveningRoutineLogs],
  ["scheduleBlocks", s.scheduleBlocks],
  ["workouts", s.workouts],
  ["exercises", s.exercises],
  ["liftSessions", s.liftSessions],
  ["workoutRoutines", s.workoutRoutines],
  ["workoutHrSeries", s.workoutHrSeries],
  ["meals", s.meals],
  ["savedMeals", s.savedMeals],
  ["recipes", s.recipes],
  ["fastingWindows", s.fastingWindows],
  ["waterLogs", s.waterLogs],
  ["weightLogs", s.weightLogs],
  ["moodLogs", s.moodLogs],
  ["energyLogs", s.energyLogs],
  ["stepsLogs", s.stepsLogs],
  ["hrvLogs", s.hrvLogs],
  ["restingHeartRateLogs", s.restingHeartRateLogs],
  ["sleepLogs", s.sleepLogs],
  ["cardioLoadLogs", s.cardioLoadLogs],
  ["peakStateLogs", s.peakStateLogs],
  ["bodyMeasurements", s.bodyMeasurements],
  ["bodyPhotos", s.bodyPhotos],
  ["bodyPhotoSessions", s.bodyPhotoSessions],
  ["behaviors", s.behaviors],
  ["journalEntries", s.journalEntries],
  ["listItems", s.listItems],
  ["insights", s.insights],
  ["weeklyReviews", s.weeklyReviews],
  ["userFacts", s.userFacts],
  ["integrationProvenance", s.integrationProvenance],
  ["memories", s.memories],
  ["mentorMessages", s.mentorMessages],
  ["caffeineLogs", s.caffeineLogs],
  ["supplements", s.supplements],
  ["supplementLogs", s.supplementLogs],
  ["energyCheckins", s.energyCheckins],
  ["planBlocks", s.planBlocks],
  ["ideas", s.ideas],
  ["quotes", s.quotes],
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userOr = await requireUser();
  if (userOr instanceof NextResponse) return userOr;
  const userId = userOr.id;

  try {
    const data: Record<string, unknown> = {};
    for (const [name, table] of TABLES) {
      const t = table as any;
      data[name] = await db.select().from(t).where(eq(t.userId, userId));
    }

    // Integrations: metadata only, tokens redacted.
    const integrationRows = await db
      .select()
      .from(s.integrations)
      .where(eq(s.integrations.userId, userId));
    data.integrations = integrationRows.map((r) => ({
      provider: r.provider,
      email: r.email,
      expiresAt: r.expiresAt,
      needsReconnect: r.needsReconnect,
      lastSyncedAt: r.lastSyncedAt,
      accessTokenEncrypted: "[redacted]",
      refreshTokenEncrypted: "[redacted]",
    }));

    const format = req.nextUrl.searchParams.get("format");
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csv = dailyRollupCsv(data);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv;charset=utf-8",
          "content-disposition": `attachment; filename="life-os-daily-${stamp}.csv"`,
        },
      });
    }

    const payload = {
      app: "life-os",
      exportedAt: new Date().toISOString(),
      user: { id: userId, email: userOr.email ?? null },
      note: "Full personal-data export. OAuth tokens redacted. Photo/audio blobs live on-device (IndexedDB) and are not included.",
      data,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json;charset=utf-8",
        "content-disposition": `attachment; filename="life-os-export-${stamp}.json"`,
      },
    });
  } catch (e) {
    console.error("[data/export] failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export_failed" },
      { status: 500 }
    );
  }
}

/** Flatten the per-metric daily tables into one row per date. */
function dailyRollupCsv(data: Record<string, unknown>): string {
  type Row = Record<string, string | number>;
  const byDate: Record<string, Row> = {};
  const ensure = (date: string): Row => (byDate[date] ??= { date });

  const rows = (k: string) => (data[k] as Array<Record<string, unknown>>) ?? [];

  for (const r of rows("sleepLogs")) {
    const row = ensure(r.date as string);
    if (r.hours != null) row.sleep_hours = r.hours as number;
    if (r.score != null) row.sleep_score = r.score as number;
  }
  for (const r of rows("moodLogs")) ensure(r.date as string).mood = r.value as number;
  for (const r of rows("stepsLogs")) ensure(r.date as string).steps = r.count as number;
  for (const r of rows("weightLogs")) ensure(r.date as string).weight_lb = r.lb as number;
  for (const r of rows("waterLogs")) ensure(r.date as string).water_oz = r.oz as number;
  for (const r of rows("hrvLogs")) ensure(r.date as string).hrv_ms = r.ms as number;
  for (const r of rows("restingHeartRateLogs"))
    ensure(r.date as string).resting_hr = r.bpm as number;
  for (const r of rows("peakStateLogs")) {
    const row = ensure(r.date as string);
    if (r.peakState != null) row.peak_state = r.peakState as number;
    if (r.recovery != null) row.recovery = r.recovery as number;
    if (r.strain != null) row.strain = r.strain as number;
  }
  for (const m of rows("meals")) {
    const row = ensure(m.date as string);
    row.calories = ((row.calories as number) ?? 0) + ((m.calories as number) ?? 0);
    row.protein_g = ((row.protein_g as number) ?? 0) + ((m.protein as number) ?? 0);
  }

  const cols = [
    "date",
    "sleep_hours",
    "sleep_score",
    "recovery",
    "peak_state",
    "strain",
    "mood",
    "steps",
    "weight_lb",
    "water_oz",
    "hrv_ms",
    "resting_hr",
    "calories",
    "protein_g",
  ];
  const escape = (v: string | number | undefined) => {
    if (v == null) return "";
    const str = String(v);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [cols.join(",")];
  for (const date of Object.keys(byDate).sort()) {
    const row = byDate[date];
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
}
