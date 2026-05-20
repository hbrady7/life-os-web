"use client";

import * as React from "react";
import { motion, PanInfo } from "motion/react";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptics";

/**
 * Native-feel pull-to-refresh. Wraps the scrollable region of a screen
 * (typically a whole page's main content). When the page is scrolled
 * to the top and the user pans downward past the threshold, fires
 * `onRefresh` and shows a violet spinner indicator while it resolves.
 *
 * Touch behavior:
 *   • Only engages when window.scrollY <= 0 at pan start (so an
 *     in-page downward pan doesn't accidentally trigger).
 *   • Rubber-band resistance — the indicator follows the finger at
 *     ~0.5× the actual drag distance.
 *   • Crosses the threshold → haptic("tap"), light visual lock-in,
 *     release fires onRefresh.
 *   • Respects prefers-reduced-motion: skip the spring transition,
 *     no spinner spin.
 *
 * No-op on devices that don't expose touch events (desktop).
 */

const THRESHOLD = 80;
const MAX_PULL = 140; // hard cap so the indicator doesn't run away

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const startScrollTop = React.useRef<number | null>(null);
  const passedThreshold = React.useRef(false);
  const prefersReduced = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReduced.current = mq.matches;
    const onChange = () => (prefersReduced.current = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onPanStart = () => {
    startScrollTop.current = window.scrollY;
    passedThreshold.current = false;
  };

  const onPan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (refreshing) return;
    // Only engage if we started at the top.
    if ((startScrollTop.current ?? 1) > 0) return;
    // Ignore upward / sideways pans.
    if (info.offset.y <= 0) {
      if (pull !== 0) setPull(0);
      return;
    }
    const dampened = Math.min(MAX_PULL, info.offset.y * 0.5);
    setPull(dampened);
    if (!passedThreshold.current && dampened >= THRESHOLD) {
      passedThreshold.current = true;
      haptic("tap");
    } else if (passedThreshold.current && dampened < THRESHOLD) {
      passedThreshold.current = false;
    }
  };

  const onPanEnd = async () => {
    if (refreshing) return;
    const fired = passedThreshold.current && pull >= THRESHOLD;
    passedThreshold.current = false;
    if (!fired) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(48);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const progress = Math.min(1, pull / THRESHOLD);
  const active = pull >= THRESHOLD || refreshing;

  return (
    <motion.div
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
      style={{ touchAction: "pan-y" }}
    >
      {/* Indicator sits above the content; translates with the pull. */}
      <motion.div
        aria-hidden={!active}
        className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex justify-center"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
        }}
        animate={{
          y: pull > 0 ? pull - 32 : -48,
          opacity: pull > 0 || refreshing ? 1 : 0,
          scale: 0.85 + progress * 0.15,
        }}
        transition={
          prefersReduced.current
            ? { duration: 0 }
            : { type: "spring", stiffness: 340, damping: 32 }
        }
      >
        <div
          className="h-9 w-9 grid place-items-center rounded-full border bg-[var(--color-card)]/90 backdrop-blur-md shadow-[var(--shadow-card)]"
          style={{
            borderColor: active
              ? "var(--color-accent)"
              : "var(--color-stroke)",
            color: active ? "var(--color-accent)" : "var(--color-fg-3)",
          }}
        >
          <RefreshCw
            size={15}
            className={refreshing && !prefersReduced.current ? "animate-spin" : ""}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              transition: "transform 80ms linear",
            }}
          />
        </div>
      </motion.div>

      {children}
    </motion.div>
  );
}
