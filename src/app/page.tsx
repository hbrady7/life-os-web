"use client";

import * as React from "react";
import { Header } from "@/components/header";
import { Goals } from "@/components/goals";
import { ListSection } from "@/components/list-section";
import { ExportImport } from "@/components/export-import";
import { Overseer } from "@/components/overseer";
import { useLifeOS } from "@/lib/store";

export default function Page() {
  const { data, update, replace, hydrated } = useLifeOS();

  if (!hydrated) {
    return (
      <main className="min-h-dvh grid place-items-center text-[var(--color-fg-dim)] text-sm">
        Loading…
      </main>
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-[560px] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[8.5rem]"
    >
      <div className="space-y-4">
        <Header data={data} onChange={(patch) => update((p) => ({ ...p, ...patch }))} />

        <Goals
          goals={data.goals}
          onChange={(goals) => update((p) => ({ ...p, goals }))}
        />

        <ListSection
          title="Plan Tomorrow"
          placeholder="Add to tomorrow"
          bullet="dot"
          items={data.planTomorrow}
          onChange={(planTomorrow) =>
            update((p) => ({ ...p, planTomorrow }))
          }
        />

        <ListSection
          title="Wins & Positives"
          placeholder="What went well?"
          bullet="plus"
          items={data.wins}
          onChange={(wins) => update((p) => ({ ...p, wins }))}
        />

        <ListSection
          title="Current Struggles"
          placeholder="Name what's hard"
          bullet="minus"
          items={data.struggles}
          onChange={(struggles) => update((p) => ({ ...p, struggles }))}
        />

        <ExportImport data={data} onReplace={replace} />

        <p className="pt-2 pb-4 text-center text-[11px] text-[var(--color-fg-dim)]">
          Life OS · local-first
        </p>
      </div>

      <Overseer context={data} />
    </main>
  );
}
