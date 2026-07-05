"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { MobileTopBar } from "@/components/nav/mobile-top-bar";
import { HydrateGate } from "@/components/hydrate-gate";
import { QuickLogHost } from "@/components/quick-log-host";
import { Overseer } from "@/components/overseer/overseer";
import { ImportModal } from "@/components/import-modal";
import { OfflineBanner } from "@/components/offline-banner";
import { ActiveWorkoutBanner } from "@/components/workout/active-workout-banner";
import { CapacitorBootstrap } from "@/components/capacitor-bootstrap";

/**
 * Conditional chrome wrapper. The sign-in route lives at /signin and
 * shows its own pared-down layout — we hide the nav surfaces,
 * HydrateGate, and Overseer there. Everywhere else gets the full frame:
 * fixed sidebar on desktop (content offset by md:pl-60), horizon top
 * bar + domain bottom nav on mobile.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname === "/signin" || pathname.startsWith("/signin/");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <HydrateGate>
      <OfflineBanner />
      <Sidebar />
      <MobileTopBar />
      <div className="md:pl-60">{children}</div>
      <BottomNav />
      <QuickLogHost />
      <Overseer />
      <ImportModal />
      <ActiveWorkoutBanner />
      <CapacitorBootstrap />
    </HydrateGate>
  );
}
