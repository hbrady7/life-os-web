import { parse, isValid } from "date-fns";
import type { DateStr, LiftExercise, LiftSession, LiftSet } from "./types";
import { uid } from "./utils";

/**
 * Parse a RepCount-style paste into structured session data.
 *
 * Expected shape:
 *
 *   May 11, 2026                  (optional — defaults to today if omitted)
 *
 *   Machine chest press
 *   110 x 13
 *   130 x 9
 *
 *   Pushups
 *   0 x 24
 *
 *   Logged using RepCount         (optional trailer, stripped)
 *
 * Blocks are separated by one or more blank lines. Within a block, the
 * first line is the exercise name and every subsequent line is a set in
 * "WEIGHT x REPS" form (case-insensitive x, optional surrounding spaces,
 * weight may be 0 for bodyweight).
 */
export type ParseResult = {
  date: DateStr;
  exercises: Array<{
    name: string;
    sets: Array<{ weight: number; reps: number }>;
  }>;
  warnings: string[];
};

const DATE_FORMATS = [
  "MMMM d, yyyy",
  "MMM d, yyyy",
  "MMMM d yyyy",
  "MMM d yyyy",
  "M/d/yyyy",
  "yyyy-MM-dd",
] as const;

const SET_LINE = /^\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+)\s*$/;

function tryParseDate(line: string): Date | null {
  const cleaned = line.trim();
  for (const fmt of DATE_FORMATS) {
    const d = parse(cleaned, fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

function toIso(d: Date): DateStr {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseRepCount(raw: string, fallbackDate: DateStr): ParseResult {
  const warnings: string[] = [];
  const lines = raw
    .split("\n")
    // strip carriage returns + trim, but keep blank-line semantics
    .map((l) => l.replace(/\r/g, "").trimEnd());

  // pop the RepCount trailer if present
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (
    lines.length &&
    /^logged using repcount\b/i.test(lines[lines.length - 1].trim())
  ) {
    lines.pop();
  }
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  let date = fallbackDate;
  // try the first non-empty line as a date
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length) {
    const candidate = tryParseDate(lines[i]);
    if (candidate) {
      date = toIso(candidate);
      i++;
    }
  }

  // split remaining lines into blocks separated by blank lines
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      if (cur.length) {
        blocks.push(cur);
        cur = [];
      }
      continue;
    }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur);

  const exercises: ParseResult["exercises"] = [];

  for (const block of blocks) {
    const trimmed = block.map((l) => l.trim()).filter(Boolean);
    if (trimmed.length === 0) continue;

    // name = first line that doesn't look like a set
    const firstSetIdx = trimmed.findIndex((l) => SET_LINE.test(l));
    if (firstSetIdx === -1) {
      // No sets in this block — skip but warn
      warnings.push(`Skipped block (no sets): ${trimmed.join(" / ")}`);
      continue;
    }
    const nameParts = trimmed.slice(0, firstSetIdx);
    if (nameParts.length === 0) {
      warnings.push(`Skipped block (no exercise name): ${trimmed.join(" / ")}`);
      continue;
    }
    const name = nameParts.join(" ").trim();
    const sets: Array<{ weight: number; reps: number }> = [];
    for (const line of trimmed.slice(firstSetIdx)) {
      const m = line.match(SET_LINE);
      if (!m) {
        warnings.push(`Couldn't parse set line under "${name}": ${line}`);
        continue;
      }
      const weight = parseFloat(m[1]);
      const reps = parseInt(m[2], 10);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) continue;
      sets.push({ weight, reps });
    }
    if (sets.length === 0) continue;
    exercises.push({ name, sets });
  }

  return { date, exercises, warnings };
}

/** Convert a ParseResult into a complete LiftSession (assigns ids/order). */
export function parseResultToSession(
  result: ParseResult,
  raw: string
): LiftSession {
  const exercises: LiftExercise[] = result.exercises.map((ex) => ({
    id: uid(),
    name: ex.name,
    normalizedName: ex.name.trim().toLowerCase(),
    sets: ex.sets.map<LiftSet>((s, i) => ({
      weight: s.weight,
      reps: s.reps,
      order: i,
    })),
  }));
  return {
    id: uid(),
    date: result.date,
    exercises,
    createdAt: new Date().toISOString(),
    raw,
  };
}

/** Epley estimated 1-rep max. Bodyweight (weight===0) returns 0 — caller
 * may treat that as a separate "reps only" track. */
export function estimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Per-set volume (weight × reps). */
export function setVolume(s: LiftSet): number {
  return s.weight * s.reps;
}

/** "Top set" by weight (ties broken by reps). */
export function topSet(sets: LiftSet[]): LiftSet | null {
  if (!sets.length) return null;
  return [...sets].sort(
    (a, b) => b.weight - a.weight || b.reps - a.reps
  )[0];
}

/** Best estimated 1RM across the sets. */
export function bestE1RM(sets: LiftSet[]): number {
  let best = 0;
  for (const s of sets) {
    const e = estimated1RM(s.weight, s.reps);
    if (e > best) best = e;
  }
  return best;
}

/** Sum of weight × reps. */
export function totalVolume(sets: LiftSet[]): number {
  let v = 0;
  for (const s of sets) v += setVolume(s);
  return v;
}
