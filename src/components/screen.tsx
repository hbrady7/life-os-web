"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Props = {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
};

export function Screen({ children, className, title, subtitle }: Props) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // Layout rhythm (mobile-first):
        //   horizontal padding 16 / 24 (md)
        //   top padding clears safe-area + the 3-icon mobile top bar
        //     (44 button + 16 vertical padding ≈ 60 → 3.75rem)
        //   bottom padding clears safe-area + the BottomNav floor (96)
        "mx-auto w-full max-w-[640px]",
        "px-4 md:px-6",
        "pt-[calc(env(safe-area-inset-top)+3.75rem)] md:pt-4",
        "pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-[7.5rem]",
        className
      )}
    >
      {(title || subtitle) && (
        <header className="mb-4 md:mb-5">
          {title && (
            <h1 className="text-[26px] md:text-[28px] font-bold tracking-tight">
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
