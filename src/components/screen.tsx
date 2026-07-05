"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Props = {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  /** Mono eyebrow above the title — domain context ("HEALTH", "MIND"). */
  eyebrow?: string;
  /**
   * "default" = the 640px reading column every feature page uses.
   * "wide" = the dashboard canvas (multi-column grids on desktop).
   */
  width?: "default" | "wide";
};

export function Screen({
  children,
  className,
  title,
  subtitle,
  eyebrow,
  width = "default",
}: Props) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // Layout rhythm (mobile-first):
        //   horizontal padding 16 / 24 (md)
        //   top padding clears safe-area + the mobile top bar; desktop has
        //     no top chrome (sidebar frame), so a plain breathing space
        //   bottom padding clears safe-area + BottomNav (mobile) / the
        //     Overseer FAB (desktop)
        "mx-auto w-full",
        width === "wide" ? "max-w-[1200px]" : "max-w-[640px]",
        "px-4 md:px-8",
        "pt-[calc(env(safe-area-inset-top)+3.75rem)] md:pt-10",
        "pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-28",
        className
      )}
    >
      {(title || subtitle || eyebrow) && (
        <header className="mb-4 md:mb-6">
          {eyebrow && <div className="label mb-1.5">{eyebrow}</div>}
          {title && (
            <h1 className="display text-[26px] md:text-[30px] font-bold">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-[var(--color-fg-2)] mt-1">{subtitle}</p>
          )}
        </header>
      )}
      {/* Inter-card rhythm: 12 mobile / 16 desktop. */}
      <div className="space-y-3 md:space-y-4">{children}</div>
    </motion.main>
  );
}
