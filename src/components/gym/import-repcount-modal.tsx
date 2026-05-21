"use client";

import * as React from "react";
import { AlertTriangle, FileUp, Loader2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";
import { parseRepCountCsv, type ImportResult } from "@/lib/repcount-csv-import";

type Phase =
  | { kind: "idle" }
  | { kind: "parsing"; fileName: string }
  | { kind: "preview"; fileName: string; result: ImportResult }
  | { kind: "importing"; fileName: string; result: ImportResult }
  | { kind: "done"; result: ImportResult }
  | { kind: "error"; message: string };

export function ImportRepCountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const replaceLiftSessions = useStore((s) => s.replaceLiftSessions);

  // Reset phase on close so re-opening starts clean.
  React.useEffect(() => {
    if (!open) {
      // Defer the reset so the closing animation isn't yanked mid-flight.
      const id = window.setTimeout(() => setPhase({ kind: "idle" }), 200);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const onPickFile = (file: File) => {
    setPhase({ kind: "parsing", fileName: file.name });
    // Push the heavy work behind a microtask + idle callback so the
    // modal's loading spinner actually paints before we block the
    // main thread for ~6k rows of parsing.
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      // setTimeout instead of requestIdleCallback for Safari iOS compat.
      window.setTimeout(() => {
        try {
          const result = parseRepCountCsv(text);
          if (result.sessions.length === 0) {
            setPhase({
              kind: "error",
              message:
                "Couldn't find any sessions in that CSV. Make sure it's an unmodified RepCount export.",
            });
            return;
          }
          setPhase({ kind: "preview", fileName: file.name, result });
        } catch (err) {
          setPhase({
            kind: "error",
            message:
              err instanceof Error
                ? `Parse failed: ${err.message}`
                : "Couldn't read that file.",
          });
        }
      }, 16);
    };
    reader.onerror = () => {
      setPhase({
        kind: "error",
        message: "Couldn't read the file. Try picking it again.",
      });
    };
    reader.readAsText(file);
  };

  const onConfirmImport = () => {
    if (phase.kind !== "preview") return;
    const { result, fileName } = phase;
    setPhase({ kind: "importing", fileName, result });

    // Yield once so the "Importing…" state paints, then do the bulk write.
    window.setTimeout(() => {
      const catalog = Object.fromEntries(
        result.catalog.map((c) => [c.normalizedName, c])
      );
      replaceLiftSessions(result.sessions, catalog, new Date().toISOString());
      haptic("success");
      setPhase({ kind: "done", result });
    }, 30);
  };

  const title = (() => {
    switch (phase.kind) {
      case "preview":
        return "Confirm import";
      case "importing":
        return "Importing…";
      case "done":
        return "Import complete";
      case "error":
        return "Couldn't import";
      default:
        return "Import from RepCount";
    }
  })();

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {(phase.kind === "idle" || phase.kind === "parsing") && (
        <IdleState
          phase={phase}
          fileInputRef={fileInputRef}
          onPickFile={onPickFile}
        />
      )}
      {phase.kind === "preview" && (
        <PreviewState
          result={phase.result}
          fileName={phase.fileName}
          onCancel={onClose}
          onConfirm={onConfirmImport}
          onPickAgain={() => fileInputRef.current?.click()}
        />
      )}
      {phase.kind === "importing" && (
        <ImportingState count={phase.result.summary.sets} />
      )}
      {phase.kind === "done" && (
        <DoneState result={phase.result} onClose={onClose} />
      )}
      {phase.kind === "error" && (
        <ErrorState
          message={phase.message}
          onRetry={() => fileInputRef.current?.click()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Reset the value so picking the same file again re-fires the change event.
          e.target.value = "";
          if (f) onPickFile(f);
        }}
      />
    </Modal>
  );
}

/* ─── Phase states ────────────────────────────────────────────────── */

function IdleState({
  phase,
  fileInputRef,
  onPickFile,
}: {
  phase: { kind: "idle" } | { kind: "parsing"; fileName: string };
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: (f: File) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const isParsing = phase.kind === "parsing";
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-fg-2)] leading-relaxed">
        Pick the CSV you exported from RepCount. We&rsquo;ll preview the
        contents before anything gets written.
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onPickFile(file);
        }}
        className={
          "rounded-[var(--radius-card)] border border-dashed p-6 flex flex-col items-center text-center transition " +
          (dragging
            ? "border-[var(--color-accent)] bg-[color:color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
            : "border-[var(--color-stroke-strong)]")
        }
      >
        {isParsing ? (
          <>
            <Loader2
              size={20}
              className="text-[var(--color-accent)] animate-spin"
            />
            <p className="mt-2 text-sm text-[var(--color-fg-2)]">
              Parsing {phase.fileName}…
            </p>
          </>
        ) : (
          <>
            <FileUp size={20} className="text-[var(--color-fg-3)]" />
            <p className="mt-2 text-sm text-[var(--color-fg-2)]">
              Drop a CSV here, or
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              Choose file
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-[var(--color-fg-3)] leading-relaxed">
        Importing replaces all existing gym sessions. Your active in-progress
        workout (if any) isn&rsquo;t touched.
      </p>
    </div>
  );
}

function PreviewState({
  result,
  fileName,
  onCancel,
  onConfirm,
  onPickAgain,
}: {
  result: ImportResult;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
  onPickAgain: () => void;
}) {
  const { summary, warnings } = result;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-fg-2)]">
        Found in <span className="text-[var(--color-fg)]">{fileName}</span>:
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Workouts" value={summary.workouts} />
        <Stat label="Exercises" value={summary.exercises} />
        <Stat label="Sets" value={summary.sets} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Cardio sets" value={summary.cardioSets} />
        <Stat
          label="Date range"
          value={
            summary.dateRange
              ? `${formatShortDate(summary.dateRange.start)} – ${formatShortDate(summary.dateRange.end)}`
              : "—"
          }
          mono
        />
      </div>
      {summary.unloadedSets > 0 && (
        <p className="text-[11px] text-[var(--color-fg-3)] leading-relaxed">
          {summary.unloadedSets} set{summary.unloadedSets === 1 ? "" : "s"} had
          missing weight/reps and will be stored as 0. They won&rsquo;t affect
          volume / PR math.
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2 text-[11px] text-[var(--color-warning)] leading-relaxed flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{warnings[0]}</span>
        </div>
      )}
      <div className="rounded-lg border border-[var(--color-stroke-strong)] bg-[var(--color-elevated)] px-3 py-2 text-[12px] text-[var(--color-fg-2)] leading-snug">
        Confirming will <span className="text-[var(--color-fg)] font-medium">replace</span> all existing gym sessions and records with this data.
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onPickAgain}>
          Pick different file
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Import</Button>
      </div>
    </div>
  );
}

function ImportingState({ count }: { count: number }) {
  return (
    <div className="py-6 flex flex-col items-center text-center">
      <Loader2 size={20} className="text-[var(--color-accent)] animate-spin" />
      <p className="mt-3 text-sm text-[var(--color-fg-2)]">
        Importing {count.toLocaleString()} set{count === 1 ? "" : "s"}…
      </p>
    </div>
  );
}

function DoneState({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  const { summary } = result;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-fg-2)]">
        Imported{" "}
        <span className="text-[var(--color-fg)] font-medium">
          {summary.workouts.toLocaleString()}
        </span>{" "}
        workouts ·{" "}
        <span className="text-[var(--color-fg)] font-medium">
          {summary.exercises.toLocaleString()}
        </span>{" "}
        exercises ·{" "}
        <span className="text-[var(--color-fg)] font-medium">
          {summary.sets.toLocaleString()}
        </span>{" "}
        sets.
      </p>
      {summary.dateRange && (
        <p className="text-xs text-[var(--color-fg-3)] tnum">
          {formatShortDate(summary.dateRange.start)} →{" "}
          {formatShortDate(summary.dateRange.end)}
        </p>
      )}
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-danger)] leading-relaxed">
        {message}
      </p>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try another file
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2">
      <div className="label text-[9px]">{label}</div>
      <div
        className={
          "mt-0.5 text-[15px] font-semibold text-[var(--color-fg)] " +
          (mono ? "tnum" : "")
        }
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  // YYYY-MM-DD → "Oct 2022" style for the date range chip.
  const [y, m] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return iso;
  return `${months[monthIdx]} ${y}`;
}
