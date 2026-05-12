"use client";

import { Screen } from "@/components/screen";
import { Nutrition } from "@/components/today/nutrition";

export default function NutritionPage() {
  return (
    <Screen title="Nutrition" subtitle="Today's macros + saved meals.">
      <Nutrition />
    </Screen>
  );
}
