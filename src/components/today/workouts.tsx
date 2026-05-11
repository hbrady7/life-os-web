"use client";

import * as React from "react";
import { Dumbbell, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useStore } from "@/store";
import { useTodayWorkouts } from "@/store/selectors";
import { WorkoutLogModal } from "./workout-log-modal";
import { haptic } from "@/lib/haptics";

export function Workouts() {
  const list = useTodayWorkouts();
  const removeWorkout = useStore((s) => s.removeWorkout);
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workouts</CardTitle>
        <Button
          size="sm"
          variant="soft"
          onClick={() => setOpen(true)}
        >
          <Plus size={14} />
          Log
        </Button>
      </CardHeader>

      {list.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-6 rounded-xl border border-dashed border-[var(--color-stroke-strong)] text-center text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)] hover:border-[var(--color-fg-3)] transition"
        >
          <Dumbbell size={20} className="mx-auto mb-1.5" />
          <div className="text-sm">No workouts logged</div>
        </button>
      ) : (
        <ul className="space-y-2">
          {list.map((w) => (
            <li
              key={w.id}
              className="group flex items-center gap-3 px-3 py-3 rounded-xl bg-[var(--color-elevated)] border border-[var(--color-stroke)]"
            >
              <div className="h-9 w-9 grid place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Dumbbell size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{w.type}</span>
                  <Pill tone="accent">{w.durationMin} min</Pill>
                  <Pill tone="neutral">{w.intensity}/10</Pill>
                </div>
                {w.exercises.length > 0 && (
                  <div className="text-[11px] text-[var(--color-fg-2)] mt-1 line-clamp-1">
                    {w.exercises
                      .slice(0, 3)
                      .map((e) => `${e.name} ${e.sets}×${e.reps}`)
                      .join(" · ")}
                    {w.exercises.length > 3 ? " · …" : ""}
                  </div>
                )}
                {w.notes && (
                  <div className="text-[11px] text-[var(--color-fg-2)] mt-1 line-clamp-1">
                    {w.notes}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  removeWorkout(w.id);
                  haptic("warn");
                }}
                aria-label="Delete workout"
                className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-card)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <WorkoutLogModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
