"use client";

import * as React from "react";
import { Screen } from "@/components/screen";
import { todayStr } from "@/lib/date";
import { EnergyCurveCard } from "./energy-curve-card";
import { MoodCheckinRow } from "./mood-checkin-row";
import { PlannerCard } from "./planner-card";
import { CaffeineCard } from "./caffeine-card";

export function VitalityClient() {
  // Vitality is "right now" — always pinned to actual today.
  const [date] = React.useState(() => todayStr());

  return (
    <Screen title="Vitality" subtitle="Your energy, fuel, and rhythm today.">
      <EnergyCurveCard date={date} />
      <MoodCheckinRow date={date} />
      <CaffeineCard date={date} />
      <PlannerCard date={date} />
    </Screen>
  );
}
