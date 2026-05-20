"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
  Scatter,
} from "recharts";
import { Plus, Check } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useStore } from "@/store";
import { setWeight, useWeight, useWeightRange } from "@/lib/hooks/use-metrics";
import { metricHex, metricColors } from "@/lib/metric-colors";
import { format, fromDateStr, shiftDate, todayStr } from "@/lib/date";
import { round1 } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

const WINDOW_DAYS = 90;
const ROLLING_DAYS = 7;
const LB_PER_KG = 2.2046226218;

/**
 * Daily weight tracking — entry + trend chart + stats. The 7-day
 * rolling average is the headline; raw daily points are subtle so
 * the user reads through the noise that comes from water/food/etc.
 *
 * Reads from /api/data/metrics/weight (per-day singletons in Neon).
 * Display unit follows the existing weight setting (lb/kg).
 */
export function DailyWeightCard() {
  const today = todayStr();
  const start = React.useMemo(() => shiftDate(today, -(WINDOW_DAYS - 1)), [today]);
  const unit = useStore((s) => s.settings.units.weight);

  const { weight: todayWeight, isLoading: todayLoading } = useWeight(today);
  const { data: rangeData, isLoading: rangeLoading } = useWeightRange(start, today);

  const [entryOpen, setEntryOpen] = React.useState(false);

  const series = React.useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of rangeData ?? []) byDate.set(r.date, r.lb);
    // Build a contiguous 90-day series so the rolling average has the
    // right denominator (and missing days don't compress the x-axis).
    const out: Array<{ date: string; lb: number | null; avg: number | null }> =
      [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
      const d = shiftDate(today, -i);
      out.push({ date: d, lb: byDate.get(d) ?? null, avg: null });
    }
    // 7-day trailing rolling average (inclusive); skip when fewer than
    // 3 readings in the window to avoid noisy spikes at series start.
    for (let i = 0; i < out.length; i += 1) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - (ROLLING_DAYS - 1)); j <= i; j += 1) {
        const v = out[j].lb;
        if (v != null) {
          sum += v;
          n += 1;
        }
      }
      out[i].avg = n >= 3 ? sum / n : null;
    }
    return out;
  }, [rangeData, today]);

  const stats = React.useMemo(() => {
    const points = series
      .filter((p): p is { date: string; lb: number; avg: number | null } => p.lb != null);
    if (points.length === 0) {
      return { current: null, avg7: null, avg30: null, delta30: null };
    }
    const current = points[points.length - 1].lb;
    const since = (n: number) => {
      const cutoff = shiftDate(today, -(n - 1));
      const sub = points.filter((p) => p.date >= cutoff);
      if (sub.length === 0) return null;
      return sub.reduce((a, b) => a + b.lb, 0) / sub.length;
    };
    const avg7 = since(7);
    const avg30 = since(30);
    // 30-day delta = current vs the first reading ≥30 days ago.
    const oldestCutoff = shiftDate(today, -29);
    const oldest = points.find((p) => p.date <= oldestCutoff);
    const delta30 =
      oldest != null
        ? current - oldest.lb
        : points.length >= 2
          ? current - points[0].lb
          : null;
    return { current, avg7, avg30, delta30 };
  }, [series, today]);

  const c = metricColors("weight");
  const lineColor = metricHex("weight", "light");
  const dotColor = "color-mix(in srgb, var(--mc-weight) 60%, transparent)";

  const fmt = React.useCallback(
    (lb: number | null) => {
      if (lb == null) return "—";
      return unit === "kg" ? `${round1(lb / LB_PER_KG)}` : `${round1(lb)}`;
    },
    [unit]
  );
  const fmtWithUnit = React.useCallback(
    (lb: number | null) => (lb == null ? "—" : `${fmt(lb)} ${unit}`),
    [fmt, unit]
  );

  const isLoading = todayLoading || rangeLoading;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: c.base }}
              />
              Weight
            </span>
          </CardTitle>
          <Button
            size="sm"
            variant={todayWeight ? "secondary" : "primary"}
            onClick={() => {
              haptic("tap");
              setEntryOpen(true);
            }}
          >
            {todayWeight ? <Check size={13} /> : <Plus size={13} />}
            {todayWeight ? "Logged" : "Log today"}
          </Button>
        </CardHeader>

        {/* Hero row: today + delta */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label text-[10px]">Today</div>
            <div
              className="mt-1 tnum font-bold leading-none text-[40px] sm:text-[48px]"
              style={{ color: todayWeight ? c.base : "var(--color-fg-3)" }}
            >
              {fmt(todayWeight?.lb ?? null)}
              <span className="ml-1 text-[14px] font-medium text-[var(--color-fg-3)]">
                {unit}
              </span>
            </div>
          </div>
          {stats.delta30 != null && stats.current != null && (
            <Delta30 deltaLb={stats.delta30} unit={unit} />
          )}
        </div>

        {/* Trend chart */}
        <div className="mt-4 h-[140px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series.map((p) => ({
                date: p.date,
                lb: p.lb,
                avg: p.avg,
                disp: p.lb != null ? (unit === "kg" ? p.lb / LB_PER_KG : p.lb) : null,
                dispAvg:
                  p.avg != null ? (unit === "kg" ? p.avg / LB_PER_KG : p.avg) : null,
              }))}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(fromDateStr(d), "M/d")}
                tick={{ fill: "var(--color-fg-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-stroke-strong)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-stroke-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-fg)",
                }}
                labelFormatter={(d) =>
                  typeof d === "string" ? format(fromDateStr(d), "EEE M/d") : String(d)
                }
                formatter={(v, name) => {
                  if (v == null || typeof v !== "number") return ["—", String(name)];
                  const label = name === "dispAvg" ? "7-day avg" : "Logged";
                  return [`${round1(v)} ${unit}`, label];
                }}
              />
              {/* Subtle raw daily points — render as small scatter so they
                  read as data, not noise, but defer visual weight to the
                  smoothed line. */}
              <Scatter dataKey="disp" fill={dotColor} />
              {/* Faint area under the rolling average, then the line on top. */}
              <Area
                type="monotone"
                dataKey="dispAvg"
                stroke="none"
                fill="url(#weightArea)"
                connectNulls
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="dispAvg"
                stroke={lineColor}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="7-day avg" value={fmtWithUnit(stats.avg7)} />
          <Stat label="30-day avg" value={fmtWithUnit(stats.avg30)} />
          <Stat
            label="Δ 30 days"
            value={
              stats.delta30 == null
                ? "—"
                : `${stats.delta30 >= 0 ? "+" : "−"}${fmt(Math.abs(stats.delta30))} ${unit}`
            }
          />
        </div>

        {!isLoading && stats.current == null && (
          <p className="mt-3 text-[12px] text-[var(--color-fg-3)]">
            Log today to start the trend.
          </p>
        )}
      </Card>

      <DailyWeightEntryModal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        currentLb={todayWeight?.lb ?? null}
        unit={unit}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2">
      <div className="label text-[9px]">{label}</div>
      <div className="mt-0.5 tnum text-[14px] font-semibold text-[var(--color-fg)]">
        {value}
      </div>
    </div>
  );
}

function Delta30({ deltaLb, unit }: { deltaLb: number; unit: "lb" | "kg" }) {
  const displayed = unit === "kg" ? deltaLb / LB_PER_KG : deltaLb;
  const zero = Math.abs(displayed) < 0.05;
  const positive = displayed > 0;
  const color = zero
    ? "var(--color-fg-3)"
    : positive
      ? "var(--color-warning)"
      : "var(--color-success)";
  const sign = zero ? "±" : positive ? "+" : "−";
  return (
    <div className="text-right">
      <div className="label text-[10px]">vs 30d ago</div>
      <div
        className="mt-1 tnum text-[18px] font-semibold"
        style={{ color }}
      >
        {sign}
        {round1(Math.abs(displayed))} {unit}
      </div>
    </div>
  );
}

function DailyWeightEntryModal({
  open,
  onClose,
  currentLb,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  currentLb: number | null;
  unit: "lb" | "kg";
}) {
  const initialDisplay =
    currentLb != null
      ? round1(unit === "kg" ? currentLb / LB_PER_KG : currentLb)
      : null;
  const [val, setVal] = React.useState(
    initialDisplay != null && initialDisplay > 0 ? String(initialDisplay) : ""
  );

  React.useEffect(() => {
    if (open) {
      const v =
        currentLb != null
          ? round1(unit === "kg" ? currentLb / LB_PER_KG : currentLb)
          : null;
      setVal(v != null && v > 0 ? String(v) : "");
    }
  }, [open, currentLb, unit]);

  const save = () => {
    const numeric = parseFloat(val);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      onClose();
      return;
    }
    const lbs = unit === "kg" ? numeric * LB_PER_KG : numeric;
    void setWeight(todayStr(), lbs);
    haptic("success");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log today's weight"
      description={`Stored in ${unit === "kg" ? "kilograms" : "pounds"}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!val.trim()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex items-end gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="0"
          className="control no-zoom flex-1 h-16 text-4xl font-bold tnum text-center px-3 outline-none accent-ring"
        />
        <div className="h-16 px-4 grid place-items-center rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] text-[var(--color-fg-2)] text-sm font-medium">
          {unit}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-fg-3)] text-center">
        Try to weigh in at the same time each day — first thing in the morning is the most consistent.
      </p>
    </Modal>
  );
}
