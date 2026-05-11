"use client";

import { ArrowDown } from "lucide-react";
import { useStore } from "@/store";
import { usePlans, useToday } from "@/store/selectors";
import { ListSection } from "./list-section";
import { haptic } from "@/lib/haptics";

export function PlanTomorrowSection() {
  const today = useToday();
  const items = usePlans(today);
  const add = useStore((s) => s.addPlan);
  const remove = useStore((s) => s.removePlan);
  const update = useStore((s) => s.updatePlan);
  const moveToToday = useStore((s) => s.moveToToday);

  return (
    <ListSection
      title="Plan Tomorrow"
      placeholder="What's on deck tomorrow?"
      bullet="dot"
      items={items}
      onAdd={(text) => add(text)}
      onRemove={remove}
      onUpdate={update}
      itemAction={{
        icon: ArrowDown,
        label: "Move to today",
        onClick: (i) => {
          moveToToday(i.id);
          haptic("success");
        },
      }}
      emptyText="Lighten tomorrow's load tonight."
    />
  );
}
