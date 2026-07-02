"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Zap, Droplets, Pill, Check } from "lucide-react";
import { todayStr, isPast5am } from "@/lib/date";
import { useEnergyCurve } from "@/lib/hooks/use-energy-curve";
import { useWater } from "@/lib/hooks/use-metrics";
import { useHydrationTarget } from "@/lib/hooks/use-hydration";
import { useSupplements, useSupplementLogs } from "@/lib/hooks/use-supplements";
import { useIsActualToday } from "./day-context";

/**
 * A glanceable, forward-looking "start your day" strip — deliberately shows
 * what the readiness hero above it does NOT: when you'll be sharpest, whether
 * you're keeping hydration pace, and what supplements are still due in this
 * window. Every tile self-hides when its data isn't there yet, so it never
 * nags an empty state.
 */
export function MorningGlance() {
  const isToday = useIsActualToday();
  const date = todayStr();
  const { curve } = useEnergyCurve(date);
  const { water } = useWater(date);
  const { target } = useHydrationTarget(date);
  const { stack } = useSupplements();
  const { takenIds } = useSupplementLogs(date);

  const [nowHour, setNowHour] = React.useState(() => new Date().getHours());
  React.useEffect(() => {
    const id = setInterval(() => setNowHour(new Date().getHours()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Only a morning surface, only on the live day.
  if (!isToday || !isPast5am()) return null;

  const tiles: React.ReactNode[] = [];

  // ── Peak energy window ──────────────────────────────────────────────────
  if (curve && curve.points.length) {
    tiles.push(
      <GlanceTile
        key="energy"
        icon={<Zap size={14} />}
        color="var(--mc-peak)"
        label="Sharpest"
        value={peakWindow(curve.points)}
        hint="plan hard work here"
      />
    );
  }

  // ── Hydration pace ──────────────────────────────────────────────────────
  if (target?.targetOz && target.targetOz > 0) {
    const have = water?.oz ?? 0;
    const pace = hydrationPace(have, target.targetOz, nowHour);
    tiles.push(
      <GlanceTile
        key="hydration"
        icon={<Droplets size={14} />}
        color="var(--mc-water)"
        label="Hydration"
        value={pace.label}
        hint={`${Math.round(have)} / ${Math.round(target.targetOz)}oz`}
        tone={pace.behind ? "warn" : "ok"}
      />
    );
  }

  // ── Supplements due in this window ──────────────────────────────────────
  if (stack.length > 0) {
    const win = currentWindow(nowHour);
    const due = stack.filter(
      (s) =>
        !takenIds.has(s.id) &&
        (s.window === win || s.window === "anytime")
    );
    tiles.push(
      <GlanceTile
        key="supps"
        icon={due.length === 0 ? <Check size={14} /> : <Pill size={14} />}
        color="var(--mc-protein)"
        label="Supplements"
        value={due.length === 0 ? "All in" : `${due.length} due`}
        hint={due.length === 0 ? "nice" : due.slice(0, 2).map((s) => s.name).join(", ")}
        tone={due.length === 0 ? "ok" : "neutral"}
      />
    );
  }

  if (tiles.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="card p-3"
    >
      <div className="label text-[var(--color-fg-3)] mb-2 px-1">Your day at a glance</div>
      <div className="grid grid-cols-3 gap-2">{tiles}</div>
    </motion.section>
  );
}

function GlanceTile({
  icon,
  color,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const valueColor =
    tone === "warn"
      ? "var(--color-warning)"
      : tone === "ok"
      ? "var(--color-success)"
      : "var(--color-fg)";
  return (
    <div
      className="rounded-[var(--radius-control)] p-2.5"
      style={{ background: `color-mix(in srgb, ${color} 8%, var(--color-vitals-surface))` }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="label text-[9px]" style={{ color }}>
          {label}
        </span>
      </div>
      <div
        className="mt-1.5 text-[15px] font-semibold leading-none tnum"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] text-[var(--color-fg-3)] truncate">{hint}</div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function peakWindow(points: Array<{ hour: number; score: number }>): string {
  const day = points.filter((p) => p.hour >= 6 && p.hour <= 22);
  if (day.length === 0) return "—";
  const peak = day.reduce((a, b) => (b.score > a.score ? b : a));
  const start = peak.hour;
  const end = Math.min(23, start + 2);
  return `${fmtHour(start)}–${fmtHour(end)}`;
}

function currentWindow(hour: number): "morning" | "evening" | "anytime" {
  if (hour < 12) return "morning";
  if (hour >= 17) return "evening";
  return "anytime";
}

/**
 * Hydration pace vs a linear target across a 7am→10pm waking window. Returns
 * a short label and whether the user is meaningfully behind (>16oz, ~a bottle).
 */
function hydrationPace(
  have: number,
  target: number,
  nowHour: number
): { label: string; behind: boolean } {
  const frac = Math.max(0, Math.min(1, (nowHour - 7) / 15));
  const expected = target * frac;
  const gap = expected - have;
  if (have >= target) return { label: "Done", behind: false };
  if (gap > 16) return { label: `${Math.round(gap)}oz behind`, behind: true };
  if (frac <= 0) return { label: "Fresh start", behind: false };
  return { label: "On pace", behind: false };
}
