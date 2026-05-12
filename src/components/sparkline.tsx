"use client";

import * as React from "react";

type Props = {
  values: Array<number | null | undefined>;
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  /** Show a filled dot on the last data point. */
  endDot?: boolean;
};

export function Sparkline({
  values,
  width = 64,
  height = 22,
  color = "var(--color-accent)",
  fill = true,
  endDot = true,
}: Props) {
  const points = React.useMemo(() => {
    const cleaned = values.map((v) =>
      v == null || Number.isNaN(v) ? null : v
    );
    const nonNull = cleaned.filter((v): v is number => v != null);
    if (!nonNull.length) return null;
    const min = Math.min(...nonNull);
    const max = Math.max(...nonNull);
    const span = max - min || 1;
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const coords = cleaned.map((v, i) => {
      if (v == null) return null;
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return { x, y };
    });
    return coords;
  }, [values, width, height]);

  if (!points) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--color-stroke-strong)"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      </svg>
    );
  }

  let path = "";
  let area = "";
  let started = false;
  for (const p of points) {
    if (p == null) continue;
    if (!started) {
      path += `M ${p.x},${p.y}`;
      area += `M ${p.x},${height} L ${p.x},${p.y}`;
      started = true;
    } else {
      path += ` L ${p.x},${p.y}`;
      area += ` L ${p.x},${p.y}`;
    }
  }
  area += ` L ${width},${height} Z`;

  // Find the last non-null point for the end dot
  let lastPoint: { x: number; y: number } | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p) {
      lastPoint = p;
      break;
    }
  }

  const gradId = React.useId();

  return (
    <svg
      width={width}
      height={height}
      aria-hidden
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.38} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path
        d={path}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
      />
      {endDot && lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={2.4} fill={color} />
      )}
    </svg>
  );
}
