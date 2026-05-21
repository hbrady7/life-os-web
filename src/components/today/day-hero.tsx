"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { useStore } from "@/store";
import { todayStr } from "@/lib/date";
import { computeReadiness, type ReadinessResult } from "@/lib/readiness";
import { computePillars, type PillarSnapshot } from "@/lib/pillars";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * Whoop-parity hero. The three primary gauges (Recovery / Strain / Sleep)
 * are the dominant visual; the composite Readiness score sits as a chip
 * above them. Tapping any gauge opens a detail sheet that shows the
 * inputs that fed the number + a 14-day trend chart + a coaching line.
 *
 * Pinned to actual today regardless of the day-context's selected date —
 * Whoop dashboards represent the user *right now*, not the day being
 * browsed.
 */
export function DayHero() {
  const date = todayStr();
  const health = useStore((s) => s.health);
  const liftSessions = useStore((s) => s.liftSessions);
  const waterTargetOz = useStore((s) => s.settings.waterTargetOz);

  const readiness = React.useMemo<ReadinessResult>(
    () => computeReadiness({ health, liftSessions, today: date, waterTargetOz }),
    [health, liftSessions, date, waterTargetOz]
  );

  const pillars = React.useMemo(
    () => computePillars({ health, liftSessions, today: date }),
    [health, liftSessions, date]
  );

  const [open, setOpen] = React.useState<PillarSnapshot["key"] | null>(null);
  const activePillar =
    open === "recovery"
      ? pillars.recovery
      : open === "strain"
        ? pillars.strain
        : open === "sleep"
          ? pillars.sleep
          : null;

  const compositeTone = bracketColor(readiness.bracket);
  const unknown = readiness.bracket === "unknown";

  return (
    <>
      <div
        className="relative w-full rounded-[28px] overflow-hidden border"
        style={{
          background: unknown
            ? "var(--color-card)"
            : `radial-gradient(140% 100% at 50% -20%, color-mix(in srgb, ${compositeTone} 18%, transparent) 0%, var(--color-card) 60%)`,
          borderColor: `color-mix(in srgb, ${compositeTone} 28%, var(--color-stroke))`,
          boxShadow: unknown
            ? "var(--shadow-card)"
            : `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 12px 40px -20px color-mix(in srgb, ${compositeTone} 45%, #000), var(--shadow-card)`,
        }}
      >
        {/* Composite readiness header */}
        <div className="px-5 pt-5 pb-3 flex items-baseline justify-between">
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: compositeTone }}
            >
              {bracketLabel(readiness.bracket)}
              {!unknown && readiness.score > 0 && (
                <span className="ml-2 text-[var(--color-fg-3)] font-normal tnum normal-case tracking-normal">
                  Day score {readiness.score}
                </span>
              )}
            </div>
            <div className="mt-1 text-[14px] text-[var(--color-fg)] leading-snug">
              {readiness.headline}
            </div>
          </div>
        </div>

        {/* Three primary gauges */}
        <div className="grid grid-cols-3 gap-1 px-3 pb-5">
          <PillarGauge
            pillar={pillars.recovery}
            tone="var(--pillar-recovery)"
            onTap={() => {
              haptic("tap");
              setOpen("recovery");
            }}
          />
          <PillarGauge
            pillar={pillars.strain}
            tone="var(--pillar-strain)"
            onTap={() => {
              haptic("tap");
              setOpen("strain");
            }}
          />
          <PillarGauge
            pillar={pillars.sleep}
            tone="var(--pillar-sleep)"
            onTap={() => {
              haptic("tap");
              setOpen("sleep");
            }}
          />
        </div>
      </div>

      <PillarDetailSheet
        open={!!activePillar}
        onClose={() => setOpen(null)}
        pillar={activePillar}
        readiness={readiness}
      />
    </>
  );
}

const TONE_BY_PILLAR: Record<PillarSnapshot["key"], string> = {
  recovery: "var(--pillar-recovery)",
  strain: "var(--pillar-strain)",
  sleep: "var(--pillar-sleep)",
};

function PillarGauge({
  pillar,
  tone,
  onTap,
}: {
  pillar: PillarSnapshot;
  tone: string;
  onTap: () => void;
}) {
  const SIZE = 96;
  const STROKE = 8;
  const r = SIZE / 2 - STROKE / 2 - 1;
  const c = 2 * Math.PI * r;
  const pct = pillar.value == null ? 0 : Math.max(0, Math.min(1, normalizePillarPct(pillar)));
  const offset = c * (1 - pct);
  const empty = pillar.value == null;
  const gid = React.useId();

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "flex flex-col items-center gap-1.5 py-2 rounded-2xl",
        "active:scale-[0.97] transition-transform duration-[100ms]"
      )}
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={1} />
              <stop
                offset="100%"
                stopColor={`color-mix(in srgb, ${tone} 55%, white)`}
                stopOpacity={1}
              />
            </linearGradient>
          </defs>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            fill="none"
            stroke={tone}
            strokeOpacity={0.16}
            strokeWidth={STROKE}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            fill="none"
            stroke={empty ? "var(--color-stroke-strong)" : `url(#${gid})`}
            strokeWidth={STROKE}
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center px-1">
            <div
              className="text-[26px] font-bold tnum leading-none tracking-tight"
              style={{ color: empty ? "var(--color-fg-3)" : "var(--color-fg)" }}
            >
              {pillar.display}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: empty ? "var(--color-fg-3)" : tone }}
        >
          {pillar.label}
        </span>
        {pillar.bracket && !empty && (
          <span className="text-[9px] uppercase tracking-wider text-[var(--color-fg-2)]">
            {pillar.bracket}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Normalize a pillar value into a 0..1 percentage for the ring fill.
 * Different pillars have different scales:
 *   - recovery: 0..100 (direct)
 *   - sleep:    0..100 (direct, % of need)
 *   - strain:   0..21 (Whoop scale)
 */
function normalizePillarPct(p: PillarSnapshot): number {
  if (p.value == null) return 0;
  if (p.key === "strain") return p.value / 21;
  return p.value / 100;
}

function PillarDetailSheet({
  open,
  onClose,
  pillar,
  readiness,
}: {
  open: boolean;
  onClose: () => void;
  pillar: PillarSnapshot | null;
  readiness: ReadinessResult;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && pillar && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={cn(
              "relative w-full card rounded-b-none sm:rounded-b-[var(--radius-card)] sm:mb-0",
              "max-w-lg max-h-[90dvh] overflow-y-auto",
              "border"
            )}
            style={{
              borderColor: `color-mix(in srgb, ${TONE_BY_PILLAR[pillar.key]} 35%, var(--color-stroke))`,
              background: `linear-gradient(180deg, color-mix(in srgb, ${TONE_BY_PILLAR[pillar.key]} 8%, var(--color-card)) 0%, var(--color-card) 30%)`,
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="pt-2 pb-1 grid place-items-center sm:hidden">
              <div className="h-1 w-9 rounded-full bg-[var(--color-stroke-strong)]" />
            </div>
            <header className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-2">
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.18em] font-semibold"
                  style={{ color: TONE_BY_PILLAR[pillar.key] }}
                >
                  {pillar.label}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className="text-[44px] font-bold tnum leading-none tracking-tight"
                    style={{ color: "var(--color-fg)" }}
                  >
                    {pillar.display}
                  </span>
                  {pillar.bracket && (
                    <span
                      className="text-[11px] uppercase tracking-wider font-semibold"
                      style={{ color: TONE_BY_PILLAR[pillar.key] }}
                    >
                      {pillar.bracket}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-11 w-11 grid place-items-center rounded-full text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition shrink-0 -mr-2 -mt-2"
              >
                <X size={18} />
              </button>
            </header>

            <div className="px-5 pb-5 space-y-4">
              <Sparkline trend={pillar.trend} tone={TONE_BY_PILLAR[pillar.key]} />
              <BreakdownBlock pillar={pillar} readiness={readiness} />
              <CoachingLine pillar={pillar} readiness={readiness} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Sparkline({ trend, tone }: { trend: (number | null)[]; tone: string }) {
  const values = trend.filter((n): n is number => n != null);
  if (values.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] p-4 text-[11px] text-[var(--color-fg-3)] text-center">
        Not enough history yet — log a few more days to see the trend.
      </div>
    );
  }
  const W = 320;
  const H = 80;
  const padY = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const gid = React.useId();

  const points = trend.map((v, i) => ({
    x: trend.length === 1 ? W / 2 : (i / (trend.length - 1)) * W,
    v,
  }));
  const segments: string[] = [];
  let cur = "";
  for (const p of points) {
    if (p.v == null) {
      if (cur) {
        segments.push(cur);
        cur = "";
      }
      continue;
    }
    const cmd = cur ? "L" : "M";
    const y = H - padY - ((p.v - min) / span) * (H - padY * 2);
    cur += `${cmd}${p.x.toFixed(2)} ${y.toFixed(2)} `;
  }
  if (cur) segments.push(cur);
  const linePath = segments.join("");
  const firstX = points.find((p) => p.v != null)?.x ?? 0;
  const lastX = [...points].reverse().find((p) => p.v != null)?.x ?? W;
  const areaPath = `${linePath} L${lastX.toFixed(2)} ${H} L${firstX.toFixed(2)} ${H} Z`;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)] font-semibold mb-2">
        Last 14 days
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-20"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity={0.35} />
            <stop offset="100%" stopColor={tone} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gid})`} />
        <path
          d={linePath}
          fill="none"
          stroke={tone}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) =>
          p.v == null ? null : i === points.length - 1 ? (
            <circle key={i} cx={p.x} cy={H - padY - ((p.v - min) / span) * (H - padY * 2)} r={3} fill={tone} />
          ) : null
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-[var(--color-fg-3)] tnum">
        <span>14d ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function BreakdownBlock({
  pillar,
  readiness,
}: {
  pillar: PillarSnapshot;
  readiness: ReadinessResult;
}) {
  // Pull the dimensions that fed this pillar (when applicable) from the
  // composite readiness result.
  let dims = readiness.dimensions;
  if (pillar.key === "recovery") {
    dims = dims.filter((d) => d.key === "recovery" || d.key === "sleep");
  } else if (pillar.key === "strain") {
    dims = dims.filter((d) => d.key === "strain");
  } else if (pillar.key === "sleep") {
    dims = dims.filter((d) => d.key === "sleep");
  }

  if (dims.length === 0) {
    return (
      <div className="text-[12px] text-[var(--color-fg-2)]">
        No contributing data yet. Sync from Google Health or log your inputs
        manually to populate this.
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)] font-semibold mb-2">
        Inputs
      </div>
      <ul className="space-y-2">
        {dims.map((d) => (
          <li
            key={d.key}
            className="rounded-lg border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-semibold text-[var(--color-fg)]">
                {d.label}
              </span>
              <span className="text-[12px] tnum text-[var(--color-fg-2)]">
                {Math.round(d.score)}
                <span className="text-[var(--color-fg-3)]"> / 100</span>
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-fg-2)] leading-snug">
              {d.note}
            </div>
            <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-[var(--color-stroke)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, d.score))}%`,
                  background: TONE_BY_PILLAR[pillar.key],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoachingLine({
  pillar,
  readiness,
}: {
  pillar: PillarSnapshot;
  readiness: ReadinessResult;
}) {
  let copy: string;
  if (pillar.key === "recovery") {
    copy =
      readiness.bracket === "optimal" || readiness.bracket === "green"
        ? "Body's primed for harder work today — green light on a heavier session."
        : readiness.bracket === "yellow"
          ? "Recovery is moderate — keep volume sensible and add an extra rest set."
          : readiness.bracket === "red"
            ? "Recovery is depleted — prioritize sleep and behaviors over training intensity."
            : "Not enough data yet — log sleep + HRV to start tracking recovery.";
  } else if (pillar.key === "strain") {
    copy =
      pillar.value == null
        ? "Track a workout with HR to compute today's cardiovascular load."
        : pillar.value < 8
          ? "Below your usual load — room for another bout if recovery allows."
          : pillar.value < 14
            ? "On pace for a moderate day — consistent volume."
            : pillar.value < 18
              ? "High strain accumulated — recovery cost will land tomorrow."
              : "All-out day — full rest tonight, no extra hard work.";
  } else {
    copy =
      pillar.value == null
        ? "Log last night's sleep to see how it stacks up against your needed total."
        : pillar.value >= 95
          ? "Slept what you needed. Tonight should match if you keep behaviors clean."
          : pillar.value >= 80
            ? "Close to need. One earlier bedtime closes the gap."
            : "Sleep debt is accumulating — protect tonight's bedtime hard.";
  }
  return (
    <div
      className="rounded-xl border p-3 text-[12px] leading-snug text-[var(--color-fg-2)]"
      style={{
        background: `color-mix(in srgb, ${TONE_BY_PILLAR[pillar.key]} 8%, transparent)`,
        borderColor: `color-mix(in srgb, ${TONE_BY_PILLAR[pillar.key]} 22%, var(--color-stroke))`,
      }}
    >
      {copy}
    </div>
  );
}

function bracketColor(b: ReadinessResult["bracket"]): string {
  switch (b) {
    case "optimal":
      return "var(--readiness-optimal)";
    case "green":
      return "var(--readiness-green)";
    case "yellow":
      return "var(--readiness-yellow)";
    case "red":
      return "var(--readiness-red)";
    default:
      return "var(--color-fg-3)";
  }
}

function bracketLabel(b: ReadinessResult["bracket"]): string {
  switch (b) {
    case "optimal":
      return "Optimal";
    case "green":
      return "Recovered";
    case "yellow":
      return "Moderate";
    case "red":
      return "Rest";
    default:
      return "Day score";
  }
}

// Suppress unused export warning — ChevronRight kept for potential
// per-pillar "View full breakdown" links later.
void ChevronRight;
