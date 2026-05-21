"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownUp, BarChart3, Dumbbell, Flame, LineChart as LineChartIcon, Search } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { metricHex } from "@/lib/metric-colors";
import { estimated1RM } from "@/lib/repcount";
import { fromDateStr, format, shiftDate } from "@/lib/date";
import { useStore } from "@/store";
import type { LiftSession } from "@/lib/types";
import { categoryToMuscleGroup, type MuscleGroup } from "@/lib/exercise-library";

/**
 * Gym Insights — six chart sections driven entirely by liftSessions
 * (post-RepCount import). The whole card hides itself when there's
 * not enough data, so a brand-new user doesn't see an empty shell.
 */
export function GymInsightsSection() {
  const liftSessions = useStore((s) => s.liftSessions);
  const customCatalog = useStore((s) => s.customExerciseCatalog);

  // Hide entirely when there's not enough data to make any chart useful.
  if (liftSessions.length < 3) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights</CardTitle>
        <span className="text-xs text-[var(--color-fg-3)] tnum">
          {liftSessions.length.toLocaleString()} sessions
        </span>
      </CardHeader>
      <div className="space-y-6">
        <VolumeOverTime sessions={liftSessions} />
        <PerExerciseProgression sessions={liftSessions} />
        <MuscleBalance sessions={liftSessions} catalog={customCatalog} />
        <TrainingFrequency sessions={liftSessions} />
        <PrTable sessions={liftSessions} />
        <TopExercises sessions={liftSessions} />
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Shared helpers
 * ──────────────────────────────────────────────────────────────────── */

function sessionVolume(s: LiftSession): number {
  let v = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.weight > 0 && set.reps > 0) v += set.weight * set.reps;
    }
  }
  return v;
}

function totalSets(s: LiftSession): number {
  let n = 0;
  for (const ex of s.exercises) n += ex.sets.length;
  return n;
}

/** Mon-anchored ISO week start for a YYYY-MM-DD date. */
function mondayOf(date: string): string {
  const d = fromDateStr(date);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return shiftDate(date, offset);
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Short axis label so 375px doesn't blow up. */
function formatWeekShort(iso: string): string {
  const d = fromDateStr(iso);
  return format(d, "MMM d");
}
function formatMonthShort(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10)]} '${y.slice(2)}`;
}

/* ─────────────────────────────────────────────────────────────────────
 * 1. Volume over time
 * ──────────────────────────────────────────────────────────────────── */

type VolumeBucket = "week" | "month";

function VolumeOverTime({ sessions }: { sessions: LiftSession[] }) {
  const [bucket, setBucket] = React.useState<VolumeBucket>("week");
  const color = metricHex("cardio");

  const data = React.useMemo(() => {
    const byBucket = new Map<string, number>();
    for (const s of sessions) {
      const key = bucket === "week" ? mondayOf(s.date) : monthOf(s.date);
      byBucket.set(key, (byBucket.get(key) ?? 0) + sessionVolume(s));
    }
    const out = Array.from(byBucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ key: k, volume: Math.round(v) }));
    // Trim to the last 52 weeks / 24 months to keep the chart readable
    // on mobile without horizontal overflow.
    const cap = bucket === "week" ? 52 : 24;
    return out.length > cap ? out.slice(-cap) : out;
  }, [sessions, bucket]);

  const maxVolume = data.reduce((m, d) => (d.volume > m ? d.volume : m), 0);

  return (
    <Section
      icon={<LineChartIcon size={12} />}
      title="Volume over time"
      right={
        <Segmented<VolumeBucket>
          value={bucket}
          onChange={setBucket}
          options={[
            { value: "week", label: "Wk" },
            { value: "month", label: "Mo" },
          ]}
          size="sm"
        />
      }
    >
      {data.length === 0 ? (
        <EmptyChart message="No volume yet." />
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vol-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-stroke)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="key"
                tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                tickFormatter={bucket === "week" ? formatWeekShort : formatMonthShort}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                domain={[0, maxVolume]}
                tickFormatter={(v) => abbreviateNumber(v)}
                width={32}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => {
                  const k = String(label ?? "");
                  return bucket === "week"
                    ? `Week of ${formatWeekShort(k)}`
                    : formatMonthShort(k);
                }}
                formatter={(value) => {
                  const n = Number(value);
                  return [`${n.toLocaleString()} lb`, "Volume"];
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke={color}
                strokeWidth={1.8}
                fill="url(#vol-grad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 2. Per-exercise progression
 * ──────────────────────────────────────────────────────────────────── */

function PerExerciseProgression({ sessions }: { sessions: LiftSession[] }) {
  const exercises = React.useMemo(() => {
    const seen = new Map<string, { name: string; setCount: number; lastDate: string }>();
    for (const s of sessions) {
      for (const ex of s.exercises) {
        const cur = seen.get(ex.normalizedName);
        if (cur) {
          cur.setCount += ex.sets.length;
          if (s.date > cur.lastDate) cur.lastDate = s.date;
        } else {
          seen.set(ex.normalizedName, {
            name: ex.name,
            setCount: ex.sets.length,
            lastDate: s.date,
          });
        }
      }
    }
    return Array.from(seen.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.setCount - a.setCount);
  }, [sessions]);

  // Default to the most-trained exercise.
  const [selected, setSelected] = React.useState<string>(() =>
    exercises[0]?.key ?? ""
  );
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises.slice(0, 30);
    return exercises.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 30);
  }, [exercises, query]);

  const points = React.useMemo(() => {
    if (!selected) return [];
    const series: Array<{ date: string; topWeight: number; e1rm: number }> = [];
    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.normalizedName === selected);
      if (!ex) continue;
      let topWeight = 0;
      let topReps = 0;
      for (const set of ex.sets) {
        if (set.weight > 0 && set.reps > 0 && set.weight > topWeight) {
          topWeight = set.weight;
          topReps = set.reps;
        }
      }
      if (topWeight === 0) continue;
      series.push({
        date: s.date,
        topWeight,
        e1rm: Math.round(estimated1RM(topWeight, topReps)),
      });
    }
    return series.sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, selected]);

  const selectedName =
    exercises.find((e) => e.key === selected)?.name ?? "—";
  const colorTop = metricHex("steps");
  const colorE1rm = metricHex("peak");

  return (
    <Section icon={<Dumbbell size={12} />} title="Per-exercise progression">
      <div className="space-y-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-3)] pointer-events-none"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="pl-7"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto nice-scroll">
          {filtered.map((ex) => (
            <button
              key={ex.key}
              type="button"
              onClick={() => setSelected(ex.key)}
              className={
                "h-7 px-2.5 rounded-full text-[11px] border transition shrink-0 " +
                (ex.key === selected
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color:color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
                  : "bg-[var(--color-elevated)] text-[var(--color-fg-2)] border-[var(--color-stroke)] hover:text-[var(--color-fg)]")
              }
            >
              <span className="truncate max-w-[180px] inline-block align-bottom">
                {ex.name}
              </span>
              <span className="text-[10px] text-[var(--color-fg-3)] ml-1 tnum">
                {ex.setCount}
              </span>
            </button>
          ))}
        </div>

        {points.length === 0 ? (
          <EmptyChart message={`No weighted sets logged for ${selectedName}.`} />
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-stroke)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                  tickFormatter={(d: string) => format(fromDateStr(d), "MMM yy")}
                  interval="preserveStartEnd"
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                  width={32}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) =>
                    format(fromDateStr(String(label ?? "")), "MMM d, yyyy")
                  }
                  formatter={(value, name) => {
                    const n = Number(value);
                    return [
                      `${n} lb`,
                      name === "topWeight" ? "Top set" : "Est. 1RM",
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="topWeight"
                  name="topWeight"
                  stroke={colorTop}
                  strokeWidth={1.6}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="e1rm"
                  name="e1rm"
                  stroke={colorE1rm}
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {points.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-fg-3)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: colorTop }} />
              Top set
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-[2px] w-3 rounded-sm"
                style={{ background: colorE1rm }}
              />
              Est. 1RM (Epley)
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 3. Muscle balance
 * ──────────────────────────────────────────────────────────────────── */

type BalanceWindow = "30" | "90" | "all";
type BalanceMode = "sets" | "volume";

function MuscleBalance({
  sessions,
  catalog,
}: {
  sessions: LiftSession[];
  catalog: Record<string, { category: string }>;
}) {
  const [window, setWindow] = React.useState<BalanceWindow>("90");
  const [mode, setMode] = React.useState<BalanceMode>("sets");

  const cutoff = React.useMemo(() => {
    if (window === "all") return "0000-00-00";
    const days = window === "30" ? 30 : 90;
    return shiftDate(format(new Date(), "yyyy-MM-dd"), -days);
  }, [window]);

  const data = React.useMemo(() => {
    const tally = new Map<MuscleGroup, number>();
    for (const s of sessions) {
      if (s.date < cutoff) continue;
      for (const ex of s.exercises) {
        const cat = catalog[ex.normalizedName]?.category ?? "Other";
        const group = categoryToMuscleGroup(cat);
        if (mode === "sets") {
          tally.set(group, (tally.get(group) ?? 0) + ex.sets.length);
        } else {
          let v = 0;
          for (const set of ex.sets) {
            if (set.weight > 0 && set.reps > 0) v += set.weight * set.reps;
          }
          tally.set(group, (tally.get(group) ?? 0) + v);
        }
      }
    }
    return Array.from(tally.entries())
      .map(([group, value]) => ({ group, value: Math.round(value) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sessions, catalog, cutoff, mode]);

  const color = metricHex("protein");
  return (
    <Section
      icon={<BarChart3 size={12} />}
      title="Muscle group balance"
      right={
        <Segmented<BalanceWindow>
          value={window}
          onChange={setWindow}
          options={[
            { value: "30", label: "30d" },
            { value: "90", label: "90d" },
            { value: "all", label: "All" },
          ]}
          size="sm"
        />
      }
    >
      <div className="flex items-center justify-end mb-2">
        <Segmented<BalanceMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "sets", label: "Sets" },
            { value: "volume", label: "Vol" },
          ]}
          size="sm"
        />
      </div>
      {data.length === 0 ? (
        <EmptyChart message="No sessions in this window." />
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--color-stroke)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                tickFormatter={(v: number) =>
                  mode === "volume" ? abbreviateNumber(v) : v.toString()
                }
              />
              <YAxis
                dataKey="group"
                type="category"
                tick={{ fontSize: 10, fill: "var(--color-fg-2)" }}
                width={68}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => {
                  const n = Number(value);
                  return [
                    mode === "volume"
                      ? `${n.toLocaleString()} lb`
                      : `${n.toLocaleString()} sets`,
                    mode === "volume" ? "Volume" : "Sets",
                  ];
                }}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 4. Training frequency
 * ──────────────────────────────────────────────────────────────────── */

function TrainingFrequency({ sessions }: { sessions: LiftSession[] }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const sessionDates = React.useMemo(() => {
    const s = new Set<string>();
    for (const session of sessions) s.add(session.date);
    return s;
  }, [sessions]);

  // 26-week heatmap (about 6 months), Mon-anchored columns.
  const WEEKS = 26;
  const heatmap = React.useMemo(() => {
    const cols: Array<{ weekStart: string; days: Array<{ date: string; trained: boolean }> }> = [];
    const todayMon = mondayOf(today);
    for (let w = WEEKS - 1; w >= 0; w--) {
      const weekStart = shiftDate(todayMon, -7 * w);
      const days: Array<{ date: string; trained: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        const date = shiftDate(weekStart, d);
        days.push({ date, trained: date <= today && sessionDates.has(date) });
      }
      cols.push({ weekStart, days });
    }
    return cols;
  }, [sessionDates, today]);

  // Sessions per week, last 26 weeks.
  const perWeek = React.useMemo(
    () =>
      heatmap.map((col) => ({
        weekStart: col.weekStart,
        count: col.days.filter((d) => d.trained).length,
      })),
    [heatmap]
  );

  const color = metricHex("steps");

  return (
    <Section icon={<Flame size={12} />} title="Training frequency">
      <div className="space-y-3">
        <div className="overflow-x-auto hide-scroll -mx-1 px-1" style={{ touchAction: "pan-x" }}>
          <div className="inline-flex gap-[3px]">
            {heatmap.map((col) => (
              <div key={col.weekStart} className="flex flex-col gap-[3px]">
                {col.days.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}${d.trained ? " · trained" : ""}`}
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{
                      background: d.trained
                        ? color
                        : "var(--color-elevated)",
                      opacity: d.trained ? 1 : 0.55,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={perWeek}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--color-stroke)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="weekStart"
                tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                tickFormatter={formatWeekShort}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--color-fg-3)" }}
                allowDecimals={false}
                width={20}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) =>
                  `Week of ${formatWeekShort(String(label ?? ""))}`
                }
                formatter={(value) => {
                  const n = Number(value);
                  return [
                    `${n} session${n === 1 ? "" : "s"}`,
                    "Sessions",
                  ];
                }}
              />
              <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 5. PR table
 * ──────────────────────────────────────────────────────────────────── */

type PrRow = {
  name: string;
  best1rm: number;
  weight: number;
  reps: number;
  date: string;
};

type PrSort = "best" | "alpha" | "recent";

function PrTable({ sessions }: { sessions: LiftSession[] }) {
  const [sort, setSort] = React.useState<PrSort>("best");

  const rows = React.useMemo<PrRow[]>(() => {
    const byKey = new Map<string, PrRow>();
    for (const s of sessions) {
      for (const ex of s.exercises) {
        for (const set of ex.sets) {
          if (set.weight <= 0 || set.reps <= 0) continue;
          const e1rm = estimated1RM(set.weight, set.reps);
          const cur = byKey.get(ex.normalizedName);
          if (!cur || e1rm > cur.best1rm) {
            byKey.set(ex.normalizedName, {
              name: ex.name,
              best1rm: e1rm,
              weight: set.weight,
              reps: set.reps,
              date: s.date,
            });
          }
        }
      }
    }
    const out = Array.from(byKey.values());
    if (sort === "best") out.sort((a, b) => b.best1rm - a.best1rm);
    else if (sort === "alpha") out.sort((a, b) => a.name.localeCompare(b.name));
    else out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }, [sessions, sort]);

  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? rows : rows.slice(0, 15);

  return (
    <Section
      icon={<ArrowDownUp size={12} />}
      title="Personal records"
      right={
        <Segmented<PrSort>
          value={sort}
          onChange={setSort}
          options={[
            { value: "best", label: "Best" },
            { value: "alpha", label: "A-Z" },
            { value: "recent", label: "New" },
          ]}
          size="sm"
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyChart message="No PR data yet." />
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-stroke)]">
            {visible.map((r) => (
              <li
                key={r.name}
                className="py-2 flex items-center gap-3 text-[12.5px]"
              >
                <span className="flex-1 min-w-0 truncate text-[var(--color-fg)]">
                  {r.name}
                </span>
                <span className="tnum text-[var(--color-fg-2)] shrink-0">
                  {r.weight}×{r.reps}
                </span>
                <span className="tnum font-semibold text-[var(--color-accent)] shrink-0 w-14 text-right">
                  {Math.round(r.best1rm)}
                </span>
                <span className="text-[10px] text-[var(--color-fg-3)] shrink-0 w-16 text-right tnum">
                  {format(fromDateStr(r.date), "MMM yy")}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 15 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full text-[11px] text-[var(--color-accent)] py-1.5 rounded-lg hover:bg-[var(--color-elevated)]"
            >
              {showAll
                ? "Show top 15"
                : `Show all ${rows.length.toLocaleString()}`}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * 6. Top exercises
 * ──────────────────────────────────────────────────────────────────── */

type TopMode = "sets" | "volume";

function TopExercises({ sessions }: { sessions: LiftSession[] }) {
  const [mode, setMode] = React.useState<TopMode>("sets");

  const rows = React.useMemo(() => {
    const tally = new Map<string, { name: string; sets: number; volume: number }>();
    for (const s of sessions) {
      for (const ex of s.exercises) {
        let v = 0;
        for (const set of ex.sets) {
          if (set.weight > 0 && set.reps > 0) v += set.weight * set.reps;
        }
        const cur = tally.get(ex.normalizedName);
        if (cur) {
          cur.sets += ex.sets.length;
          cur.volume += v;
        } else {
          tally.set(ex.normalizedName, {
            name: ex.name,
            sets: ex.sets.length,
            volume: v,
          });
        }
      }
    }
    const list = Array.from(tally.values());
    list.sort((a, b) =>
      mode === "sets" ? b.sets - a.sets : b.volume - a.volume
    );
    return list.slice(0, 15);
  }, [sessions, mode]);

  const maxVal = rows.length
    ? mode === "sets"
      ? rows[0].sets
      : rows[0].volume
    : 0;
  const color = metricHex("calories");

  return (
    <Section
      icon={<Dumbbell size={12} />}
      title="Top exercises"
      right={
        <Segmented<TopMode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "sets", label: "Sets" },
            { value: "volume", label: "Vol" },
          ]}
          size="sm"
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyChart message="No exercises tracked yet." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const val = mode === "sets" ? r.sets : r.volume;
            const pct = maxVal ? Math.max(0.04, val / maxVal) : 0;
            return (
              <li key={r.name} className="text-[12px]">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="flex-1 min-w-0 truncate text-[var(--color-fg)]">
                    {r.name}
                  </span>
                  <span className="tnum text-[var(--color-fg-2)] text-[11px] shrink-0">
                    {mode === "volume"
                      ? `${abbreviateNumber(val)} lb`
                      : `${val.toLocaleString()}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${pct * 100}%`,
                      background: color,
                      transitionDuration: "320ms",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Section + chart helpers
 * ──────────────────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--color-fg-3)]">{icon}</span>
        <h3 className="label flex-1">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-24 grid place-items-center text-xs text-[var(--color-fg-3)] rounded-lg border border-dashed border-[var(--color-stroke)]">
      {message}
    </div>
  );
}

function abbreviateNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-stroke-strong)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--color-fg)",
  padding: "6px 8px",
};
