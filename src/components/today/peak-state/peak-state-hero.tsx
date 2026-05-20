"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { todayStr } from "@/lib/date";
import { useUserSettings } from "@/lib/hooks/use-settings";
import { usePeakState } from "@/lib/hooks/use-peak-state";
import { recommendationDetail } from "@/lib/peak-state/compute";
import { metricColors } from "@/lib/metric-colors";
import { haptic } from "@/lib/haptics";
import { ProgressRing } from "@/components/today/vitals/progress-ring";
import { RecommendationPill } from "./recommendation-pill";
import { PeakStateDetailModal } from "./peak-state-detail-modal";

const BASELINE_TARGET_DAYS = 14;

/**
 * Peak State hero card — top of the Today screen.
 *
 * Renders when:
 *   • the settings toggle hasn't disabled it (default: on)
 *   • the latest peak_state_logs row exists and has a non-null peakState
 *
 * Hidden entirely otherwise (Vitals tier becomes the top surface).
 */
export function PeakStateHero() {
  const today = todayStr();
  const { settings } = useUserSettings<{ showPeakState?: boolean }>();
  const showPeakState = settings.showPeakState !== false;

  const { row, refreshing } = usePeakState(today);
  const [detailOpen, setDetailOpen] = React.useState(false);

  if (!showPeakState) return null;
  if (!row || row.peakState == null) return null;

  const c = metricColors("peak");
  const score = row.peakState;
  const preliminary =
    row.availableInputs >= 4 && row.availableInputs < 7;
  const baselineSummary = (() => {
    if (!preliminary) return null;
    // We surface the smallest baseline that's still building so the
    // "X/14 days" reads as the limiting factor.
    const candidates: Array<{ key: string; days: number }> = [
      { key: "HRV", days: extractContribDays(row, "HRV") },
      { key: "RHR", days: extractContribDays(row, "Resting HR") },
    ].filter((c) => c.days < BASELINE_TARGET_DAYS);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.days - b.days);
    return `${candidates[0].key} baseline · ${candidates[0].days}/${BASELINE_TARGET_DAYS} days`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic("tap");
          setDetailOpen(true);
        }}
        className="vitals-tile card-hover w-full text-left relative overflow-hidden px-5 pt-5 pb-5"
        aria-label="Open Peak State detail"
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="label inline-flex items-center gap-1.5"
              style={{ color: "var(--color-fg-2)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: c.base }}
                aria-hidden
              />
              Peak State
            </div>
            {preliminary && baselineSummary && (
              <div className="mt-1 text-[10px] tracking-tight text-[var(--color-fg-3)]">
                Building baseline · {baselineSummary}
              </div>
            )}
          </div>
          <span
            aria-hidden
            className="h-7 w-7 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)] transition"
          >
            <Info size={14} />
          </span>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <ProgressRing
            progress={score / 100}
            size={140}
            stroke={10}
            color={c.base}
            ariaLabel={`Peak State ${score} out of 100`}
          >
            <div className="text-center">
              <div
                className="tnum font-bold leading-none text-[44px] sm:text-[60px]"
                style={{ color: c.base }}
              >
                {score}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-3)]">
                /100
              </div>
            </div>
          </ProgressRing>

          <div className="flex-1 min-w-0 space-y-2">
            {row.recommendation && (
              <RecommendationPill recommendation={row.recommendation as Parameters<typeof RecommendationPill>[0]["recommendation"]} />
            )}
            {row.recommendation && (
              <p className="text-[12px] leading-snug text-[var(--color-fg-2)]">
                {recommendationDetail(
                  row.recommendation as Parameters<typeof recommendationDetail>[0]
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
          <SubScore label="Recovery" value={row.recovery} />
          <SubScore label="Strain" value={row.strain} />
          <SubScore label="Lifestyle" value={row.lifestyle} />
        </div>

        {refreshing && (
          <span
            aria-hidden
            className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: c.base }}
          />
        )}
      </button>

      <PeakStateDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        rowDate={today}
      />
    </>
  );
}

function SubScore({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-2.5 py-1.5">
      <div className="label text-[9px]">{label}</div>
      <div className="mt-0.5 tnum text-[15px] font-semibold text-[var(--color-fg)]">
        {value != null ? value : "—"}
      </div>
    </div>
  );
}

/**
 * Pull the baseline-days count out of a contributor's detail string when
 * compute.ts hasn't surfaced baselineStatus on the row (it doesn't —
 * baselineStatus is computed at compute() time but not persisted).
 *
 * Heuristic only: if HRV/RHR are missing from contributors entirely,
 * they didn't have a 14-day baseline yet. We return 0 in that case so
 * the "X/14" reads correctly as building.
 */
function extractContribDays(
  row: { contributors?: unknown; availableInputs: number },
  label: string
): number {
  const list = (row.contributors as Array<{ label: string }> | undefined) ?? [];
  return list.some((c) => c.label === label) ? BASELINE_TARGET_DAYS : 0;
}
