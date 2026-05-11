"use client";

import * as React from "react";
import { Download, Upload } from "lucide-react";
import { LifeOSData, defaultData } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "./ui/card";

type Props = {
  data: LifeOSData;
  onReplace: (next: LifeOSData) => void;
};

export function ExportImport({ data, onReplace }: Props) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState<null | {
    kind: "ok" | "err";
    text: string;
  }>(null);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-os-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: "ok", text: "Exported." });
  };

  const onImportClick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<LifeOSData>;
      const merged: LifeOSData = { ...defaultData(), ...parsed };
      onReplace(merged);
      setStatus({ kind: "ok", text: "Restored from file." });
    } catch {
      setStatus({ kind: "err", text: "Couldn't read that file." });
    }
  };

  React.useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(t);
  }, [status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
        {status && (
          <span
            className={`text-xs ${
              status.kind === "ok"
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {status.text}
          </span>
        )}
      </CardHeader>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onExport}
          className="h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)] active:scale-[0.99] transition text-sm font-medium"
        >
          <Download size={16} />
          Export JSON
        </button>
        <button
          type="button"
          onClick={onImportClick}
          className="h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)] active:scale-[0.99] transition text-sm font-medium"
        >
          <Upload size={16} />
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFile}
        />
      </div>
      <p className="mt-3 text-xs text-[var(--color-fg-dim)]">
        All your data lives in this browser's local storage. Export a copy
        before clearing site data.
      </p>
    </Card>
  );
}
