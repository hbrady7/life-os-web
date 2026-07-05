"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Moon } from "lucide-react";
import { useStore } from "@/store";
import { useScoreFor } from "@/store/selectors";
import { useDay } from "./day-context";
import { Confetti } from "@/components/confetti";
import { haptic } from "@/lib/haptics";

/**
 * The close-the-day ritual. Appears at dusk/night on the live day:
 * lists what's still open (goals, habits, routines) as tappable rows;
 * when every checkbox that feeds the day score is done, it flips to
 * the sealed state — score reveal, one confetti burst — so finishing
 * the day has a moment.
 */
export function DayCloseCard() {
  const { date, isToday } = useDay();
  const score = useScoreFor(date);

  const openGoals = useStore(
    (s) => s.goals.filter((g) => g.date === date && !g.completed).length
  );
  const pendingHabits = useStore(
    (s) => s.habits.filter((h) => !h.history[date]).length
  );
  const morningLeft = useStore(
    (s) => s.routine.filter((r) => !r.history[date]?.completed).length
  );
  const eveningLeft = useStore(
    (s) => s.evening.filter((r) => !r.history[date]?.completed).length
  );
  const totalSlots = useStore(
    (s) =>
      s.goals.filter((g) => g.date === date).length +
      s.habits.length +
      s.routine.length
  );

  // Evening routine isn't part of the score, but it is part of the
  // ritual — the seal waits for it too.
  const scoreDone = totalSlots > 0 && openGoals + pendingHabits + morningLeft === 0;
  const sealed = scoreDone && eveningLeft === 0;

  const [burst, setBurst] = React.useState(false);
  const wasSealed = React.useRef(sealed);
  React.useEffect(() => {
    if (sealed && !wasSealed.current) {
      haptic("success");
      setBurst(true);
      const t = window.setTimeout(() => setBurst(false), 2600);
      return () => window.clearTimeout(t);
    }
    wasSealed.current = sealed;
  }, [sealed]);

  if (!isToday) return null;

  if (sealed) {
    return (
      <section className="card p-5 relative overflow-hidden">
        {burst && <Confetti />}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="display-num text-[44px] font-extrabold leading-none text-[var(--color-accent)]">
            {Math.round(score * 100)}
            <span className="text-[20px] align-top">%</span>
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">Day sealed.</div>
            <div className="text-xs text-[var(--color-fg-2)] mt-0.5">
              Every box that counts is checked. See you at dawn.
            </div>
          </div>
        </div>
      </section>
    );
  }

  const rows: Array<{ label: string; count: number; href: string }> = [
    { label: openGoals === 1 ? "goal still open" : "goals still open", count: openGoals, href: "#anchor-goals" },
    { label: pendingHabits === 1 ? "habit unchecked" : "habits unchecked", count: pendingHabits, href: "/habits" },
    { label: "morning routine left", count: morningLeft, href: "#anchor-morning" },
    { label: "evening routine left", count: eveningLeft, href: "#anchor-evening" },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) return null;

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Moon size={14} className="text-[var(--color-accent)]" />
        <span className="label">Close the day</span>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              onClick={() => haptic("tap")}
              className="flex items-center justify-between gap-2 h-10 px-3 rounded-[var(--radius-control)] bg-[var(--color-elevated)] border border-[var(--color-stroke)] hover:border-[var(--color-stroke-strong)] transition text-sm accent-ring"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={14} className="text-[var(--color-fg-3)] shrink-0" />
                <span className="truncate">
                  <span className="font-semibold tnum">{r.count}</span>{" "}
                  {r.label}
                </span>
              </span>
              <ChevronRight size={14} className="text-[var(--color-fg-3)] shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
