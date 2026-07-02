"use client";

import * as React from "react";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

/**
 * Full server-side data export — pulls every user-scoped table from Neon
 * (not just the local Zustand snapshot the "Backup" card serializes). JSON is
 * the complete archive; CSV is a spreadsheet-friendly daily rollup. OAuth
 * tokens are redacted server-side; on-device photo/audio blobs aren't included.
 */
export function DataExportCard() {
  const [busy, setBusy] = React.useState<null | "json" | "csv">(null);
  const [status, setStatus] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 2600);
    return () => window.clearTimeout(t);
  }, [status]);

  const download = async (format: "json" | "csv") => {
    setBusy(format);
    haptic("tap");
    try {
      const res = await fetch(`/api/data/export?format=${format}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download =
        format === "json"
          ? `life-os-export-${stamp}.json`
          : `life-os-daily-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ kind: "ok", text: "Downloaded." });
      haptic("success");
    } catch {
      setStatus({ kind: "err", text: "Export failed. Try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
        {status ? (
          <span
            className={
              "text-xs " +
              (status.kind === "ok"
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]")
            }
          >
            {status.text}
          </span>
        ) : (
          <Download size={14} className="text-[var(--color-accent)]" />
        )}
      </CardHeader>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={busy != null}
          onClick={() => download("json")}
        >
          {busy === "json" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileJson size={15} />
          )}
          Everything (JSON)
        </Button>
        <Button
          variant="secondary"
          disabled={busy != null}
          onClick={() => download("csv")}
        >
          {busy === "csv" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={15} />
          )}
          Daily log (CSV)
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-fg-3)] leading-relaxed">
        Your whole account from the server — workouts, nutrition, body comp,
        vitals, caffeine, supplements, hydration, journals, and mentor memory.
        It&rsquo;s yours to keep. OAuth tokens are stripped; on-device photos
        and voice audio stay on the device.
      </p>
    </Card>
  );
}
