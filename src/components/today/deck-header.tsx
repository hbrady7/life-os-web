"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  describeOffset,
  format,
  fromDateStr,
  shiftDate,
  todayStr,
} from "@/lib/date";
import { ScoreRing } from "@/components/score-ring";
import { HorizonBand } from "@/components/horizon-band";
import { DayChain } from "@/components/today/day-chain";
import { currentDaypart, type Daypart } from "@/lib/daypart";
import { useStore } from "@/store";
import { useScoreFor } from "@/store/selectors";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useDay } from "./day-context";

function greetingFor(daypart: Daypart, firstName: string | null): string {
  const name = firstName ? `, ${firstName}` : "";
  switch (daypart) {
    case "dawn":
      return `Good morning${name}.`;
    case "day":
      return "Midday. Stay on it.";
    case "dusk":
      return `Good evening${name}.`;
    case "night":
      return "Wind it down.";
  }
}

/**
 * The deck's masthead: mono date eyebrow, display-face greeting (or the
 * viewed date when off-today), the horizon band, and the day chain.
 * Carries over every behavior of the old TodayHeader — prev/next day,
 * native date picker, day-type chip, score ring.
 */
export function DeckHeader({ firstName }: { firstName?: string | null }) {
  const {
    date,
    step,
    goToday,
    isToday,
    isPast,
    canGoBack,
    canGoForward,
    setDate,
    daysBack,
    daysForward,
  } = useDay();
  const day = useStore((s) => s.days[date]);
  const presets = useStore((s) => s.settings.dayTypePresets);
  const setDayType = useStore((s) => s.setDayType);
  const addDayType = useStore((s) => s.addDayType);
  const score = useScoreFor(date);

  // Greeting is time-of-day chrome — client-only to avoid a stale SSR
  // daypart. Until mount it renders the date form (stable both sides).
  const [daypart, setDaypart] = React.useState<Daypart | null>(null);
  React.useEffect(() => {
    setDaypart(currentDaypart());
    const interval = window.setInterval(
      () => setDaypart(currentDaypart()),
      60_000
    );
    return () => window.clearInterval(interval);
  }, []);

  const d = fromDateStr(date);
  const weekday = format(d, "EEEE");
  const monthDay = format(d, "MMMM d");

  const [dayTypeOpen, setDayTypeOpen] = React.useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const minDate = shiftDate(todayStr(), -daysBack);
  const maxDate = shiftDate(todayStr(), daysForward);

  const heading =
    isToday && daypart
      ? greetingFor(daypart, firstName ?? null)
      : `${weekday}, ${monthDay}`;

  return (
    <section className="card p-5 md:p-6 relative overflow-hidden">
      {!isToday && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isPast
              ? "linear-gradient(180deg, color-mix(in srgb, var(--color-fg-3) 7%, transparent), transparent 70%)"
              : "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 70%)",
          }}
        />
      )}

      <div className="relative">
        {/* Row 1 — mono eyebrow: weekday + date (tap = native picker), offset chip */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              const el = dateInputRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") {
                try {
                  el.showPicker();
                } catch {
                  el.focus();
                }
              } else {
                el.focus();
              }
            }}
            aria-label="Pick a date"
            className="label hover:text-[var(--color-fg-2)] transition-colors"
          >
            {weekday} · {monthDay}
          </button>
          <div className="flex items-center gap-1.5">
            {!isToday && (
              <span
                className={cn(
                  "inline-flex items-center px-2.5 h-6 rounded-full text-[10px] font-mono uppercase tracking-wider shrink-0",
                  isPast
                    ? "bg-[var(--color-elevated)] text-[var(--color-fg-2)] border border-[var(--color-stroke)]"
                    : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                )}
              >
                {describeOffset(date)}
              </span>
            )}
            <NavArrow
              dir={-1}
              disabled={!canGoBack}
              onClick={() => {
                haptic("tap");
                step(-1);
              }}
            />
            <NavArrow
              dir={1}
              disabled={!canGoForward}
              onClick={() => {
                haptic("tap");
                step(1);
              }}
            />
          </div>
        </div>

        {/* Row 2 — display greeting + score ring */}
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="display text-[30px] md:text-[36px] font-bold leading-[1.05]">
            {heading}
          </h1>
          <div className="flex items-center gap-2 shrink-0 pb-1">
            {!isToday && (
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  goToday();
                }}
                className="inline-flex items-center h-7 px-3 rounded-full text-xs font-medium bg-[var(--color-accent-strong)] text-[var(--color-accent-contrast)]"
              >
                Today
              </button>
            )}
            <ScoreRing value={score} />
          </div>
        </div>

        {/* Row 3 — the horizon: where you are in the day */}
        <div className="mt-4">
          <HorizonBand height={3} marker={isToday} />
        </div>

        {/* Row 4 — chain strip + day type */}
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <DayChain />
          <button
            type="button"
            onClick={() => setDayTypeOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition shrink-0",
              day?.dayType
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color:color-mix(in_srgb,var(--color-accent)_24%,transparent)]"
                : "border-[var(--color-stroke)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)]"
            )}
          >
            {day?.dayType || "Set day type"}
            {day?.dayType ? (
              <X
                size={12}
                onClick={(e) => {
                  e.stopPropagation();
                  setDayType(date, "");
                }}
              />
            ) : (
              <Plus size={12} />
            )}
          </button>
        </div>

        {/* Hidden native date input — the eyebrow button triggers showPicker(). */}
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            if (!e.target.value) return;
            haptic("tap");
            setDate(e.target.value);
          }}
          className="absolute inset-x-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none w-px h-px"
          aria-hidden
          tabIndex={-1}
        />

        {dayTypeOpen && (
          <DayTypePicker
            presets={presets}
            selected={day?.dayType}
            onPick={(v) => {
              setDayType(date, v);
              setDayTypeOpen(false);
            }}
            onAdd={(v) => {
              addDayType(v);
              setDayType(date, v);
              setDayTypeOpen(false);
            }}
            onClose={() => setDayTypeOpen(false)}
          />
        )}
      </div>
    </section>
  );
}

function NavArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={dir === -1 ? "Previous day" : "Next day"}
      onClick={onClick}
      disabled={disabled}
      className="h-11 w-11 grid place-items-center rounded-full text-[var(--color-fg-2)] disabled:opacity-25 hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition accent-ring"
    >
      <Icon size={18} />
    </button>
  );
}

function DayTypePicker({
  presets,
  selected,
  onPick,
  onAdd,
  onClose,
}: {
  presets: string[];
  selected?: string;
  onPick: (v: string) => void;
  onAdd: (v: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  return (
    <div className="mt-3 p-3 rounded-xl bg-[var(--color-elevated)] border border-[var(--color-stroke)] animate-fade-in">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className={cn(
              "h-7 px-2.5 rounded-full text-xs border transition",
              p === selected
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color:color-mix(in_srgb,var(--color-accent)_24%,transparent)]"
                : "border-[var(--color-stroke)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)]"
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (!v) return;
          onAdd(v);
          setDraft("");
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Custom day type"
          className="control flex-1 h-9 px-3 no-zoom text-sm placeholder:text-[var(--color-fg-3)] outline-none accent-ring"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-9 px-3 rounded-lg bg-[var(--color-accent-strong)] text-[var(--color-accent-contrast)] text-xs font-medium disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-2 rounded-lg text-[var(--color-fg-2)] text-xs hover:text-[var(--color-fg)]"
        >
          Done
        </button>
      </form>
    </div>
  );
}
