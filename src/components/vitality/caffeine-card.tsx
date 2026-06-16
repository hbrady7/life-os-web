"use client";

import * as React from "react";
import { Trash2, Plus, Coffee, Settings2, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import {
  useUserSettings,
  saveSettings,
} from "@/lib/hooks/use-settings";
import {
  readVitalitySettings,
  type VitalitySettings,
  type CaffeinePreset,
} from "@/lib/vitality";
import {
  useCaffeine,
  createCaffeineItem,
  deleteCaffeineItem,
} from "@/lib/hooks/use-caffeine";

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ap = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}:${m}${ap}`;
}

export function CaffeineCard({ date }: { date: string }) {
  const { settings } = useUserSettings();
  const v = readVitalitySettings(settings);
  const c = v.caffeine;
  const { logs, totalMg } = useCaffeine(date);

  const [customMg, setCustomMg] = React.useState("");
  const [customLabel, setCustomLabel] = React.useState("");
  const [editing, setEditing] = React.useState(false);

  const updateCaffeine = (patch: Partial<VitalitySettings["caffeine"]>) => {
    const current = readVitalitySettings(settings);
    saveSettings({
      ...settings,
      vitality: { ...current, caffeine: { ...current.caffeine, ...patch } },
    });
  };

  const log = (mg: number, label?: string) => {
    haptic("tap");
    createCaffeineItem(date, { mg, label });
  };

  const addCustom = () => {
    const mg = parseInt(customMg, 10);
    if (!Number.isFinite(mg) || mg <= 0) return;
    log(mg, customLabel.trim() || undefined);
    setCustomMg("");
    setCustomLabel("");
  };

  const scaleMax = Math.max(c.ceilingMg * 1.05, totalMg);
  const markerPct = Math.min(100, (totalMg / scaleMax) * 100);
  const nowHour = new Date().getHours();
  const banner = caffeineBanner(totalMg, c, nowHour);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Coffee size={15} className="text-[var(--mc-calories)]" /> Caffeine
          </span>
        </CardTitle>
        <button
          type="button"
          aria-label="Adjust caffeine settings"
          onClick={() => setEditing((e) => !e)}
          className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-fg)] transition"
        >
          <Settings2 size={15} />
        </button>
      </CardHeader>

      <div className="flex items-baseline gap-2">
        <span className="text-[32px] font-bold tnum leading-none">{totalMg}</span>
        <span className="text-sm text-[var(--color-fg-2)]">mg today</span>
      </div>

      {/* Zone bar */}
      <div className="mt-3">
        <div className="relative h-3 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-elevated)]">
          <div className="flex h-full w-full">
            <Seg color="var(--mc-fat)" frac={c.sweetSpotMg / scaleMax} />
            <Seg color="var(--mc-calories)" frac={(c.cautionMg - c.sweetSpotMg) / scaleMax} />
            <Seg color="var(--color-warning)" frac={(c.ceilingMg - c.cautionMg) / scaleMax} />
            <Seg color="var(--color-danger)" frac={(scaleMax - c.ceilingMg) / scaleMax} />
          </div>
          <div
            className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[var(--color-fg)] shadow-[0_0_6px_rgba(0,0,0,0.6)]"
            style={{ left: `calc(${markerPct}% - 2px)` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-fg-3)] tnum">
          <span>sweet {c.sweetSpotMg}</span>
          <span>caution {c.cautionMg}</span>
          <span>ceiling {c.ceilingMg}</span>
        </div>
      </div>

      <p className="mt-2 text-xs" style={{ color: banner.color }}>
        {banner.text}
      </p>

      {/* Quick-log presets */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => log(p.mg, p.label)}
            className="rounded-[var(--radius-pill)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs text-[var(--color-fg-2)] transition hover:text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)] active:scale-[0.97]"
          >
            {p.label} <span className="tnum text-[var(--color-fg-3)]">{p.mg}</span>
          </button>
        ))}
      </div>

      {/* Custom log */}
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addCustom();
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          value={customMg}
          onChange={(e) => setCustomMg(e.target.value)}
          placeholder="mg"
          className="w-20"
        />
        <Input
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          placeholder="label (optional)"
        />
        <Button type="submit" size="icon" disabled={!customMg} aria-label="Log caffeine">
          <Plus size={18} />
        </Button>
      </form>

      {/* Log list */}
      {logs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {logs
            .slice()
            .reverse()
            .map((l) => (
              <li
                key={l.id}
                className="group flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2 text-sm"
              >
                <span className="flex-1 text-[var(--color-fg)]">
                  {l.label || "Caffeine"}
                </span>
                <span className="tnum text-[var(--color-fg-2)]">{l.mg}mg</span>
                <span className="tnum text-xs text-[var(--color-fg-3)]">
                  {fmtTime(new Date(l.loggedAt))}
                </span>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => {
                    haptic("soft");
                    deleteCaffeineItem(date, l.id);
                  }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 h-7 w-7 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)] transition"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
        </ul>
      )}

      {editing && (
        <CaffeineSettings
          c={c}
          onChange={updateCaffeine}
        />
      )}
    </Card>
  );
}

function Seg({ color, frac }: { color: string; frac: number }) {
  return <div style={{ width: `${Math.max(0, frac) * 100}%`, background: color }} />;
}

function caffeineBanner(
  total: number,
  c: VitalitySettings["caffeine"],
  nowHour: number
): { text: string; color: string } {
  const pastCutoff = nowHour >= c.cutoffHour && total > 0;
  if (total >= c.ceilingMg) {
    return { text: `Over the ceiling — ${total}mg. Ease off for today.`, color: "var(--color-danger)" };
  }
  if (total >= c.cautionMg) {
    return {
      text: `Caution zone — ~${Math.round(c.ceilingMg - total)}mg before the ceiling.`,
      color: "var(--color-warning)",
    };
  }
  if (total >= c.sweetSpotMg) {
    return { text: "In the sweet spot.", color: "var(--mc-fat)" };
  }
  const base =
    total === 0
      ? "No caffeine logged yet."
      : `${Math.round(c.sweetSpotMg - total)}mg below your sweet spot.`;
  return {
    text: pastCutoff ? `${base} Past your ${fmtHour12(c.cutoffHour)} cutoff — caffeine now may cost you sleep.` : base,
    color: pastCutoff ? "var(--color-warning)" : "var(--color-fg-2)",
  };
}

function fmtHour12(h: number): string {
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return `${hh}${ap}`;
}

function CaffeineSettings({
  c,
  onChange,
}: {
  c: VitalitySettings["caffeine"];
  onChange: (patch: Partial<VitalitySettings["caffeine"]>) => void;
}) {
  const [newLabel, setNewLabel] = React.useState("");
  const [newMg, setNewMg] = React.useState("");

  const addPreset = () => {
    const mg = parseInt(newMg, 10);
    if (!newLabel.trim() || !Number.isFinite(mg) || mg <= 0) return;
    const next: CaffeinePreset[] = [...c.presets, { label: newLabel.trim(), mg }];
    onChange({ presets: next });
    setNewLabel("");
    setNewMg("");
  };

  return (
    <div className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] p-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Sweet spot (mg)" value={c.sweetSpotMg} onChange={(n) => onChange({ sweetSpotMg: n })} />
        <NumberField label="Caution (mg)" value={c.cautionMg} onChange={(n) => onChange({ cautionMg: n })} />
        <NumberField label="Ceiling (mg)" value={c.ceilingMg} onChange={(n) => onChange({ ceilingMg: n })} />
        <NumberField label="Cutoff hour (0–23)" value={c.cutoffHour} onChange={(n) => onChange({ cutoffHour: Math.max(0, Math.min(23, n)) })} />
      </div>

      <div>
        <div className="label mb-1">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {c.presets.map((p, i) => (
            <span
              key={`${p.label}-${i}`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-stroke)] bg-[var(--color-card)] py-1 pl-2.5 pr-1 text-xs"
            >
              {p.label} <span className="tnum text-[var(--color-fg-3)]">{p.mg}</span>
              <button
                type="button"
                aria-label={`Remove ${p.label}`}
                onClick={() => onChange({ presets: c.presets.filter((_, j) => j !== i) })}
                className="grid h-5 w-5 place-items-center rounded-full text-[var(--color-fg-3)] hover:text-[var(--color-danger)]"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addPreset();
          }}
        >
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Drink" />
          <Input type="number" inputMode="numeric" value={newMg} onChange={(e) => setNewMg(e.target.value)} placeholder="mg" className="w-20" />
          <Button type="submit" size="icon" variant="secondary" disabled={!newLabel.trim() || !newMg} aria-label="Add preset">
            <Plus size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="mt-1"
      />
    </label>
  );
}
