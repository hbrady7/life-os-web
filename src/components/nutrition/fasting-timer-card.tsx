"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Hourglass, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/lib/hooks/use-settings";
import {
  useActiveFasting,
  startFast,
  endFast,
} from "@/lib/hooks/use-fasting";
import type { FastingSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

type FastingHostSettings = { fasting?: FastingSettings };

export function FastingTimerCard() {
  const { settings } = useUserSettings<FastingHostSettings & Record<string, unknown>>();
  const { active } = useActiveFasting();

  const targetHours = settings?.fasting?.targetHours ?? 16;
  const enabled = settings?.fasting?.enabled ?? false;

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const [startOpen, setStartOpen] = React.useState(false);

  if (!active && !enabled) {
    return (
      <Link
        href="/settings#fasting"
        className="block text-[11px] text-[var(--color-accent)] active:opacity-70"
      >
        Enable intermittent fasting →
      </Link>
    );
  }

  if (!active) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-card)] p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 grid place-items-center rounded-full bg-[var(--color-elevated)] border border-[var(--color-stroke)]">
              <Hourglass size={18} className="text-[var(--color-fg-2)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-3)] font-medium">
                Fasting
              </div>
              <div className="text-[14px] font-semibold tracking-tight">
                Not fasting · target {targetHours}h
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                haptic("tap");
                setStartOpen(true);
              }}
            >
              <Play size={12} />
              Start
            </Button>
          </div>
        </motion.div>

        <StartFastModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          defaultHours={targetHours}
        />
      </>
    );
  }

  const startedAt = new Date(active.startedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const targetSec = active.targetHours * 3600;
  const pct = Math.min(1, elapsedSec / targetSec);
  const isDone = elapsedSec >= targetSec;
  const overtimeSec = isDone ? elapsedSec - targetSec : 0;

  const SIZE = 120;
  const STROKE = 9;
  const r = SIZE / 2 - STROKE / 2 - 1;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const ringColor = isDone ? "var(--color-success)" : "var(--color-accent)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-2xl border p-4",
        isDone
          ? "border-[color:color-mix(in_srgb,var(--color-success)_36%,var(--color-stroke))]"
          : "border-[color:color-mix(in_srgb,var(--color-accent)_28%,var(--color-stroke))]"
      )}
      style={{
        background: isDone
          ? "linear-gradient(160deg, color-mix(in srgb, var(--color-success) 12%, var(--color-card)) 0%, var(--color-card) 70%)"
          : "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 10%, var(--color-card)) 0%, var(--color-card) 70%)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="relative shrink-0"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeOpacity={0.16}
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{
                transition:
                  "stroke-dashoffset 700ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[20px] font-bold tnum tracking-tight leading-none">
                {fmtClock(elapsedSec)}
              </div>
              <div
                className="text-[9px] uppercase tracking-wider mt-1"
                style={{
                  color: isDone
                    ? "var(--color-success)"
                    : "var(--color-fg-3)",
                }}
              >
                {isDone ? "Target hit" : `of ${active.targetHours}h`}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-3)] font-medium">
            Fasting
          </div>
          <div className="text-[16px] font-bold tnum mt-0.5">
            {Math.round(pct * 100)}%
          </div>
          {isDone && (
            <div className="text-[11px] text-[var(--color-success)] tnum mt-0.5">
              + {fmtClock(overtimeSec)} overtime
            </div>
          )}
          <Button
            size="sm"
            variant={isDone ? "primary" : "secondary"}
            className="mt-2"
            onClick={async () => {
              haptic("success");
              await endFast(active.id);
            }}
          >
            <Square size={12} />
            End fast
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function StartFastModal({
  open,
  onClose,
  defaultHours,
}: {
  open: boolean;
  onClose: () => void;
  defaultHours: number;
}) {
  const [hoursStr, setHoursStr] = React.useState(String(defaultHours));
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setHoursStr(String(defaultHours));
      setSubmitting(false);
    }
  }, [open, defaultHours]);

  const parsed = parseFloat(hoursStr);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 72;

  const onStart = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    haptic("success");
    try {
      await startFast({ targetHours: parsed });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a fast"
      description="Confirm your target window. The timer runs until you tap End fast."
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onStart} disabled={!valid || submitting}>
            Start
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="label mb-2">Target hours</div>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            max={72}
            step="0.5"
            value={hoursStr}
            onChange={(e) => setHoursStr(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[12, 14, 16, 18, 20, 24].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                haptic("tap");
                setHoursStr(String(h));
              }}
              className={cn(
                "h-9 px-3 rounded-full border text-xs transition-colors",
                parsed === h
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "border-[var(--color-stroke)] bg-[var(--color-elevated)] text-[var(--color-fg-2)]"
              )}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}
