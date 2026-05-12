import type {
  EveningRoutineItem,
  Goal,
  Habit,
  HealthLog,
  JournalEntry,
  MorningRoutineItem,
  DateStr,
} from "./types";

/** Common shape for morning + evening routine items. */
export type RoutineItemLike = {
  history: Record<DateStr, { completed: boolean; completedAt?: string }>;
};

type ScoreInputs = {
  goalsForDay: Goal[];
  habits: Habit[];
  routine: MorningRoutineItem[];
  /** Accepted but ignored — evening routine no longer counts. */
  evening?: EveningRoutineItem[];
  /** Accepted but ignored — health/sleep no longer counts. */
  health?: HealthLog;
  /** Accepted but ignored — journaling no longer counts. */
  journalsForDay?: JournalEntry[];
  date: DateStr;
};

/**
 * Compute a 0..1 score for a given day.
 *
 * Every checkbox is worth the same. A "checkbox" is one goal, one habit,
 * or one morning-routine item — counted as one slot in both the numerator
 * (when completed) and the denominator (always).
 *
 * Evening routine, journaled flag, and sleep-logged flag are intentionally
 * excluded — they aren't checkboxes the user actively ticks during the day.
 */
export function dayScore({
  goalsForDay,
  habits,
  routine,
  date,
}: ScoreInputs): number {
  let total = 0;
  let done = 0;

  total += goalsForDay.length;
  done += goalsForDay.filter((g) => g.completed).length;

  total += habits.length;
  done += habits.filter((h) => h.history[date]).length;

  total += routine.length;
  done += routine.filter((r) => r.history[date]?.completed).length;

  if (total === 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}

export function routineStreak(
  routine: RoutineItemLike[],
  today: DateStr
): number {
  if (!routine.length) return 0;
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    const allDone = routine.every((r) => r.history[key]?.completed);
    if (allDone) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      // allow today not-yet-done without breaking streak
      if (key === today && streak === 0) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

export function routineLongestStreak(
  routine: RoutineItemLike[]
): number {
  if (!routine.length) return 0;
  // collect all dates where ALL items completed
  const dateSet = new Set<string>();
  // start from any item's history keys
  const allDates = new Set<string>();
  for (const r of routine) {
    for (const k of Object.keys(r.history)) allDates.add(k);
  }
  for (const d of allDates) {
    if (routine.every((r) => r.history[d]?.completed)) dateSet.add(d);
  }
  const sorted = Array.from(dateSet).sort();
  if (!sorted.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const next = new Date(sorted[i]);
    const diff = Math.round(
      (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

export function streakForHabit(
  history: Record<DateStr, boolean>,
  today: DateStr
): number {
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (history[key]) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      // allow today not-yet-done without breaking streak
      if (key === today && streak === 0) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

export function longestStreak(history: Record<DateStr, boolean>): number {
  const keys = Object.keys(history).filter((k) => history[k]).sort();
  if (!keys.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const next = new Date(keys[i]);
    const diff = Math.round(
      (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}
