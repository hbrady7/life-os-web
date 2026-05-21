"use client";

/**
 * DetectedSessionCard — surfaces watch-detected workouts (Pixel Watch /
 * Fitbit exercise sessions pulled from Google Health) that haven't been
 * imported as a LiftSession yet.
 *
 * - List is fetched via SWR against /api/workout-hr/detected-sessions for
 *   today (transient — not promoted to an entity hook).
 * - "Import" creates a stub LiftSession via the Zustand action, then POSTs
 *   to /api/workout-hr/sync (which itself persists the HR series to Neon
 *   via upsertWorkoutHrSeries). After success we revalidate the SWR key.
 * - Per-session dismissal is stored client-side (these are ephemeral
 *   prompts; users won't switch devices mid-flow).
 */

import * as React from "react";
import { motion } from "motion/react";
import useSWR, { mutate } from "swr";
import { Activity, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { todayStr } from "@/lib/date";
import { uid } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { upsertHrSeries } from "@/lib/hooks/use-workout-hr-series";
import type { LiftExercise, LiftSession } from "@/lib/types";

type DetectedSession = {
  startTime: string;
  endTime: string;
  activityType?: string;
  caloriesBurned?: number;
  source?: string;
};

type ListResponse =
  | { ok: true; sessions: DetectedSession[] }
  | { ok: false; error: string };

const DISMISS_KEY = "life-os:detected-session-dismissed";

function detectedKey(date: string): string {
  return `/api/workout-hr/detected-sessions?start=${date}&end=${date}`;
}

export function DetectedSessionCard() {
  const date = todayStr();
  const key = detectedKey(date);
  const swr = useSWR<ListResponse>(key);

  const liftSessions = useStore((s) => s.liftSessions);

  const [dismissed, setDismissed] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  });

  const persistDismissed = (next: Set<string>) => {
    setDismissed(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          DISMISS_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // localStorage full / unavailable — non-fatal
      }
    }
  };

  const detected = React.useMemo<DetectedSession[]>(() => {
    const data = swr.data;
    if (!data || !data.ok) return [];
    return data.sessions;
  }, [swr.data]);

  const candidates = React.useMemo(
    () =>
      detected.filter((d) => {
        if (dismissed.has(d.startTime)) return false;
        const dStart = new Date(d.startTime).getTime();
        // Treat as already imported if a LiftSession from today started
        // within 15 minutes of the detected window.
        const overlap = liftSessions.some((s) => {
          if (s.date !== date) return false;
          const sStart = new Date(s.createdAt).getTime();
          return Math.abs(sStart - dStart) < 15 * 60 * 1000;
        });
        return !overlap;
      }),
    [detected, dismissed, liftSessions, date]
  );

  if (candidates.length === 0) return null;

  const importSession = async (d: DetectedSession) => {
    const sessionId = uid();
    const startedAt = d.startTime;
    const endedAt = d.endTime;
    const stubExercise: LiftExercise = {
      id: uid(),
      name: prettyActivity(d.activityType ?? "Cardio"),
      normalizedName: prettyActivity(d.activityType ?? "cardio").toLowerCase(),
      sets: [],
    };
    const session: LiftSession = {
      id: sessionId,
      date,
      exercises: [stubExercise],
      createdAt: startedAt,
    };
    useStore.getState().addLiftSession(session);

    // Optimistically dismiss so the card disappears before the network
    // round-trip resolves — the user has committed.
    const next = new Set(dismissed);
    next.add(d.startTime);
    persistDismissed(next);
    haptic("success");

    try {
      const res = await fetch("/api/workout-hr/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sessionId, startedAt, endedAt }),
      });
      const json = (await res.json()) as
        | { ok: true; series: import("@/lib/types").WorkoutHRSeries }
        | { ok: false; error: string };
      if (res.ok && json.ok) {
        // Sync route already persisted via upsertWorkoutHrSeries; pull
        // the SWR cache forward so the gym page sees the new series.
        await upsertHrSeries(sessionId, {
          startedAt: json.series.startedAt,
          endedAt: json.series.endedAt,
          samples: json.series.samples,
          peakBpm: json.series.peakBpm,
          avgBpm: json.series.avgBpm,
          caloriesBurned: json.series.caloriesBurned,
          zoneMinutes: json.series.zoneMinutes,
        });
      }
    } catch {
      // Sync failure is non-fatal — the stub LiftSession still exists
      // and the user can re-sync from the workout summary.
    }

    await mutate(key);
  };

  return (
    <div className="space-y-2">
      {candidates.map((d) => (
        <motion.div
          key={d.startTime}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card
            className="flex items-center gap-3 p-3"
            style={{
              background:
                "color-mix(in srgb, var(--pillar-strain) 10%, var(--color-card))",
              borderColor:
                "color-mix(in srgb, var(--pillar-strain) 36%, var(--color-stroke))",
            }}
          >
            <div className="h-11 w-11 grid place-items-center rounded-full bg-[var(--color-card)] border border-[var(--color-stroke)]">
              <Activity
                size={18}
                style={{ color: "var(--pillar-strain)" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                style={{ color: "var(--pillar-strain)" }}
              >
                Watch detected workout
              </div>
              <div className="text-xs tnum text-[var(--color-fg-2)] truncate">
                {fmtTime(d.startTime)} {"·"} {fmtDuration(d)}{" "}
                {"·"} {prettyActivity(d.activityType)}
                {d.caloriesBurned != null
                  ? ` · ${Math.round(d.caloriesBurned)} kcal`
                  : ""}
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                void importSession(d);
              }}
            >
              Import
            </Button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                const next = new Set(dismissed);
                next.add(d.startTime);
                persistDismissed(next);
                haptic("soft");
              }}
              className="h-11 w-11 grid place-items-center rounded-md text-[var(--color-fg-3)] active:scale-90"
            >
              <X size={16} />
            </button>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDuration(d: DetectedSession): string {
  const ms = new Date(d.endTime).getTime() - new Date(d.startTime).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function prettyActivity(type: string | undefined): string {
  if (!type) return "Workout";
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
