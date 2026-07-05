"use client";

import * as React from "react";
import { useStore } from "@/store";
import { currentDaypart, resolveAccent } from "@/lib/daypart";

/**
 * Applies the circadian chrome: sets html[data-daypart] (drives the
 * ambient CSS tint) and the accent custom properties (follow-the-sun
 * when settings.accent === "auto", otherwise the pinned hue).
 * Re-evaluates every minute and when the app returns to foreground —
 * a PWA left open overnight must wake up in the right daypart.
 */
export function DaypartProvider() {
  const accent = useStore((s) => s.settings.accent);

  React.useEffect(() => {
    const apply = () => {
      const daypart = currentDaypart();
      const spec = resolveAccent(accent, daypart);
      const root = document.documentElement;
      root.setAttribute("data-daypart", daypart);
      root.style.setProperty("--color-accent", spec.base);
      root.style.setProperty("--color-accent-strong", spec.strong);
      root.style.setProperty("--color-accent-contrast", spec.contrast);
      root.style.setProperty(
        "--color-accent-soft",
        `hsla(${spec.h}, ${spec.s}%, ${spec.l}%, 0.13)`
      );
    };

    apply();
    const interval = window.setInterval(apply, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accent]);

  return null;
}
