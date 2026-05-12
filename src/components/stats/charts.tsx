"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { format, fromDateStr, lastNDates } from "@/lib/date";
import { useStore } from "@/store";
import {
  useHabits,
  useHealthMap,
  useWorkoutsRaw,
} from "@/store/selectors";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { round1 } from "@/lib/utils";

const tickStyle = { fill: "var(--color-fg-3)", fontSize: 10 };
const gridStroke = "var(--color-stroke)";

/**
 * Recharts can't read CSS custom properties from SVG attributes — these
 * mirror the values in src/app/globals.css under the metric color system.
 * Keep them in sync.
 */
const CHART = {
  calories: "#F59E0B",
  protein: "#A78BFA",
  proteinLight: "#C4B5FD",
  carbs: "#38BDF8",
  fat: "#10B981",
  water: "#22D3EE",
  sleep: "#818CF8",
  sleepLight: "#A5B4FC",
  mood: "#10B981", // mood-high
  energyHigh: "#FB923C",
  energyBase: "#F59E0B",
  weight: "#94A3B8",
  steps: "#84CC16",
};

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-stroke-strong)] bg-[var(--color-card)] px-2.5 py-1.5 shadow-[var(--shadow-card)]">
      <div className="text-[10px] text-[var(--color-fg-3)]">{label}</div>
      {payload.map((p: any) => (
        <div
          key={p.dataKey}
          className="text-xs tnum"
          style={{ color: p.color || "var(--color-fg)" }}
        >
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function MoodEnergyChart({ days }: { days: number }) {
  const health = useHealthMap();
  const data = React.useMemo(
    () =>
      lastNDates(days).map((date) => ({
        date: format(fromDateStr(date), "M/d"),
        mood: health[date]?.mood ?? null,
        energy: health[date]?.energy ?? null,
      })),
    [days, health]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mood + Energy</CardTitle>
        <span className="text-xs text-[var(--color-fg-3)]">{days}d</span>
      </CardHeader>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 4" />
            <XAxis dataKey="date" tick={tickStyle} stroke={gridStroke} />
            <YAxis domain={[0, 10]} tick={tickStyle} stroke={gridStroke} width={20} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--color-stroke-strong)" }} />
            <Line
              type="monotone"
              dataKey="mood"
              name="Mood"
              stroke={CHART.mood}
              strokeWidth={2}
              dot={false}
              connectNulls
              animationDuration={420}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="energy"
              name="Energy"
              stroke={CHART.energyHigh}
              strokeWidth={2}
              dot={false}
              connectNulls
              animationDuration={420}
              animationBegin={120}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function SleepChart({ days }: { days: number }) {
  const health = useHealthMap();
  const series = React.useMemo(
    () =>
      lastNDates(days).map((date) => ({
        date: format(fromDateStr(date), "M/d"),
        hours: health[date]?.sleepHours ?? null,
      })),
    [days, health]
  );
  const avg = React.useMemo(() => {
    const valid = series.filter((s) => s.hours != null) as Array<{
      date: string;
      hours: number;
    }>;
    return valid.length
      ? round1(valid.reduce((acc, x) => acc + x.hours, 0) / valid.length)
      : null;
  }, [series]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep</CardTitle>
        <span className="text-xs text-[var(--color-fg-2)] tnum">
          {avg != null ? `avg ${avg}h` : "—"}
        </span>
      </CardHeader>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.sleep} stopOpacity={0.42} />
                <stop offset="100%" stopColor={CHART.sleep} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 4" />
            <XAxis dataKey="date" tick={tickStyle} stroke={gridStroke} />
            <YAxis domain={[0, 12]} tick={tickStyle} stroke={gridStroke} width={20} />
            <Tooltip content={<TooltipBox />} />
            <Area
              type="monotone"
              dataKey="hours"
              name="Sleep"
              stroke={CHART.sleep}
              fill="url(#sleepGrad)"
              strokeWidth={2}
              connectNulls
              animationDuration={420}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function WeightChart({ days }: { days: number }) {
  const unit = useStore((s) => s.settings.units.weight);
  const health = useHealthMap();

  const merged = React.useMemo(() => {
    const conv = (lb: number) => (unit === "kg" ? lb * 0.453592 : lb);
    const series = lastNDates(days).map((date) => ({
      date: format(fromDateStr(date), "M/d"),
      weight:
        health[date]?.weight != null ? round1(conv(health[date]!.weight!)) : null,
    }));
    const ma = series.map((_, i) => {
      const slice = series
        .slice(Math.max(0, i - 6), i + 1)
        .map((x) => x.weight)
        .filter((x): x is number => x != null);
      return slice.length
        ? round1(slice.reduce((a, b) => a + b, 0) / slice.length)
        : null;
    });
    return series.map((s, i) => ({ ...s, ma: ma[i] }));
  }, [days, health, unit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight ({unit})</CardTitle>
      </CardHeader>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 5, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 4" />
            <XAxis dataKey="date" tick={tickStyle} stroke={gridStroke} />
            <YAxis domain={["auto", "auto"]} tick={tickStyle} stroke={gridStroke} width={32} />
            <Tooltip content={<TooltipBox />} />
            <Line
              type="monotone"
              dataKey="weight"
              name="Weight"
              stroke={CHART.weight}
              strokeWidth={1.5}
              strokeOpacity={0.6}
              dot={false}
              connectNulls
              animationDuration={420}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="ma"
              name="7-day avg"
              stroke={CHART.weight}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              animationDuration={420}
              animationBegin={120}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const WORKOUT_COLORS: Record<string, string> = {
  Push: "#A78BFA",
  Pull: "#60A5FA",
  Legs: "#FBBF24",
  Cardio: "#34D399",
  Yoga: "#F472B6",
  Other: "#8E8E93",
};

export function WorkoutsDonut({ days }: { days: number }) {
  const workouts = useWorkoutsRaw();
  const data = React.useMemo(() => {
    const dates = new Set(lastNDates(days));
    const list = workouts.filter((w) => dates.has(w.date));
    const grouped: Record<string, number> = {};
    for (const w of list) {
      grouped[w.type] = (grouped[w.type] ?? 0) + 1;
    }
    return Object.entries(grouped).map(([type, count]) => ({ type, count }));
  }, [days, workouts]);
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workouts</CardTitle>
        <span className="text-xs text-[var(--color-fg-2)] tnum">
          {total} total
        </span>
      </CardHeader>
      <div className="h-44">
        {data.length === 0 ? (
          <div className="h-full grid place-items-center text-xs text-[var(--color-fg-3)]">
            No workouts in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="type"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.type}
                    fill={WORKOUT_COLORS[entry.type] ?? "#8E8E93"}
                  />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "var(--color-fg-2)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

export function HabitRatesBars({ days }: { days: number }) {
  const habits = useHabits();
  const data = React.useMemo(() => {
    const dates = lastNDates(days);
    return habits.map((h) => {
      const done = dates.filter((d) => h.history[d]).length;
      return {
        name: h.name,
        pct: Math.round((done / dates.length) * 100),
      };
    });
  }, [days, habits]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Habit rates · {days}d</CardTitle>
      </CardHeader>
      {data.length === 0 ? (
        <div className="text-xs text-[var(--color-fg-3)] text-center py-6">
          Add habits to track rates.
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 4" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={tickStyle}
                stroke={gridStroke}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={tickStyle}
                width={88}
                stroke={gridStroke}
              />
              <Tooltip content={<TooltipBox />} />
              <Bar
                dataKey="pct"
                fill={CHART.protein}
                radius={[0, 6, 6, 0]}
                animationDuration={420}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
