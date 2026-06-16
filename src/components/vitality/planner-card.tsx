"use client";

import * as React from "react";
import { Trash2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useEnergyCurve } from "@/lib/hooks/use-energy-curve";
import {
  usePlanBlocks,
  parsePlanText,
  deletePlanBlockItem,
} from "@/lib/hooks/use-plan-blocks";

function fmtMin(min: number): string {
  let h = Math.floor(min / 60);
  const m = (min % 60).toString().padStart(2, "0");
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}:${m}${ap}`;
}

const DIFF_COLOR: Record<string, string> = {
  easy: "var(--mc-water)",
  medium: "var(--mc-sleep)",
  hard: "var(--color-accent)",
};

export function PlannerCard({ date }: { date: string }) {
  const { blocks } = usePlanBlocks(date);
  const { curve } = useEnergyCurve(date);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Average predicted energy across a block's hours — used to flag a hard
  // block that lands in a trough.
  const energyFor = React.useCallback(
    (startMin: number, endMin: number): number | null => {
      if (!curve) return null;
      const startH = Math.floor(startMin / 60);
      const endH = Math.max(startH, Math.ceil(endMin / 60) - 1);
      const slice = curve.points.filter((p) => p.hour >= startH && p.hour <= endH);
      if (slice.length === 0) return null;
      return slice.reduce((a, p) => a + p.score, 0) / slice.length;
    },
    [curve]
  );

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    const err = await parsePlanText(date, trimmed);
    if (err) setError(err);
    else setText("");
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Day planner</CardTitle>
      </CardHeader>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="deep work 9 to 11 hard, gym 1930, read 30m"
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Plan">
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

      {blocks.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {blocks.map((b) => {
            const avg = energyFor(b.startMin, b.endMin);
            const inTrough = b.difficulty === "hard" && avg != null && avg < 55;
            const inPeak = b.difficulty === "hard" && avg != null && avg >= 70;
            return (
              <li
                key={b.id}
                className="group flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2"
              >
                <span className="w-20 shrink-0 text-xs tnum text-[var(--color-fg-2)]">
                  {fmtMin(b.startMin)}–{fmtMin(b.endMin)}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: DIFF_COLOR[b.difficulty] }}
                />
                <span className="flex-1 text-sm text-[var(--color-fg)]">
                  {b.task}
                  {inTrough && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-warning)]">
                      <AlertTriangle size={11} /> hard block in a predicted dip
                    </span>
                  )}
                  {inPeak && (
                    <span className="ml-2 text-[11px] text-[var(--mc-peak)]">
                      in your peak
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => {
                    haptic("soft");
                    deletePlanBlockItem(date, b.id);
                  }}
                  className={cn(
                    "h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] transition",
                    "opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--color-danger)]"
                  )}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-fg-3)]">
          Type your day in plain words — I&apos;ll lay it out and flag hard
          work that lands in an energy dip.
        </p>
      )}
    </Card>
  );
}
