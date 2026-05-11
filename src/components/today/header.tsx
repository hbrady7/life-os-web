"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { formatHeader, todayStr } from "@/lib/date";
import { ScoreRing } from "@/components/score-ring";
import { useStore } from "@/store";
import { useScoreFor } from "@/store/selectors";
import { cn } from "@/lib/utils";

export function TodayHeader() {
  const today = todayStr();
  const { weekday, rest } = formatHeader();
  const day = useStore((s) => s.days[today]);
  const presets = useStore((s) => s.settings.dayTypePresets);
  const setDayType = useStore((s) => s.setDayType);
  const setReminder = useStore((s) => s.setReminder);
  const addDayType = useStore((s) => s.addDayType);
  const score = useScoreFor(today);

  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <section className="card p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-32 grad-soft pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">{weekday}</div>
          <div className="mt-1 text-[32px] font-bold tracking-tight leading-none">
            {rest}
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition",
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
                    setDayType(today, "");
                  }}
                />
              ) : (
                <Plus size={12} />
              )}
            </button>
          </div>
        </div>
        <ScoreRing value={score} />
      </div>

      {pickerOpen && (
        <DayTypePicker
          presets={presets}
          selected={day?.dayType}
          onPick={(v) => {
            setDayType(today, v);
            setPickerOpen(false);
          }}
          onAdd={(v) => {
            addDayType(v);
            setDayType(today, v);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <ReminderInput
        value={day?.reminder ?? ""}
        onChange={(v) => setReminder(today, v)}
      />
    </section>
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
          className="h-9 px-3 rounded-lg bg-[var(--color-accent-strong)] text-white text-xs font-medium disabled:opacity-40"
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

function ReminderInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative mt-4 rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2.5">
      <div className="label mb-1 text-[10px]">Reminder</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A note to your future self today…"
        className="w-full bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-3)] outline-none no-zoom"
        maxLength={160}
      />
    </div>
  );
}
