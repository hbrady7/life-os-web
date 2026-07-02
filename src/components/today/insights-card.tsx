"use client";

import * as React from "react";
import { motion } from "motion/react";
import { FlaskConical, X, MessageCircle, ChevronRight } from "lucide-react";
import { metricColors } from "@/lib/metric-colors";
import { haptic } from "@/lib/haptics";
import { useOverseer } from "@/components/overseer/overseer-context";
import { useIsActualToday } from "./day-context";
import {
  useEngineInsights,
  dismissEngineInsight,
} from "@/lib/hooks/use-engine-insights";
import type { EngineInsight, Confidence } from "@/lib/insight-engine";

const CONFIDENCE_STYLE: Record<
  Confidence,
  { label: string; color: string; bg: string }
> = {
  strong: {
    label: "strong signal",
    color: "var(--color-success)",
    bg: "color-mix(in srgb, var(--color-success) 16%, transparent)",
  },
  moderate: {
    label: "moderate signal",
    color: "var(--color-accent)",
    bg: "var(--color-accent-soft)",
  },
  tentative: {
    label: "tentative",
    color: "var(--color-fg-2)",
    bg: "color-mix(in srgb, var(--color-fg-2) 14%, transparent)",
  },
};

export function InsightsCard() {
  const isToday = useIsActualToday();
  const { insights, isLoading } = useEngineInsights();
  const [expanded, setExpanded] = React.useState(false);
  const overseer = useOverseer();

  // Only on the live "today" view, matching the other intelligence cards.
  if (!isToday) return null;

  if (isLoading && insights.length === 0) {
    return (
      <div className="card p-4">
        <Header />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-2/3 rounded shimmer" />
          <div className="h-3 w-1/2 rounded shimmer" />
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="card p-4">
        <Header />
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-fg-2)]">
          Nothing solid yet — I only surface a link once I have enough
          overlapping days to trust it. Keep logging sleep, energy, caffeine and
          the rest, and honest patterns will show up here with their sample
          sizes.
        </p>
      </div>
    );
  }

  const shown = expanded ? insights : insights.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="card p-4"
    >
      <Header count={insights.length} />
      <div className="mt-3 space-y-2.5">
        {shown.map((ins) => (
          <InsightRow
            key={ins.id}
            insight={ins}
            onDismiss={() => {
              haptic("soft");
              void dismissEngineInsight(ins);
            }}
            onAsk={() => {
              haptic("tap");
              overseer?.open(
                `Explain this pattern from my data and what I should do about it: ${ins.detail}`
              );
            }}
          />
        ))}
      </div>
      {insights.length > 3 && (
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setExpanded((v) => !v);
          }}
          className="mt-3 text-[11px] font-medium text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)]"
        >
          {expanded ? "Show fewer" : `Show ${insights.length - 3} more`}
        </button>
      )}
    </motion.div>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 grid place-items-center rounded-lg grad-hero shrink-0">
        <FlaskConical size={15} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="label text-[var(--color-fg-3)]">Insight engine</div>
        <div className="text-sm font-semibold leading-tight">
          What your data actually says
        </div>
      </div>
      {count != null && count > 0 && (
        <div className="ml-auto text-[11px] tnum text-[var(--color-fg-3)]">
          {count} found
        </div>
      )}
    </div>
  );
}

function InsightRow({
  insight,
  onDismiss,
  onAsk,
}: {
  insight: EngineInsight;
  onDismiss: () => void;
  onAsk: () => void;
}) {
  const c = metricColors(insight.metric);
  const conf = CONFIDENCE_STYLE[insight.confidence];
  return (
    <div
      className="relative rounded-[var(--radius-control)] border p-3"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${c.base} 9%, var(--color-card)) 0%, var(--color-card) 75%)`,
        borderColor: `color-mix(in srgb, ${c.base} 22%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1 h-2 w-2 rounded-full shrink-0"
          style={{ background: c.base }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium leading-snug">
            {insight.headline}
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-[var(--color-fg-2)]">
            {insight.detail}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold"
              style={{ color: conf.color, background: conf.bg }}
            >
              {conf.label}
            </span>
            <span className="text-[10px] tnum text-[var(--color-fg-3)]">
              n={insight.n} · p={insight.pValue.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss insight"
          className="p-1 -m-1 text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)] shrink-0"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAsk}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium"
          style={{ background: c.soft, color: c.base }}
        >
          <MessageCircle size={10} />
          Tell me more
          <ChevronRight size={10} />
        </button>
      </div>
    </div>
  );
}
