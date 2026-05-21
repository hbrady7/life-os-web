"use client";

import * as React from "react";
import useSWR from "swr";
import { Brain, Trash2, Pencil, Plus, X, Check, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptics";

type FactValue = { text: string; category?: string };
type FactRow = {
  key: string;
  value: FactValue;
  createdAt: string;
  updatedAt: string;
};

const KEY = "/api/user-facts";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Renders the persistent memory the Overseer has gathered about the
 * user. Every fact is individually editable + deletable. New facts
 * normally land here automatically (extractor route, fired after each
 * Overseer turn), but the "Add a fact" affordance lets the user seed
 * memory directly without going through a chat turn.
 */
export function MemoryCard() {
  const { data, mutate, isLoading } = useSWR<FactRow[]>(KEY, fetcher);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [newText, setNewText] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const facts = data ?? [];

  const startEdit = (f: FactRow) => {
    setEditing(f.key);
    setEditText(f.value.text);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditText("");
  };

  const saveEdit = async (key: string) => {
    const t = editText.trim();
    if (!t) {
      cancelEdit();
      return;
    }
    setPending(true);
    haptic("tap");
    try {
      const res = await fetch(`/api/user-facts/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        await mutate();
        cancelEdit();
      }
    } finally {
      setPending(false);
    }
  };

  const remove = async (key: string) => {
    setPending(true);
    haptic("warn");
    try {
      await fetch(`/api/user-facts/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      await mutate();
    } finally {
      setPending(false);
    }
  };

  const addFact = async () => {
    const t = newText.trim();
    if (!t) return;
    setPending(true);
    haptic("tap");
    try {
      const res = await fetch(KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        setNewText("");
        setAdding(false);
        await mutate();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>What I remember about you</CardTitle>
        <Brain size={14} className="text-[var(--color-accent)]" />
      </CardHeader>

      {isLoading ? (
        <div className="text-xs text-[var(--color-fg-3)] inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </div>
      ) : facts.length === 0 ? (
        <p className="text-[12px] text-[var(--color-fg-2)] leading-relaxed">
          Nothing remembered yet. Mention durable things in chat
          (&ldquo;I&rsquo;m training for a marathon in November&rdquo;,
          &ldquo;my dog is Daisy&rdquo;) and they&rsquo;ll show up here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {facts.map((f) => (
            <li
              key={f.key}
              className="rounded-lg border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2"
            >
              {editing === f.key ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(f.key);
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <Button
                    size="iconSm"
                    variant="primary"
                    onClick={() => void saveEdit(f.key)}
                    disabled={pending}
                    aria-label="Save"
                  >
                    <Check size={12} />
                  </Button>
                  <Button
                    size="iconSm"
                    variant="ghost"
                    onClick={cancelEdit}
                    aria-label="Cancel"
                  >
                    <X size={12} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="flex-1 text-[13px] text-[var(--color-fg)] leading-snug">
                    {f.value.text}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      aria-label="Edit"
                      className="h-11 w-11 grid place-items-center rounded-md text-[var(--color-fg-3)] hover:text-[var(--color-accent)]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(f.key)}
                      aria-label="Forget"
                      disabled={pending}
                      className="h-11 w-11 grid place-items-center rounded-md text-[var(--color-fg-3)] hover:text-[var(--color-danger)]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="A short fact about you"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void addFact();
              if (e.key === "Escape") {
                setAdding(false);
                setNewText("");
              }
            }}
          />
          <Button
            size="icon"
            variant="primary"
            onClick={() => void addFact()}
            disabled={pending || !newText.trim()}
            aria-label="Add"
          >
            <Check size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setAdding(false);
              setNewText("");
            }}
            aria-label="Cancel"
          >
            <X size={14} />
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="w-full mt-3"
          onClick={() => setAdding(true)}
        >
          <Plus size={14} />
          Add a fact
        </Button>
      )}

      <p className="mt-3 text-[11px] text-[var(--color-fg-3)] leading-relaxed">
        Overseer reads this list on every reply. Anything here is fair
        game for the AI to reference — delete things you don&rsquo;t
        want it bringing up.
      </p>
    </Card>
  );
}
