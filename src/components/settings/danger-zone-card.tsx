"use client";

import * as React from "react";
import { Trash2, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptics";

/**
 * Permanent account deletion. App Store Guideline 5.1.1(v) requires this
 * for any app that supports account creation — without it, App Review will
 * reject. The endpoint cascades through every per-user table via the
 * schema's `onDelete: "cascade"` foreign keys.
 *
 * Confirmation gate: user must type "delete" to enable the destructive
 * button — prevents accidental taps. After success, we sign out so the
 * session cookie can't outlive the data.
 */
export function DangerZoneCard() {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = confirmText.trim().toLowerCase() === "delete";

  const handleDelete = async () => {
    setPending(true);
    setError(null);
    haptic("warn");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `delete failed: ${res.status}`);
      }
      // Sign out to drop the session cookie now that the row is gone.
      const csrf = await fetch("/api/auth/csrf").then((r) => r.json());
      const form = new FormData();
      form.append("csrfToken", csrf.csrfToken);
      form.append("callbackUrl", "/signin");
      await fetch("/api/auth/signout", { method: "POST", body: form });
      window.location.replace("/signin");
    } catch (e) {
      setPending(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      haptic("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
      </CardHeader>

      <div className="space-y-3">
        <div className="flex items-start gap-2.5 text-xs text-[var(--color-fg-2)] leading-relaxed">
          <ShieldAlert size={14} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
          <span>
            Deleting your account removes every goal, habit, meal, workout,
            metric, photo reference, and AI memory associated with you.
            This action is permanent and can&rsquo;t be undone.
          </span>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            haptic("tap");
            setOpen(true);
          }}
        >
          <Trash2 size={14} />
          Delete account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => {
          if (pending) return;
          setOpen(false);
          setConfirmText("");
          setError(null);
        }}
        title="Delete your Life OS account?"
        description="Type delete below to confirm. This wipes every row tied to your account from our database."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!canDelete || pending}
              onClick={handleDelete}
            >
              {pending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              Delete forever
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "delete" to confirm'
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="no-zoom"
          />
          {error && (
            <div className="text-xs text-[var(--color-danger)]">{error}</div>
          )}
        </div>
      </Modal>
    </Card>
  );
}
