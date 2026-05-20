"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { getPhoto, deletePhoto } from "@/lib/photo-store";
import { format, fromDateStr } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import {
  deleteBodyPhotoSession,
  updateBodyPhotoSession,
  useBodyPhotoSessions,
  type BodyPhotoEntry,
  type BodyPhotoSessionRow,
} from "@/lib/hooks/use-body-photo-sessions";

type Angle = "front" | "side" | "back";
const ANGLES: Angle[] = ["front", "side", "back"];
const ANGLE_LABEL: Record<Angle, string> = {
  front: "Front",
  side: "Side",
  back: "Back",
};

type View =
  | { kind: "detail" }
  | { kind: "compare-pick" }
  | { kind: "compare"; otherId: string }
  | { kind: "scrub-pick" }
  | { kind: "scrub"; angle: Angle };

/**
 * Photo session detail + compare + scrub. One modal with three internal
 * views so we share session/photo loading instead of three near-duplicate
 * sheets:
 *   • detail       — the tapped session's photos grouped by angle,
 *                    editable notes, delete, and the buttons that open
 *                    the other two views.
 *   • compare-pick → compare(other) — side-by-side, angle-matched.
 *   • scrub-pick   → scrub(angle)   — swipe/slider through every session
 *                    that has that angle, chronological.
 */
export function PhotoSessionDetailModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const { sessions } = useBodyPhotoSessions();
  const [view, setView] = React.useState<View>({ kind: "detail" });
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const session = React.useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );

  // Reset to detail view whenever the modal opens for a new session.
  React.useEffect(() => {
    if (sessionId) setView({ kind: "detail" });
  }, [sessionId]);

  if (!sessionId || !session) {
    return <Modal open={false} onClose={onClose}>{null}</Modal>;
  }

  const title =
    view.kind === "detail"
      ? format(fromDateStr(session.date), "MMM d, yyyy")
      : view.kind.startsWith("compare")
        ? "Compare sessions"
        : "Scrub through time";

  const onBack = () => setView({ kind: "detail" });

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={title}
        size="lg"
        description={
          view.kind === "detail"
            ? session.captureDate !== session.date
              ? `Captured ${format(fromDateStr(session.captureDate), "MMM d")} · attributed to ${format(fromDateStr(session.date), "MMM d")}`
              : undefined
            : undefined
        }
      >
        {/* Back-arrow strip for non-detail views. The Modal's own X
            closes the whole sheet; this just pops one level. */}
        {view.kind !== "detail" && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--color-fg-2)] hover:text-[var(--color-fg)] h-9 px-2 -ml-2 rounded-lg"
            aria-label="Back"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        )}

        {view.kind === "detail" && (
          <DetailView
            session={session}
            otherSessions={sessions.filter((s) => s.id !== session.id)}
            onOpenCompare={() => setView({ kind: "compare-pick" })}
            onOpenScrub={() => setView({ kind: "scrub-pick" })}
            onAskDelete={() => setConfirmDelete(true)}
          />
        )}

        {view.kind === "compare-pick" && (
          <SessionPickerView
            sessions={sessions.filter((s) => s.id !== session.id)}
            onPick={(otherId) => setView({ kind: "compare", otherId })}
          />
        )}

        {view.kind === "compare" && (
          <CompareView
            sessionA={session}
            sessionB={
              sessions.find((s) => s.id === view.otherId) ?? null
            }
          />
        )}

        {view.kind === "scrub-pick" && (
          <AnglePickerView
            session={session}
            sessions={sessions}
            onPick={(angle) => setView({ kind: "scrub", angle })}
          />
        )}

        {view.kind === "scrub" && (
          <ScrubView angle={view.angle} sessions={sessions} />
        )}
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this session?"
        description="The photos on this device will also be removed. Can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          // Wipe the IDB blobs first; the row delete cascades on the
          // server side but the photo bytes are device-local.
          const entries =
            (session.photoKeys as BodyPhotoEntry[] | null) ?? [];
          for (const e of entries) {
            await deletePhoto(e.key).catch(() => {});
          }
          await deleteBodyPhotoSession(session.id);
          haptic("warn");
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}

// ── Detail view ────────────────────────────────────────────────────────────

function DetailView({
  session,
  otherSessions,
  onOpenCompare,
  onOpenScrub,
  onAskDelete,
}: {
  session: BodyPhotoSessionRow;
  otherSessions: BodyPhotoSessionRow[];
  onOpenCompare: () => void;
  onOpenScrub: () => void;
  onAskDelete: () => void;
}) {
  const entries = (session.photoKeys as BodyPhotoEntry[] | null) ?? [];
  const [notes, setNotes] = React.useState(session.notes ?? "");
  const dirty = (session.notes ?? "") !== notes;

  // Group by angle; "loose" (no angle) bucketed under their own list.
  const byAngle = new Map<Angle, BodyPhotoEntry>();
  const loose: BodyPhotoEntry[] = [];
  for (const e of entries) {
    if (e.angle && !byAngle.has(e.angle)) byAngle.set(e.angle, e);
    else if (e.angle) loose.push(e);
    else loose.push(e);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {ANGLES.map((angle) => (
          <PhotoTile
            key={angle}
            keyName={byAngle.get(angle)?.key ?? null}
            label={ANGLE_LABEL[angle]}
          />
        ))}
      </div>

      {loose.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {loose.map((e) => (
            <PhotoTile key={e.key} keyName={e.key} label="" />
          ))}
        </div>
      )}

      <div>
        <label className="label mb-2 block">Notes</label>
        <Textarea
          rows={2}
          value={notes}
          placeholder="e.g. post-cut, start of bulk"
          onChange={(e) => setNotes(e.target.value)}
        />
        {dirty && (
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={async () => {
                await updateBodyPhotoSession(session.id, {
                  notes: notes.trim() || null,
                });
                haptic("success");
              }}
            >
              Save notes
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={onOpenCompare}
          disabled={otherSessions.length === 0}
          title={
            otherSessions.length === 0
              ? "Need at least two sessions to compare"
              : undefined
          }
        >
          Compare
        </Button>
        <Button variant="secondary" onClick={onOpenScrub}>
          Scrub timeline
        </Button>
      </div>

      <div className="pt-2 border-t border-[var(--color-stroke)]">
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={onAskDelete}
        >
          <Trash2 size={13} />
          Delete this session
        </Button>
      </div>
    </div>
  );
}

// ── Compare view (two sessions, angle-matched) ─────────────────────────────

function CompareView({
  sessionA,
  sessionB,
}: {
  sessionA: BodyPhotoSessionRow;
  sessionB: BodyPhotoSessionRow | null;
}) {
  if (!sessionB) {
    return (
      <p className="text-sm text-[var(--color-fg-2)]">
        That session is gone.
      </p>
    );
  }
  const aByAngle = entriesByAngle(sessionA);
  const bByAngle = entriesByAngle(sessionB);
  const dateA = format(fromDateStr(sessionA.date), "MMM d, yyyy");
  const dateB = format(fromDateStr(sessionB.date), "MMM d, yyyy");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-3)]">
        <div className="text-center">{dateA}</div>
        <div className="text-center">{dateB}</div>
      </div>
      <div className="space-y-3">
        {ANGLES.map((angle) => {
          const a = aByAngle.get(angle);
          const b = bByAngle.get(angle);
          if (!a && !b) return null;
          return (
            <div key={angle}>
              <div className="label mb-1 text-[9px]">{ANGLE_LABEL[angle]}</div>
              <div className="grid grid-cols-2 gap-2">
                <PhotoTile keyName={a?.key ?? null} label="" />
                <PhotoTile keyName={b?.key ?? null} label="" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scrub view (single angle, chronological across all sessions) ───────────

function ScrubView({
  angle,
  sessions,
}: {
  angle: Angle;
  sessions: BodyPhotoSessionRow[];
}) {
  // Oldest → newest so the slider scrubs intuitively left-to-right.
  const series = React.useMemo(() => {
    const out: Array<{ sessionId: string; date: string; key: string }> = [];
    for (const s of sessions) {
      const entries = (s.photoKeys as BodyPhotoEntry[] | null) ?? [];
      const match = entries.find((e) => e.angle === angle);
      if (match) out.push({ sessionId: s.id, date: s.date, key: match.key });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [angle, sessions]);

  const [idx, setIdx] = React.useState(Math.max(0, series.length - 1));

  React.useEffect(() => {
    // Snap to most recent when the angle changes.
    setIdx(Math.max(0, series.length - 1));
  }, [series.length]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-[var(--color-fg-2)]">
        No {ANGLE_LABEL[angle].toLowerCase()} photos saved yet.
      </p>
    );
  }

  const current = series[idx];
  const canPrev = idx > 0;
  const canNext = idx < series.length - 1;

  return (
    <div className="space-y-3">
      <div className="label text-center">{ANGLE_LABEL[angle]}</div>
      <div className="mx-auto" style={{ width: "min(100%, 320px)" }}>
        <PhotoTile keyName={current.key} label="" aspect="3/4" />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-3)] tabular-nums">
        <span>{format(fromDateStr(series[0].date), "MMM d, yyyy")}</span>
        <span
          className="text-[var(--color-fg-2)] font-medium"
          aria-live="polite"
        >
          {format(fromDateStr(current.date), "MMM d, yyyy")}
        </span>
        <span>
          {format(fromDateStr(series[series.length - 1].date), "MMM d, yyyy")}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={series.length - 1}
        value={idx}
        onChange={(e) => setIdx(parseInt(e.target.value, 10))}
        aria-label="Scrub timeline"
        className="w-full accent-[var(--color-accent)]"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && setIdx(idx - 1)}
          disabled={!canPrev}
          className="h-11 w-11 grid place-items-center rounded-full text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition disabled:opacity-30"
          aria-label="Earlier"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-[11px] text-[var(--color-fg-3)] tabular-nums">
          {idx + 1} / {series.length}
        </span>
        <button
          type="button"
          onClick={() => canNext && setIdx(idx + 1)}
          disabled={!canNext}
          className="h-11 w-11 grid place-items-center rounded-full text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)] transition disabled:opacity-30"
          aria-label="Later"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Pickers ────────────────────────────────────────────────────────────────

function SessionPickerView({
  sessions,
  onPick,
}: {
  sessions: BodyPhotoSessionRow[];
  onPick: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-[var(--color-fg-2)]">
        No other sessions yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {sessions.map((s) => {
        const entries = (s.photoKeys as BodyPhotoEntry[] | null) ?? [];
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s.id)}
              className="w-full text-left rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2.5 flex items-center gap-3 hover:border-[var(--color-stroke-strong)] transition"
            >
              <div className="flex gap-1.5 shrink-0">
                {entries.slice(0, 3).map((e) => (
                  <MiniThumb key={e.key} keyName={e.key} />
                ))}
                {entries.length === 0 && (
                  <div className="h-10 w-8 rounded-md border border-dashed border-[var(--color-stroke)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tnum text-[var(--color-fg)]">
                  {format(fromDateStr(s.date), "MMM d, yyyy")}
                </div>
                <div className="text-[11px] text-[var(--color-fg-3)] truncate">
                  {entries.length} photo{entries.length === 1 ? "" : "s"}
                  {s.notes ? ` · ${s.notes}` : ""}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AnglePickerView({
  session,
  sessions,
  onPick,
}: {
  session: BodyPhotoSessionRow;
  sessions: BodyPhotoSessionRow[];
  onPick: (angle: Angle) => void;
}) {
  // Show only angles that have ≥2 photos across all sessions — single-
  // photo timelines aren't worth a scrub UI.
  const counts: Record<Angle, number> = { front: 0, side: 0, back: 0 };
  for (const s of sessions) {
    const entries = (s.photoKeys as BodyPhotoEntry[] | null) ?? [];
    for (const e of entries) {
      if (e.angle) counts[e.angle] += 1;
    }
  }
  void session; // currently unused; kept so future view can preselect
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-[var(--color-fg-2)]">
        Pick an angle to scrub through.
      </p>
      {ANGLES.map((angle) => {
        const n = counts[angle];
        return (
          <button
            key={angle}
            type="button"
            disabled={n < 2}
            onClick={() => onPick(angle)}
            className="w-full text-left rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2.5 flex items-center justify-between hover:border-[var(--color-stroke-strong)] transition disabled:opacity-40"
          >
            <span className="text-sm font-medium text-[var(--color-fg)]">
              {ANGLE_LABEL[angle]}
            </span>
            <span className="text-[11px] text-[var(--color-fg-3)] tabular-nums">
              {n} session{n === 1 ? "" : "s"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Photo tiles ────────────────────────────────────────────────────────────

function PhotoTile({
  keyName,
  label,
  aspect = "3/4",
}: {
  keyName: string | null;
  label: string;
  aspect?: string;
}) {
  const url = useBlobUrl(keyName);
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--color-stroke)] bg-[var(--color-elevated)] relative"
      style={{ aspectRatio: aspect }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label || "Body photo"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full grid place-items-center text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-3)]">
          {label || "—"}
        </div>
      )}
      {label && url && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] uppercase tracking-[0.14em] text-white">
          {label}
        </div>
      )}
    </div>
  );
}

function MiniThumb({ keyName }: { keyName: string }) {
  const url = useBlobUrl(keyName);
  return (
    <div className="h-10 w-8 rounded-md overflow-hidden bg-[var(--color-card)] border border-[var(--color-stroke)] shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

function useBlobUrl(key: string | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    let alive = true;
    let created: string | null = null;
    getPhoto(key)
      .then((blob) => {
        if (!alive || !blob) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [key]);
  return url;
}

function entriesByAngle(session: BodyPhotoSessionRow): Map<Angle, BodyPhotoEntry> {
  const out = new Map<Angle, BodyPhotoEntry>();
  const entries = (session.photoKeys as BodyPhotoEntry[] | null) ?? [];
  for (const e of entries) {
    if (e.angle && !out.has(e.angle)) out.set(e.angle, e);
  }
  return out;
}
