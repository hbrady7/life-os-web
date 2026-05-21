/**
 * RepCount CSV importer.
 *
 * Expected columns:
 *   Workout Start, Workout End, Exercise, Weight, Reps, Notes, Kcal,
 *   Distance, Duration, Category, Name, Bodyweight
 *
 * One row = one set. A session is all rows sharing the same Workout Start
 * timestamp. Weight is in lb. See HARD CONSTRAINTS in the import spec for
 * edge-case handling (bodyweight=0, missing weight/reps, cardio rows).
 */

import Papa from "papaparse";
import type { LiftExercise, LiftSession, LiftSet, DateStr } from "./types";
import { uid } from "./utils";

export type CsvRow = {
  "Workout Start"?: string;
  "Workout End"?: string;
  Exercise?: string;
  Weight?: string;
  Reps?: string;
  Notes?: string;
  Kcal?: string;
  Distance?: string;
  Duration?: string;
  Category?: string;
  Name?: string;
  Bodyweight?: string;
};

export type ExerciseCatalogEntry = {
  /** Lowercased + trimmed exercise name. */
  normalizedName: string;
  /** First-seen display name (preserves the user's casing). */
  name: string;
  /** Raw category from the CSV (Chest, Back, Legs, etc.). */
  category: string;
  /** How many sets total appear under this exercise across all sessions. */
  setCount: number;
  /** ISO date of the most recent session that includes this exercise. */
  lastUsed: DateStr;
};

export type ImportSummary = {
  workouts: number;
  exercises: number;
  sets: number;
  cardioSets: number;
  /** Rows we couldn't attribute to a session at all (missing Workout Start). */
  skippedRows: number;
  /** Rows that imported but lacked usable weight or reps. */
  unloadedSets: number;
  /** Oldest and newest session dates (YYYY-MM-DD). */
  dateRange: { start: DateStr; end: DateStr } | null;
};

export type ImportResult = {
  sessions: LiftSession[];
  catalog: ExerciseCatalogEntry[];
  summary: ImportSummary;
  warnings: string[];
};

/* ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */

/** "5/18/26 9:06" → "2026-05-18". Handles 1- or 2-digit month/day, 2- or
 *  4-digit year, optional time component. Falls through to ISO "YYYY-MM-DD"
 *  if the input already looks like that. Returns null on no-match so the
 *  caller can skip the row. */
function parseStartToIsoDate(raw: string | undefined): DateStr | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Already YYYY-MM-DD (possibly with time)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // M/D/YY[YY] [H:MM]
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10);
    const d = parseInt(slashMatch[2], 10);
    let y = parseInt(slashMatch[3], 10);
    if (slashMatch[3].length === 2) {
      // 2-digit year window. Match RepCount's exports: 22 → 2022, 99 → 1999.
      // Anything < 70 is 20xx; >= 70 is 19xx.
      y = y < 70 ? 2000 + y : 1900 + y;
    }
    if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
      return null;
    }
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/** Number-or-null. Empty string and non-numeric values yield null so
 *  callers can decide whether to skip the row. */
function toNumOrNull(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Loose check: the row is a cardio entry rather than a weight-x-reps set.
 *  RepCount cardio rows tend to have a Duration or Distance value and
 *  either zero or non-numeric weight. */
function looksLikeCardio(row: CsvRow): boolean {
  const cat = (row.Category ?? "").trim().toLowerCase();
  if (cat === "cardio") return true;
  const hasDuration = !!(row.Duration && row.Duration.trim().length);
  const hasDistance = !!(row.Distance && row.Distance.trim().length);
  return hasDuration || hasDistance;
}

/* ─────────────────────────────────────────────────────────────────────
 * Main parser
 * ──────────────────────────────────────────────────────────────────── */

export function parseRepCountCsv(text: string): ImportResult {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const warnings: string[] = [];
  for (const err of result.errors) {
    if (err.type !== "Quotes") {
      warnings.push(`CSV parse: ${err.message} (row ${err.row ?? "?"})`);
    }
  }

  // Group rows by Workout Start. Map iteration order is insertion order, so
  // sessions land back in CSV order.
  type RowBundle = { startKey: string; rows: CsvRow[] };
  const byStart = new Map<string, RowBundle>();
  let skippedRows = 0;

  for (const row of result.data) {
    const startKey = (row["Workout Start"] ?? "").trim();
    if (!startKey) {
      skippedRows += 1;
      continue;
    }
    const bundle = byStart.get(startKey);
    if (bundle) bundle.rows.push(row);
    else byStart.set(startKey, { startKey, rows: [row] });
  }

  // Build per-session structures.
  const sessions: LiftSession[] = [];
  let totalSets = 0;
  let cardioSets = 0;
  let unloadedSets = 0;
  let earliest: DateStr | null = null;
  let latest: DateStr | null = null;

  const catalog = new Map<string, ExerciseCatalogEntry>();

  for (const { startKey, rows } of byStart.values()) {
    const isoDate = parseStartToIsoDate(startKey);
    if (!isoDate) {
      skippedRows += rows.length;
      warnings.push(`Unparseable Workout Start "${startKey}" — skipped ${rows.length} rows`);
      continue;
    }
    if (earliest == null || isoDate < earliest) earliest = isoDate;
    if (latest == null || isoDate > latest) latest = isoDate;

    // First non-empty Name in the bundle is the session title.
    const sessionTitle =
      (rows.find((r) => (r.Name ?? "").trim())?.Name ?? "").trim() || "Workout";

    // Group rows within the session by trimmed Exercise name.
    type ExerciseBundle = {
      displayName: string;
      normalizedName: string;
      category: string;
      sets: LiftSet[];
    };
    const exerciseMap = new Map<string, ExerciseBundle>();

    for (const row of rows) {
      const rawName = (row.Exercise ?? "").trim();
      if (!rawName) {
        // Row has a session start but no exercise — likely a misexport. Skip silently.
        continue;
      }
      const key = rawName.toLowerCase();
      let bundle = exerciseMap.get(key);
      if (!bundle) {
        bundle = {
          displayName: rawName,
          normalizedName: key,
          category: (row.Category ?? "").trim() || "Other",
          sets: [],
        };
        exerciseMap.set(key, bundle);
      }

      const isCardio = looksLikeCardio(row);
      const weight = toNumOrNull(row.Weight);
      const reps = toNumOrNull(row.Reps);
      const order = bundle.sets.length;

      if (isCardio) {
        // Best-effort cardio import: drop into a 0/0 set with a notes string so
        // it round-trips visibly. Excluded from volume math via weight=0 / reps=0.
        const noteParts: string[] = [];
        const duration = toNumOrNull(row.Duration);
        const distance = (row.Distance ?? "").trim();
        const kcal = toNumOrNull(row.Kcal);
        if (duration != null) {
          // Best-guess: RepCount writes Duration in seconds for cardio.
          if (duration >= 60) {
            const min = Math.round(duration / 60);
            noteParts.push(`${min}m`);
          } else {
            noteParts.push(`${duration}s`);
          }
        }
        if (distance) noteParts.push(`${distance}`);
        if (kcal != null) noteParts.push(`${kcal} kcal`);
        bundle.sets.push({
          weight: 0,
          reps: 0,
          order,
          notes: noteParts.length ? noteParts.join(" · ") : "Cardio",
        });
        cardioSets += 1;
        totalSets += 1;
        continue;
      }

      // Strength / bodyweight set.
      const w = weight == null ? 0 : weight; // bodyweight = 0
      const r = reps == null ? 0 : reps;
      if (weight == null || reps == null) unloadedSets += 1;
      bundle.sets.push({ weight: w, reps: r, order });
      totalSets += 1;
    }

    const exercises: LiftExercise[] = [];
    for (const bundle of exerciseMap.values()) {
      // Empty exercise (every row malformed) — skip.
      if (bundle.sets.length === 0) continue;
      exercises.push({
        id: uid(),
        name: bundle.displayName,
        normalizedName: bundle.normalizedName,
        sets: bundle.sets,
      });

      // Catalog: first-write wins for displayName + category, then bump
      // setCount and lastUsed (latest date wins).
      const existing = catalog.get(bundle.normalizedName);
      if (existing) {
        existing.setCount += bundle.sets.length;
        if (isoDate > existing.lastUsed) existing.lastUsed = isoDate;
      } else {
        catalog.set(bundle.normalizedName, {
          normalizedName: bundle.normalizedName,
          name: bundle.displayName,
          category: bundle.category,
          setCount: bundle.sets.length,
          lastUsed: isoDate,
        });
      }
    }

    if (exercises.length === 0) continue;

    sessions.push({
      id: uid(),
      date: isoDate,
      exercises,
      createdAt: new Date().toISOString(),
      raw: `Imported from RepCount · ${sessionTitle}`,
    });
  }

  // Sort sessions oldest → newest by date for deterministic output.
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    sessions,
    catalog: Array.from(catalog.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    summary: {
      workouts: sessions.length,
      exercises: catalog.size,
      sets: totalSets,
      cardioSets,
      skippedRows,
      unloadedSets,
      dateRange: earliest && latest ? { start: earliest, end: latest } : null,
    },
    warnings,
  };
}
