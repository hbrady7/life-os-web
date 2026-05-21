/**
 * Pure helpers for the progressive-overload coach.
 *
 * All inputs are the raw `LiftSession[]` from the store; no DB lookups.
 * That keeps these usable inside selectors, charts, and the paste
 * preview without firing extra queries.
 */

import type { LiftSession, LiftSet } from "@/lib/types";
import { bestE1RM, estimated1RM, topSet } from "@/lib/repcount";

export type ExerciseSettings = {
  targetReps: number;
  incrementLb: number;
};

export function resolveExerciseSettings(
  normalizedName: string,
  defaults: { targetReps: number; incrementLb: number },
  overrides: Record<string, { targetReps?: number; incrementLb?: number }>
): ExerciseSettings {
  const o = overrides[normalizedName] ?? {};
  return {
    targetReps:
      typeof o.targetReps === "number" ? o.targetReps : defaults.targetReps,
    incrementLb:
      typeof o.incrementLb === "number"
        ? o.incrementLb
        : defaults.incrementLb,
  };
}

export type LastSessionForExercise = {
  date: string;
  exerciseName: string;
  sets: LiftSet[];
  top: LiftSet;
};

/** Most-recent session that included this exercise (by normalizedName). */
export function lastSessionFor(
  sessions: LiftSession[],
  normalizedName: string
): LastSessionForExercise | null {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    for (const ex of s.exercises) {
      if (ex.normalizedName !== normalizedName) continue;
      const top = topSet(ex.sets);
      if (!top) continue;
      return { date: s.date, exerciseName: ex.name, sets: ex.sets, top };
    }
  }
  return null;
}

export type PR = {
  /** Highest weight × reps observed (where reps ≥ 1). */
  topWeight: number;
  topReps: number;
  topDate: string;
  /** Highest Epley e1RM across all sets ever. */
  e1RM: number;
  e1RMDate: string;
};

export function exercisePR(
  sessions: LiftSession[],
  normalizedName: string
): PR | null {
  let topWeight = 0;
  let topReps = 0;
  let topDate = "";
  let e1RM = 0;
  let e1RMDate = "";
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (ex.normalizedName !== normalizedName) continue;
      const t = topSet(ex.sets);
      if (
        t &&
        (t.weight > topWeight ||
          (t.weight === topWeight && t.reps > topReps))
      ) {
        topWeight = t.weight;
        topReps = t.reps;
        topDate = s.date;
      }
      const e = bestE1RM(ex.sets);
      if (e > e1RM) {
        e1RM = e;
        e1RMDate = s.date;
      }
    }
  }
  if (topWeight === 0 && e1RM === 0) return null;
  return { topWeight, topReps, topDate, e1RM, e1RMDate };
}

/**
 * Suggestion the coach surfaces beside an exercise:
 *  - "graduate": top set met the rep target → add weight next session
 *  - "push": top set missed the rep target → focus on closing the gap
 *  - "baseline": this is the user's first time logging the lift
 */
export type Suggestion =
  | {
      kind: "graduate";
      message: string;
      nextWeightLb: number;
    }
  | {
      kind: "push";
      message: string;
      gap: number;
    }
  | {
      kind: "baseline";
      message: string;
    };

export function suggestionFor(
  last: LastSessionForExercise | null,
  settings: ExerciseSettings
): Suggestion {
  if (!last) {
    return {
      kind: "baseline",
      message: `First log — aim for ${settings.targetReps} reps at a weight you can move clean.`,
    };
  }
  const { top } = last;
  // Bodyweight (weight === 0) is treated as a rep-target only — no
  // load to add — but we still nudge for one more rep next time.
  if (top.weight <= 0) {
    if (top.reps >= settings.targetReps) {
      return {
        kind: "graduate",
        message: `Hit ${top.reps} reps — push for ${top.reps + 1}+ next session.`,
        nextWeightLb: 0,
      };
    }
    return {
      kind: "push",
      gap: settings.targetReps - top.reps,
      message: `${top.reps}/${settings.targetReps} reps — close the gap before adding any load.`,
    };
  }
  if (top.reps >= settings.targetReps) {
    const next = round25(top.weight + settings.incrementLb);
    return {
      kind: "graduate",
      message: `Hit ${top.reps} reps at ${top.weight}lb — try ${next}lb next time.`,
      nextWeightLb: next,
    };
  }
  return {
    kind: "push",
    gap: settings.targetReps - top.reps,
    message: `${top.reps}/${settings.targetReps} reps at ${top.weight}lb — close the gap, then add weight.`,
  };
}

/** Round to the nearest 2.5lb so plate math stays clean. */
function round25(n: number): number {
  return Math.round(n * 4) / 4 === Math.round(n / 2.5) * 2.5
    ? Math.round(n / 2.5) * 2.5
    : Math.round(n / 2.5) * 2.5;
}

/**
 * Build a paste-ready RepCount template from the user's most recent
 * session: each exercise name on its own line, followed by the prior
 * top weight × an empty rep slot the user fills in. Designed to drop
 * straight into the NewSessionModal textarea so the user only types
 * the rep counts.
 */
export function buildPrefillFromLast(sessions: LiftSession[]): string | null {
  if (!sessions.length) return null;
  const latest = [...sessions].sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0];
  if (!latest?.exercises.length) return null;
  const lines: string[] = [];
  for (const ex of latest.exercises) {
    lines.push(ex.name);
    const t = topSet(ex.sets);
    const w = t ? t.weight : 0;
    // Three blank set slots — one per typical working-set count. User
    // edits reps; the weight starts at the previous top.
    for (let i = 0; i < 3; i++) {
      lines.push(`${w} x `);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** True if this exercise's current session contains a PR (top weight OR e1RM). */
export function isPRSession(
  allSessions: LiftSession[],
  currentSessionDate: string,
  normalizedName: string,
  currentSets: LiftSet[]
): boolean {
  const pr = exercisePR(allSessions, normalizedName);
  if (!pr) return false;
  if (pr.topDate === currentSessionDate || pr.e1RMDate === currentSessionDate) {
    // The PR is on this session itself — verify it actually matches
    // (avoids false positives if PR data is from a different occurrence
    // of the same lift on the same date).
    const t = topSet(currentSets);
    if (!t) return false;
    if (t.weight === pr.topWeight && t.reps === pr.topReps) return true;
    const e = Math.round(estimated1RM(t.weight, t.reps) * 10) / 10;
    if (Math.abs(e - pr.e1RM) < 0.5) return true;
  }
  return false;
}
