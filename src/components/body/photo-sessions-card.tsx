"use client";

import * as React from "react";
import { Camera } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPhoto } from "@/lib/photo-store";
import { format, fromDateStr } from "@/lib/date";
import { haptic } from "@/lib/haptics";
import {
  useBodyPhotoSessions,
  type BodyPhotoEntry,
  type BodyPhotoSessionRow,
} from "@/lib/hooks/use-body-photo-sessions";
import { PhotoSessionCaptureModal } from "./photo-session-capture-modal";

/**
 * Lists existing body photo sessions (most recent first) + a "Take
 * progress photos" button. Each row is a thumbnail strip of up to 3
 * photos from that session. Empty state explains the 1st/15th cadence.
 *
 * Tapping a row is wired to open a detail view — that comes in
 * Commit 3 (comparison view). For now taps no-op.
 */
export function PhotoSessionsCard() {
  const { sessions, isLoading } = useBodyPhotoSessions();
  const [captureOpen, setCaptureOpen] = React.useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Body composition photos</CardTitle>
          <Button
            size="sm"
            variant={sessions.length === 0 ? "primary" : "secondary"}
            onClick={() => {
              haptic("tap");
              setCaptureOpen(true);
            }}
          >
            <Camera size={13} />
            Take photos
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-[var(--color-fg-3)]">
            Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-stroke)] bg-[var(--color-elevated)] px-4 py-6 text-center">
            <Camera
              size={20}
              className="mx-auto mb-2 text-[var(--color-fg-3)]"
              aria-hidden
            />
            <p className="text-sm text-[var(--color-fg-2)] font-medium">
              Capture progress photos on the 1st &amp; 15th of each month.
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-fg-3)]">
              Front, side, back — whichever angles you can. They stay on this device.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.slice(0, 8).map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
            {sessions.length > 8 && (
              <li className="text-center text-[11px] text-[var(--color-fg-3)] pt-1">
                + {sessions.length - 8} earlier session{sessions.length - 8 === 1 ? "" : "s"}
              </li>
            )}
          </ul>
        )}
      </Card>

      <PhotoSessionCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
      />
    </>
  );
}

function SessionRow({ session }: { session: BodyPhotoSessionRow }) {
  const entries = (session.photoKeys as BodyPhotoEntry[] | null) ?? [];
  return (
    <li className="rounded-xl border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2.5 flex items-center gap-3">
      <div className="flex gap-1.5 shrink-0">
        {entries.slice(0, 3).map((e) => (
          <Thumb key={e.key} keyName={e.key} />
        ))}
        {entries.length === 0 && (
          <div className="h-12 w-9 rounded-md bg-[var(--color-card)] border border-dashed border-[var(--color-stroke)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold tnum text-[var(--color-fg)]">
          {format(fromDateStr(session.date), "MMM d, yyyy")}
        </div>
        <div className="text-[11px] text-[var(--color-fg-3)] truncate">
          {entries.length} photo{entries.length === 1 ? "" : "s"}
          {session.notes ? ` · ${session.notes}` : ""}
        </div>
      </div>
    </li>
  );
}

function Thumb({ keyName }: { keyName: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    let createdUrl: string | null = null;
    getPhoto(keyName)
      .then((blob) => {
        if (!alive || !blob) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [keyName]);

  return (
    <div className="h-12 w-9 rounded-md overflow-hidden bg-[var(--color-card)] border border-[var(--color-stroke)] shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}
