"use client";

import * as React from "react";
import {
  HRV_STATUS_COLOR,
  HRV_STATUS_LABEL,
  HRV_STATUS_TOOLTIP,
  HrvStatus,
} from "@/lib/hrv-status";
import { haptic } from "@/lib/haptics";

/**
 * Pill badge under the HRV value: dot + lowercase status. Long-press
 * (or hover on pointer devices) reveals an inline tooltip explaining
 * what the comparison means.
 */
export function HrvStatusPill({ status }: { status: HrvStatus }) {
  const [showTip, setShowTip] = React.useState(false);
  const pressTimer = React.useRef<number | null>(null);
  const color = HRV_STATUS_COLOR[status];
  const label = HRV_STATUS_LABEL[status];

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => {
      haptic("long");
      setShowTip(true);
    }, 400);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`HRV status: ${label}. ${HRV_STATUS_TOOLTIP[status]}`}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onClick={(e) => {
          e.stopPropagation();
          setShowTip((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border min-h-[22px] text-[10px] tracking-tight tabular-nums"
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
        <span className="lowercase">{label}</span>
      </button>
      {showTip && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-10 max-w-[240px] rounded-lg border border-[var(--color-stroke-strong)] bg-[var(--color-card)] px-2.5 py-1.5 text-[11px] text-[var(--color-fg-2)] shadow-[var(--shadow-float)]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowTip(false);
          }}
        >
          {HRV_STATUS_TOOLTIP[status]}
        </span>
      )}
    </span>
  );
}
