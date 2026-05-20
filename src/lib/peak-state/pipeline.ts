/**
 * Compute pipeline: gather inputs from Neon → run the pure formula →
 * upsert the row in peak_state_logs. The only side effect is the
 * upsert; everything else is read-only.
 *
 * Idempotent — calling twice for the same (userId, date) ends with
 * the same row state (computed_at advances on each call).
 */

import { todayStr } from "@/lib/date";
import { upsertPeakState } from "@/lib/data/peak-state";
import { computePeakState } from "./compute";
import { gatherPeakStateInputs } from "./gather";

const STALE_AFTER_MS = 60 * 60 * 1000; // 1h

export async function recomputeForUser(
  userId: string,
  date: string = todayStr()
) {
  const inputs = await gatherPeakStateInputs(userId, date);
  const output = computePeakState(inputs);
  const row = await upsertPeakState(userId, date, {
    peakState: output.peakState,
    recovery: output.recovery,
    strain: output.strain,
    lifestyle: output.lifestyle,
    recommendation: output.recommendation,
    contributors: output.contributors,
    availableInputs: output.availableInputs,
  });
  return { row, output };
}

export function isStale(computedAt: Date | string | null | undefined): boolean {
  if (!computedAt) return true;
  const t =
    computedAt instanceof Date ? computedAt.getTime() : new Date(computedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > STALE_AFTER_MS;
}
