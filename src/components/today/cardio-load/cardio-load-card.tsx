"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  HeartPulse,
  Link2,
} from "lucide-react";
import { useStore } from "@/store";
import { metricColors } from "@/lib/metric-colors";
import { todayStr, shiftDate } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  CARDIO_STATUS_COLOR,
  CARDIO_STATUS_LABEL,
  CARDIO_STATUS_TOOLTIP,
  computeCardioStatus,
} from "@/lib/cardio-load";
import { CardioLoadDetailModal } from "./cardio-load-detail-modal";

/**
 * Weekly Cardio Load card on the Today screen. Sits below the Vitals
 * tier. Mon–Sun bucketing, 4-week rolling baseline.
 */
export function CardioLoadCard() {
  const connected = useStore((s) => s.googleHealth.connected);
  const health = useStore((s) => s.health);
  const [open, setOpen] = React.useState(false);

  // Build a flat 12-week history of daily values, oldest → newest. Each
  // entry is { date, value }. We bucket into weeks later.
  const dailySeries = React.useMemo(() => {
    const today = todayStr();
    // Walk back from this Sunday so weeks line up Mon–Sun.
    const todaysWeekStart = mondayOf(today);
    // 12 weeks of history plus the current week = 13 weeks back from
    // the current Monday. Build the daily series oldest first.
    const startDate = shiftDate(todaysWeekStart, -12 * 7);
    const out: Array<{ date: string; value: number }> = [];
    const totalDays = 13 * 7;
    for (let i = 0; i < totalDays; i += 1) {
      const d = shiftDate(startDate, i);
      if (d > today) break;
      out.push({ date: d, value: health[d]?.cardioLoad ?? 0 });
    }
    return out;
  }, [health]);

  // Bucket into weeks (oldest first). Last entry = current (in-progress) week.
  const weeks = React.useMemo(() => {
    const today = todayStr();
    const currentMon = mondayOf(today);
    const out: Array<{ weekStart: string; daily: number[]; total: number }> = [];
    // Iterate over each Monday from oldest to newest in dailySeries.
    if (dailySeries.length === 0) return out;
    let weekStart = dailySeries[0].date;
    // Snap weekStart to its Monday in case the series starts mid-week.
    weekStart = mondayOf(weekStart);
    while (weekStart <= currentMon) {
      const daily: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        const d = shiftDate(weekStart, i);
        const entry = dailySeries.find((x) => x.date === d);
        daily.push(entry?.value ?? 0);
      }
      const total = daily.reduce((a, b) => a + b, 0);
      out.push({ weekStart, daily, total });
      weekStart = shiftDate(weekStart, 7);
    }
    return out;
  }, [dailySeries]);

  const currentWeek = weeks[weeks.length - 1];
  const priorWeeks = weeks.slice(0, -1).map((w) => w.total);
  const status = React.useMemo(
    () => computeCardioStatus(currentWeek?.total ?? 0, priorWeeks),
    [currentWeek?.total, priorWeeks]
  );

  // % vs last week (the immediately preceding completed week).
  const lastWeekTotal = priorWeeks.length > 0 ? priorWeeks[priorWeeks.length - 1] : null;
  const percentChange =
    lastWeekTotal != null && lastWeekTotal > 0 && currentWeek
      ? Math.round(((currentWeek.total - lastWeekTotal) / lastWeekTotal) * 100)
      : null;

  const c = metricColors("cardio");
  const empty = !currentWeek || currentWeek.total <= 0;
  const dailyMax = currentWeek
    ? Math.max(1, ...currentWeek.daily, lastWeekTotal ?? 0)
    : 1;
  // For empty state, hide percent (we'd be dividing by zero anyway).

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!connected && empty) return; // no detail to show when fully empty
          haptic("tap");
          setOpen(true);
        }}
        className={cn(
          "card-hover card p-5 text-left w-full block",
          empty && !connected && "cursor-default active:scale-100"
        )}
        style={
          !empty
            ? {
                borderColor: `color-mix(in srgb, ${c.base} 22%, var(--color-stroke))`,
              }
            : undefined
        }
        aria-label="Weekly Cardio Load detail"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label inline-flex items-center gap-1.5">
              <HeartPulse
                size={11}
                style={{ color: empty ? "var(--color-fg-3)" : c.base }}
              />
              Weekly Cardio Load
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="tnum font-bold leading-none text-[44px] sm:text-[52px]"
                style={{ color: empty ? "var(--color-fg-3)" : c.base }}
              >
                {empty ? "—" : Math.round(currentWeek!.total).toLocaleString()}
              </span>
            </div>
            <div className="mt-2 inline-flex items-center gap-2 min-h-[22px]">
              <StatusPill status={status.status} />
            </div>
          </div>
          {percentChange != null && (
            <div className="shrink-0 text-right">
              <DeltaArrow percent={percentChange} />
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-3)]">
                vs last week
              </div>
            </div>
          )}
        </div>

        {/* 7-day stacked bar (Mon → Sun, this week) */}
        {currentWeek && (
          <div className="mt-4 space-y-1.5">
            <div className="flex h-2 gap-0.5 rounded-full overflow-hidden">
              {currentWeek.daily.map((v, i) => {
                const isToday = isDateToday(shiftDate(currentWeek.weekStart, i));
                const pct = (v / dailyMax) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 flex items-end h-2 rounded-sm overflow-hidden"
                    style={{
                      background: "color-mix(in srgb, var(--color-stroke) 60%, transparent)",
                    }}
                    aria-label={`${DAY_LABELS[i]}: ${Math.round(v)}`}
                  >
                    <div
                      className="w-full"
                      style={{
                        height: `${Math.max(0, Math.min(100, pct))}%`,
                        background: isToday ? c.base : c.light,
                        opacity: v > 0 ? 1 : 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-[var(--color-fg-3)] tabular-nums">
              {DAY_LABELS.map((l, i) => (
                <span
                  key={l}
                  className={cn(
                    "flex-1 text-center",
                    isDateToday(shiftDate(currentWeek.weekStart, i)) &&
                      "text-[var(--color-fg-2)] font-semibold"
                  )}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {empty && !connected && (
          <div className="mt-4">
            <Link
              href="/settings#google-health"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]"
              style={{ color: c.base }}
            >
              <Link2 size={11} />
              Connect Google Health
            </Link>
          </div>
        )}
      </button>

      {open && currentWeek && (
        <CardioLoadDetailModal
          weeks={weeks}
          status={status}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function isDateToday(d: string): boolean {
  return d === todayStr();
}

/**
 * Returns the Monday (YYYY-MM-DD) of the ISO week containing `date`.
 * No external date-fns dep — keeps this card cheap.
 */
function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=Sun..6=Sat
  // Shift so Monday=0, Sunday=6.
  const shift = (day + 6) % 7;
  dt.setDate(dt.getDate() - shift);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function StatusPill({
  status,
}: {
  status: keyof typeof CARDIO_STATUS_COLOR;
}) {
  const color = CARDIO_STATUS_COLOR[status];
  const label = CARDIO_STATUS_LABEL[status];
  return (
    <span
      title={CARDIO_STATUS_TOOLTIP[status]}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] tracking-tight"
      style={{
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function DeltaArrow({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-fg-3)] tnum">
        <ArrowRight size={12} />
        0%
      </span>
    );
  }
  const up = percent > 0;
  const color = up ? "var(--color-fg-2)" : "var(--color-fg-2)";
  const Icon = up ? ArrowUp : ArrowDown;
  const sign = up ? "+" : "−";
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] tnum"
      style={{ color }}
    >
      <Icon size={12} />
      {sign}
      {Math.abs(percent)}%
    </span>
  );
}
