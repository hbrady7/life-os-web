"use client";

import * as React from "react";
import useSWR from "swr";
import { Loader2, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

type Status = {
  needsPrompt: boolean;
  importedAt: string | null;
  skipped: boolean;
};

type Counts = Record<string, number>;

const LIFE_OS_KEY = "life-os:v2";

/**
 * One-time prompt that runs after sign-in. If the device still has the
 * old Zustand-persisted state under `life-os:v2`, offers to import it
 * into Neon. Three actions: Import / Skip (never ask again) / Decide
 * later (defer).
 *
 * The prompt is gated by the server (`/api/data/import/status` reads
 * users.importedAt + importSkipped), so on a second device with no
 * localStorage data the modal stays closed regardless.
 */
export function ImportModal() {
  const { data: status, mutate: refreshStatus } = useSWR<Status>(
    "/api/data/import/status"
  );

  // Detect local Zustand state. We render the modal only when the server
  // says "needs prompt" AND there's actually something on this device to
  // import — otherwise it's noise.
  const [hasLocal, setHasLocal] = React.useState<boolean>(false);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIFE_OS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Zustand persist wraps state under { state, version }. We accept
      // either form just in case.
      const state = parsed?.state ?? parsed;
      setHasLocal(Boolean(state) && Object.keys(state).length > 0);
    } catch {
      setHasLocal(false);
    }
  }, []);

  const shouldShow = status?.needsPrompt === true && hasLocal;

  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    setOpen(shouldShow);
  }, [shouldShow]);

  const [phase, setPhase] = React.useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const onImport = async () => {
    setPhase("running");
    setErrorText(null);
    try {
      const raw = window.localStorage.getItem(LIFE_OS_KEY);
      if (!raw) throw new Error("no local data found");
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import", payload: state }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { counts: Counts };
      setCounts(json.counts);
      setPhase("done");
      haptic("success");
      // Clear Zustand state — Neon is now the source of truth. We
      // intentionally do NOT touch IndexedDB (photos / audio stay).
      window.localStorage.removeItem(LIFE_OS_KEY);
      await refreshStatus();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "import failed");
      setPhase("error");
      haptic("error");
    }
  };

  const onSkip = async () => {
    haptic("warn");
    await fetch("/api/data/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "skip" }),
    });
    setOpen(false);
    await refreshStatus();
  };

  const onLater = () => {
    haptic("tap");
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={onLater}
      title="Import existing data?"
      description={
        phase === "done"
          ? "Imported."
          : "We found existing data on this device. Bring it into your account?"
      }
      size="md"
      footer={
        phase === "done" ? (
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onLater}
              disabled={phase === "running"}
            >
              Decide later
            </Button>
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={phase === "running"}
            >
              Skip
            </Button>
            <Button onClick={onImport} disabled={phase === "running"}>
              {phase === "running" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Import
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-3 text-sm text-[var(--color-fg-2)]">
        {phase === "idle" && (
          <>
            <p>
              Your habits, goals, journal, vitals, and routines on this
              device will be moved into your account so they appear on every
              device you sign in from.
            </p>
            <p className="text-[12px] text-[var(--color-fg-3)]">
              Photos and voice recordings stay on this device — they&rsquo;re
              kept in local storage and aren&rsquo;t uploaded.
            </p>
          </>
        )}
        {phase === "running" && (
          <p className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Importing…
          </p>
        )}
        {phase === "done" && counts && (
          <ul className="grid grid-cols-2 gap-2 text-[12px]">
            {Object.entries(counts)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <li
                  key={k}
                  className="rounded-lg border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-2 py-1.5"
                >
                  <span className="label text-[9px]">{humanize(k)}</span>
                  <span className="ml-2 tnum text-[var(--color-fg)]">{n}</span>
                </li>
              ))}
          </ul>
        )}
        {phase === "error" && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[color:color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
            <div className="inline-flex items-center gap-1.5">
              <X size={12} />
              Import failed.
            </div>
            <div className="mt-1 text-[var(--color-fg-2)]">
              {errorText}
              <br />
              Your local data is untouched — try again or skip.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function humanize(camel: string): string {
  return camel
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
