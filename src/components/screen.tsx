"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { DomainTabs } from "@/components/nav/domain-tabs";
import { domainForPath } from "@/lib/domains";
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
  // Domain chrome is inferred from the route so member pages get the
  // eyebrow + sibling tabs without any per-page wiring.
  const pathname = usePathname();
  const domain = domainForPath(pathname);
  const shownEyebrow = eyebrow ?? domain?.label;

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
      {(title || subtitle || shownEyebrow || domain) && (
        <header className="mb-4 md:mb-6 space-y-3">
          <div>
            {shownEyebrow && (
              <div className="label mb-1.5">{shownEyebrow}</div>
            )}
            {title && (
              <h1 className="display text-[26px] md:text-[30px] font-bold">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--color-fg-2)] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {domain && <DomainTabs />}
        </header>
      )}
      {/* Inter-card rhythm: 12 mobile / 16 desktop. */}
      <div className="space-y-3 md:space-y-4">{children}</div>
    </motion.main>
  );
}
