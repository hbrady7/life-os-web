"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Factory, ChevronDown, Loader2 } from "lucide-react";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { format, fromDateStr } from "@/lib/date";
import type { DailyLearningRow } from "@/lib/data/daily-learnings";

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function fmtDate(date: string): string {
  return format(fromDateStr(date), "EEE, MMM d");
}

export function MadeClient({
  today,
  archive,
}: {
  today: DailyLearningRow | null;
  archive: DailyLearningRow[];
}) {
  const router = useRouter();
  const [regenerating, setRegenerating] = React.useState(false);

  const regenerate = async () => {
    setRegenerating(true);
    haptic("tap");
    try {
      const res = await fetch("/api/mind/made/regenerate", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) router.refresh();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Screen title="How it's made" subtitle="One ordinary thing, explained — fresh each day.">
      {today ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[var(--mc-peak)]">
            <Factory size={15} />
            <span className="label" style={{ color: "var(--mc-peak)" }}>
              {fmtDate(today.date)}
            </span>
          </div>
          <h2 className="mt-2 text-[24px] font-bold tracking-tight">{today.subject}</h2>
          <div className="mt-3 space-y-3">
            {paragraphs(today.body).map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-[var(--color-fg-2)]">
                {p}
              </p>
            ))}
          </div>
          <div className="mt-4">
            <Button size="sm" variant="ghost" onClick={regenerate} disabled={regenerating}>
              {regenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              Regenerate today
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-center">
          <p className="text-sm text-[var(--color-fg-2)]">
            Couldn&apos;t generate today&apos;s entry. Check the Gemini key, then try again.
          </p>
          <Button size="sm" className="mt-3" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Try again
          </Button>
        </Card>
      )}

      {archive.length > 0 && (
        <div>
          <div className="label mb-2 mt-1">Archive</div>
          <div className="space-y-1.5">
            {archive.map((row) => (
              <ArchiveItem key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}

function ArchiveItem({ row }: { row: DailyLearningRow }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--color-fg)]">{row.subject}</div>
          <div className="text-[11px] text-[var(--color-fg-3)]">{fmtDate(row.date)}</div>
        </div>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-[var(--color-fg-3)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          {paragraphs(row.body).map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-[var(--color-fg-2)]">
              {p}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
