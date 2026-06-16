"use client";

import * as React from "react";
import Link from "next/link";
import { Lightbulb, Quote, Factory, ChevronRight } from "lucide-react";
import { Screen } from "@/components/screen";

const SECTIONS = [
  {
    href: "/mind/ideas",
    label: "Ideas",
    desc: "The board for everything you're sitting on.",
    Icon: Lightbulb,
    color: "var(--mc-energy)",
  },
  {
    href: "/mind/quotes",
    label: "Quotes",
    desc: "The smartest things you've heard.",
    Icon: Quote,
    color: "var(--mc-water)",
  },
  {
    href: "/mind/made",
    label: "How it's made",
    desc: "One ordinary thing, explained — fresh every day.",
    Icon: Factory,
    color: "var(--mc-peak)",
  },
] as const;

export function MindHub() {
  return (
    <Screen title="Mind" subtitle="Ideas, quotes, and a daily curiosity.">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} className="block">
          <div className="card card-hover flex items-center gap-3 p-4">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-control)]"
              style={{ background: `color-mix(in srgb, ${s.color} 16%, var(--color-card))`, color: s.color }}
            >
              <s.Icon size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-[var(--color-fg)]">{s.label}</div>
              <div className="text-xs text-[var(--color-fg-2)]">{s.desc}</div>
            </div>
            <ChevronRight size={18} className="text-[var(--color-fg-3)]" />
          </div>
        </Link>
      ))}
    </Screen>
  );
}
