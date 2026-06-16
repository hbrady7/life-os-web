"use client";

import * as React from "react";
import {
  Check,
  Plus,
  Trash2,
  Sparkles,
  Sunrise,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { SupplementRow, SupplementWindow } from "@/lib/data/supplements";
import {
  useSupplements,
  useSupplementLogs,
  createSupplementItem,
  deleteSupplementItem,
  toggleSupplementTaken,
} from "@/lib/hooks/use-supplements";

const WINDOWS: Array<{ key: SupplementWindow; label: string; Icon: typeof Sun }> = [
  { key: "morning", label: "Morning", Icon: Sunrise },
  { key: "anytime", label: "Anytime", Icon: Sun },
  { key: "evening", label: "Evening", Icon: Moon },
];

type Suggestion = { name: string; dose: string; rationale: string };

export function SupplementsCard({ date }: { date: string }) {
  const { stack } = useSupplements();
  const { takenIds } = useSupplementLogs(date);

  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [dose, setDose] = React.useState("");
  const [win, setWin] = React.useState<SupplementWindow>("morning");

  const taken = stack.filter((s) => takenIds.has(s.id)).length;

  const add = async () => {
    if (!name.trim()) return;
    haptic("success");
    await createSupplementItem({ name: name.trim(), dose: dose.trim() || undefined, window: win });
    setName("");
    setDose("");
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplement stack</CardTitle>
      </CardHeader>

      <div className="flex items-center gap-4">
        <ProgressRing
          value={taken}
          max={Math.max(1, stack.length)}
          size={96}
          stroke={9}
          label={`${taken}/${stack.length}`}
          sublabel="taken"
        />
        <p className="text-sm text-[var(--color-fg-2)]">
          {stack.length === 0
            ? "Build your stack — add what you take and when."
            : taken === stack.length
              ? "Full stack taken today. Nice."
              : `${stack.length - taken} left to take today.`}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        {WINDOWS.map(({ key, label, Icon }) => {
          const items = stack.filter((s) => s.window === key);
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div className="label mb-1.5 flex items-center gap-1.5">
                <Icon size={12} /> {label}
              </div>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <SupplementRowItem
                    key={s.id}
                    supplement={s}
                    taken={takenIds.has(s.id)}
                    onToggle={() =>
                      toggleSupplementTaken(date, s.id, !takenIds.has(s.id))
                    }
                    onDelete={() => deleteSupplementItem(s.id)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {adding ? (
        <form
          className="mt-3 space-y-2 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Creatine)" autoFocus />
          <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (e.g. 5g)" />
          <Segmented
            size="sm"
            value={win}
            onChange={setWin}
            options={WINDOWS.map((w) => ({ value: w.key, label: w.label }))}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Add to stack
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setAdding(true)}
        >
          <Plus size={16} /> Add supplement
        </Button>
      )}

      <Recommendations existing={stack} onAdd={(s) => createSupplementItem({ name: s.name, dose: s.dose, window: "anytime" })} />
    </Card>
  );
}

function SupplementRowItem({
  supplement,
  taken,
  onToggle,
  onDelete,
}: {
  supplement: SupplementRow;
  taken: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2">
      <button
        type="button"
        aria-label={taken ? "Mark not taken" : "Mark taken"}
        aria-pressed={taken}
        onClick={() => {
          haptic(taken ? "soft" : "success");
          onToggle();
        }}
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition active:scale-90",
          taken
            ? "border-[var(--mc-peak)] bg-[var(--mc-peak)] text-[#06201b]"
            : "border-[var(--color-stroke-strong)] text-transparent"
        )}
      >
        <Check size={15} strokeWidth={3} />
      </button>
      <span className={cn("flex-1 text-sm", taken ? "text-[var(--color-fg-3)] line-through" : "text-[var(--color-fg)]")}>
        {supplement.name}
        {supplement.dose && (
          <span className="ml-1.5 text-xs text-[var(--color-fg-3)]">{supplement.dose}</span>
        )}
      </span>
      <button
        type="button"
        aria-label="Remove"
        onClick={() => {
          haptic("soft");
          onDelete();
        }}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 h-7 w-7 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)] transition"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function Recommendations({
  existing,
  onAdd,
}: {
  existing: SupplementRow[];
  onAdd: (s: Suggestion) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    haptic("tap");
    try {
      const res = await fetch("/api/vitality/supplement-suggest", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError(res.status === 503 ? "AI isn't configured (missing Gemini key)." : "Couldn't get suggestions.");
        return;
      }
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch {
      setError("Couldn't reach the suggester.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-[var(--color-stroke)] pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles size={14} className="text-[var(--mc-peak)]" /> Recommended for you
        </div>
        <Button size="sm" variant="ghost" onClick={fetchSuggestions} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : suggestions ? "Refresh" : "Suggest"}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

      {suggestions && suggestions.length === 0 && !error && (
        <p className="mt-2 text-xs text-[var(--color-fg-3)]">
          Nothing to suggest right now — your stack covers the basics.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {suggestions.map((s) => {
            const have = existingNames.has(s.name.toLowerCase());
            return (
              <li
                key={s.name}
                className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2"
              >
                <div className="flex-1">
                  <div className="text-sm text-[var(--color-fg)]">
                    {s.name}
                    {s.dose && <span className="ml-1.5 text-xs text-[var(--color-fg-3)]">{s.dose}</span>}
                  </div>
                  {s.rationale && (
                    <div className="mt-0.5 text-xs text-[var(--color-fg-2)]">{s.rationale}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={have}
                  onClick={() => {
                    haptic("success");
                    onAdd(s);
                  }}
                >
                  {have ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[10px] text-[var(--color-fg-3)]">
        Suggestions, not medical advice. Check with a professional before starting anything new.
      </p>
    </div>
  );
}
