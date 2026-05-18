"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Modal } from "@/components/ui/modal";
import { metricHex } from "@/lib/metric-colors";
import { format, fromDateStr } from "@/lib/date";
import {
  CARDIO_STATUS_COLOR,
  CARDIO_STATUS_LABEL,
  CardioStatusResult,
} from "@/lib/cardio-load";

type WeekBucket = { weekStart: string; daily: number[]; total: number };

/**
 * 12-week trend chart + explanation of what Cardio Load means.
 */
export function CardioLoadDetailModal({
  weeks,
  status,
  onClose,
}: {
  weeks: WeekBucket[];
  status: CardioStatusResult;
  onClose: () => void;
}) {
  const color = metricHex("cardio");

  // Render the 12 most recent weeks INCLUDING the current week.
  const chartData = React.useMemo(() => {
    return weeks
      .slice(-12)
      .map((w, i, arr) => ({
        weekStart: w.weekStart,
        label: format(fromDateStr(w.weekStart), "MMM d"),
        total: Math.round(w.total),
        isCurrent: i === arr.length - 1,
      }));
  }, [weeks]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Weekly Cardio Load"
      description="12-week trend"
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="This week"
            value={Math.round(status.weekTotal).toLocaleString()}
            color={color}
          />
          <Stat
            label="4-week avg"
            value={
              status.fourWeekAvg != null
                ? Math.round(status.fourWeekAvg).toLocaleString()
                : "—"
            }
            color="var(--color-fg)"
          />
        </div>

        <div>
          <div className="label mb-2">Status</div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] tracking-tight"
            style={{
              borderColor: `color-mix(in srgb, ${CARDIO_STATUS_COLOR[status.status]} 40%, transparent)`,
              background: `color-mix(in srgb, ${CARDIO_STATUS_COLOR[status.status]} 10%, transparent)`,
              color: CARDIO_STATUS_COLOR[status.status],
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: CARDIO_STATUS_COLOR[status.status] }}
            />
            {CARDIO_STATUS_LABEL[status.status]}
          </span>
        </div>

        <div className="h-[220px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-fg-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              {status.fourWeekAvg != null && (
                <ReferenceLine
                  y={status.fourWeekAvg}
                  stroke={color}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  label={{
                    value: "4-wk avg",
                    fill: "var(--color-fg-3)",
                    fontSize: 9,
                    position: "insideTopRight",
                  }}
                />
              )}
              <Tooltip
                cursor={{ fill: "var(--color-elevated)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-stroke-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-fg)",
                }}
                formatter={(v) =>
                  typeof v === "number" ? v.toLocaleString() : String(v)
                }
              />
              <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-4 py-3 space-y-1.5 text-[12px] text-[var(--color-fg-2)]">
          <p className="font-medium text-[var(--color-fg)]">
            What is Cardio Load?
          </p>
          <p>
            A daily score that captures how much cardiovascular stress your
            workouts added — duration multiplied by intensity. Tracking the
            weekly total against your 4-week average shows whether you&rsquo;re
            building fitness, holding steady, or pushing into territory where
            recovery starts to lag.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card p-3">
      <div className="label">{label}</div>
      <div
        className="mt-1 tnum text-[22px] font-semibold"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
