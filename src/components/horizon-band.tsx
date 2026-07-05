"use client";

import * as React from "react";
import { HORIZON_STOPS, dayFraction } from "@/lib/daypart";
import { cn } from "@/lib/utils";

/**
 * The signature element: a 24-hour horizon rendered as a gradient band
 * (night → dawn → day → dusk → night) with a marker at "now". Doubles
 * as a preattentive clock — a glance tells you where you are in the day.
 *
 * Mounts as a 2px strip in chrome (mobile top bar, sidebar) and a
 * taller interactive band in the deck header.
 */
export function HorizonBand({
  className,
  height = 2,
  marker = true,
}: {
  className?: string;
  height?: number;
  marker?: boolean;
}) {
  // Render the marker only after mount — server HTML has no stable "now".
  const [frac, setFrac] = React.useState<number | null>(null);

  React.useEffect(() => {
    const tick = () => setFrac(dayFraction());
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{ background: `linear-gradient(90deg, ${HORIZON_STOPS})` }}
      />
      {marker && frac !== null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--color-fg)] transition-[left] duration-1000"
          style={{
            left: `${frac * 100}%`,
            width: Math.max(4, height + 2),
            height: Math.max(4, height + 2),
            boxShadow: "0 0 8px 1px rgba(255,255,255,0.55)",
          }}
        />
      )}
    </div>
  );
}
