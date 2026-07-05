"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Apple,
  BookOpen,
  Droplets,
  Dumbbell,
  Scale,
  SmilePlus,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { haptic } from "@/lib/haptics";

/**
 * The center-button sheet. v0 routes to each domain's logging surface;
 * the quick-log phase upgrades these tiles to inline one-tap logging.
 */
const ACTIONS = [
  { label: "Water", sub: "Log a glass", href: "/vitality", Icon: Droplets, mc: "var(--mc-water)" },
  { label: "Meal", sub: "Food or photo", href: "/nutrition", Icon: Apple, mc: "var(--mc-calories)" },
  { label: "Workout", sub: "Start a session", href: "/gym", Icon: Dumbbell, mc: "var(--pillar-strain)" },
  { label: "Mood", sub: "How you feel", href: "/", Icon: SmilePlus, mc: "var(--mc-mood)" },
  { label: "Weight", sub: "Morning weigh-in", href: "/body", Icon: Scale, mc: "var(--mc-weight)" },
  { label: "Journal", sub: "Capture a thought", href: "/journal", Icon: BookOpen, mc: "var(--mc-sleep)" },
] as const;

export function QuickLogSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Modal open={open} onClose={onClose} title="Log" size="md">
      <div className="grid grid-cols-2 gap-2 pb-1">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              haptic("tap");
              onClose();
              router.push(a.href);
            }}
            className="flex items-center gap-3 p-3.5 rounded-[var(--radius-control)] bg-[var(--color-elevated)] border border-[var(--color-stroke)] hover:border-[var(--color-stroke-strong)] active:scale-[0.98] transition text-left accent-ring"
          >
            <span
              className="h-10 w-10 shrink-0 grid place-items-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${a.mc} 14%, transparent)`,
                color: a.mc,
              }}
            >
              <a.Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{a.label}</span>
              <span className="block text-xs text-[var(--color-fg-3)] truncate">
                {a.sub}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
