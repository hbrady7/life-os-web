"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Zap } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useEnergyCurve } from "@/lib/hooks/use-energy-curve";

// Recharts can't read CSS vars from SVG attrs — mirror --mc-peak / --mc-sleep.
const TEAL = "#5EEAD4";
const INDIGO = "#818CF8";

const X_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

function fmtHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const tickStyle = { fill: "var(--color-fg-3)", fontSize: 10 };

function TooltipBox({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { hour: number; score: number; caffeineBump: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--color-stroke-strong)] bg-[var(--color-card)] px-2.5 py-1.5 shadow-[var(--shadow-card)] text-xs">
      <div className="text-[10px] text-[var(--color-fg-3)]">{fmtHour(p.hour)}</div>
      <div className="tnum text-[var(--mc-peak)]">energy {p.score}</div>
      {p.caffeineBump > 0 && (
        <div className="text-[10px] text-[var(--color-fg-3)]">
          +{p.caffeineBump} caffeine
        </div>
      )}
    </div>
  );
}

export function EnergyCurveCard({ date }: { date: string }) {
  const { curve, isLoading } = useEnergyCurve(date);
  const [nowHour, setNowHour] = React.useState(() => new Date().getHours());

  React.useEffect(() => {
    const id = setInterval(() => setNowHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowScore = curve?.points[nowHour]?.score ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy forecast</CardTitle>
        {curve && (
          <span className="text-xs text-[var(--color-fg-3)]">
            {curve.inputs.sleepScore != null || curve.inputs.recovery != null
              ? "tuned to your recovery"
              : "baseline rhythm"}
          </span>
        )}
      </CardHeader>

      {isLoading || !curve ? (
        <div className="h-[200px] grid place-items-center text-xs text-[var(--color-fg-3)]">
          {isLoading ? "Reading your signals…" : "No forecast yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <ProgressRing
              value={nowScore ?? 0}
              max={100}
              size={104}
              stroke={9}
              label={nowScore ?? "—"}
              sublabel="now"
            />
            <div className="text-sm text-[var(--color-fg-2)]">
              <div className="flex items-center gap-1.5 text-[var(--color-fg)]">
                <Zap size={14} className="text-[var(--mc-peak)]" />
                <span className="font-medium">{peakWindow(curve.points)}</span>
              </div>
              <p className="mt-1 text-xs">
                Your predicted sharpest window today. Plan hard work there.
              </p>
            </div>
          </div>

          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={curve.points}
                margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="energy-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="energy-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={INDIGO} />
                    <stop offset="100%" stopColor={TEAL} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-stroke)" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  dataKey="hour"
                  ticks={X_TICKS}
                  tickFormatter={fmtHour}
                  tick={tickStyle}
                  stroke="var(--color-stroke)"
                  interval={0}
                />
                <YAxis domain={[0, 100]} tick={tickStyle} stroke="var(--color-stroke)" width={28} />
                <Tooltip content={<TooltipBox />} />
                <ReferenceLine x={nowHour} stroke={TEAL} strokeDasharray="2 3" strokeOpacity={0.7} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="url(#energy-line)"
                  strokeWidth={2.5}
                  fill="url(#energy-fill)"
                  style={{ filter: `drop-shadow(0 2px 6px color-mix(in srgb, ${TEAL} 35%, transparent))` }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

function peakWindow(points: Array<{ hour: number; score: number }>): string {
  // Find the highest-scoring daytime hour (6am–10pm) and frame a ~2h window.
  const day = points.filter((p) => p.hour >= 6 && p.hour <= 22);
  if (day.length === 0) return "—";
  const peak = day.reduce((a, b) => (b.score > a.score ? b : a));
  const start = peak.hour;
  const end = Math.min(23, start + 2);
  return `${fmtHour(start)}–${fmtHour(end)}`;
}
