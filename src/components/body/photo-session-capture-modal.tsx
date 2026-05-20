"use client";

import * as React from "react";
import { Camera, Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { compressImage, deletePhoto, putPhoto } from "@/lib/photo-store";
import { uid } from "@/lib/utils";
import { todayStr } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import {
  createBodyPhotoSession,
  type BodyPhotoEntry,
} from "@/lib/hooks/use-body-photo-sessions";
import { targetDateFor } from "@/lib/data/body-photo-sessions";

type Angle = "front" | "side" | "back";

type Draft = {
  angle: Angle | null;
  key: string;
  url: string;
  takenAt: string;
};

const SUGGESTED_ANGLES: Angle[] = ["front", "side", "back"];
const ANGLE_LABEL: Record<Angle, string> = {
  front: "Front",
  side: "Side",
  back: "Back",
};

/**
 * Body composition photo session capture. Three suggested angle slots
 * (front / side / back) plus an "add another" tile for one-offs. Each
 * tap opens the device camera; the file gets compressed, stored in
 * IndexedDB, and the IDB key + angle joins the draft. Save POSTs the
 * session row to Neon with the key list (blobs never leave the device).
 *
 * The attribution date follows targetDateFor() — captures within 3
 * days of the 1st snap to the 1st, within 13–17 to the 15th. Off-
 * window captures attribute to the actual day.
 */
export function PhotoSessionCaptureModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Reset on each open so a stale draft from a discarded session
  // doesn't leak into the next capture.
  React.useEffect(() => {
    if (open) {
      setDrafts([]);
      setNotes("");
    }
  }, [open]);

  // Revoke object URLs when the modal closes / drafts swap so we
  // don't leak blob URLs.
  React.useEffect(() => {
    return () => {
      for (const d of drafts) URL.revokeObjectURL(d.url);
    };
  }, [drafts]);

  const handlePick = (angle: Angle | null) =>
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      try {
        const compressed = await compressImage(file, 1200, 0.85);
        const key = uid();
        await putPhoto(key, compressed);
        const url = URL.createObjectURL(compressed);
        setDrafts((prev) => {
          // Replace existing slot for the same angle (so "retake front"
          // overwrites without piling on).
          const filtered =
            angle != null ? prev.filter((p) => p.angle !== angle) : prev;
          return [
            ...filtered,
            { angle, key, url, takenAt: new Date().toISOString() },
          ];
        });
        haptic("success");
      } finally {
        setBusy(false);
      }
    };

  const removeDraft = async (d: Draft) => {
    URL.revokeObjectURL(d.url);
    await deletePhoto(d.key).catch(() => {});
    setDrafts((prev) => prev.filter((p) => p.key !== d.key));
    haptic("warn");
  };

  const onDiscard = async () => {
    // Discard drafts → delete the IDB blobs we already stored.
    for (const d of drafts) {
      URL.revokeObjectURL(d.url);
      await deletePhoto(d.key).catch(() => {});
    }
    setDrafts([]);
    setNotes("");
    onClose();
  };

  const onSave = async () => {
    if (drafts.length === 0) return;
    setSaving(true);
    try {
      const captureDate = todayStr();
      const date = targetDateFor(captureDate);
      const photoKeys: BodyPhotoEntry[] = drafts.map((d) => ({
        key: d.key,
        angle: d.angle,
        takenAt: d.takenAt,
      }));
      await createBodyPhotoSession({
        date,
        captureDate,
        photoKeys,
        notes: notes.trim() || null,
      });
      // Keep object URLs alive briefly so the list can transition
      // without flickering blanks, but the session lookup re-fetches
      // from IDB on next mount so this is mostly cosmetic.
      haptic("success");
      setDrafts([]);
      setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const byAngle = new Map<Angle, Draft>();
  const loose: Draft[] = [];
  for (const d of drafts) {
    if (d.angle && !byAngle.has(d.angle)) byAngle.set(d.angle, d);
    else loose.push(d);
  }

  return (
    <Modal
      open={open}
      onClose={onDiscard}
      title="Body composition photos"
      description="Front, side, back — capture whichever you can today."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button
            onClick={onSave}
            disabled={drafts.length === 0 || saving}
          >
            {saving ? "Saving…" : `Save (${drafts.length})`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {SUGGESTED_ANGLES.map((angle) => (
            <AngleSlot
              key={angle}
              angle={angle}
              draft={byAngle.get(angle) ?? null}
              onPick={handlePick(angle)}
              onRemove={() => {
                const d = byAngle.get(angle);
                if (d) void removeDraft(d);
              }}
              busy={busy}
            />
          ))}
        </div>

        {loose.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {loose.map((d) => (
              <div
                key={d.key}
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[var(--color-stroke)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.url} alt="Extra angle" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => void removeDraft(d)}
                  className="absolute top-1.5 right-1.5 h-7 w-7 grid place-items-center rounded-full bg-black/60 backdrop-blur text-white"
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <ExtraSlot onPick={handlePick(null)} busy={busy} />

        <div>
          <label htmlFor="photo-session-notes" className="label mb-2 block">
            Notes
          </label>
          <Textarea
            id="photo-session-notes"
            rows={2}
            placeholder="e.g. post-cut, start of bulk, week 4"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <p className="text-[11px] text-[var(--color-fg-3)]">
          Photos stay on this device — only references are saved to your account.
        </p>
      </div>
    </Modal>
  );
}

function AngleSlot({
  angle,
  draft,
  onPick,
  onRemove,
  busy,
}: {
  angle: Angle;
  draft: Draft | null;
  onPick: (file: File | null) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onPick(file);
          // Reset so the same angle can be re-picked.
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={`Capture ${ANGLE_LABEL[angle]}`}
        className="block w-full aspect-[3/4] rounded-xl overflow-hidden border border-[var(--color-stroke)] bg-[var(--color-elevated)] active:scale-[0.98] transition relative"
      >
        {draft ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.url} alt={ANGLE_LABEL[angle]} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-[var(--color-fg-3)]">
            <div className="text-center px-2">
              <Camera size={20} className="mx-auto mb-1.5" />
              <div className="text-[11px] font-medium uppercase tracking-[0.14em]">
                {ANGLE_LABEL[angle]}
              </div>
            </div>
          </div>
        )}
      </button>
      {draft && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 h-7 w-7 grid place-items-center rounded-full bg-black/60 backdrop-blur text-white"
          aria-label={`Remove ${ANGLE_LABEL[angle]}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function ExtraSlot({
  onPick,
  busy,
}: {
  onPick: (file: File | null) => void;
  busy: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onPick(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full h-11 rounded-xl border border-dashed border-[var(--color-stroke-strong)] text-[var(--color-fg-2)] inline-flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition"
      >
        <Plus size={14} />
        Add another angle
      </button>
    </>
  );
}
