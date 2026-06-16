"use client";

import * as React from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { IdeaRow, IdeaStatus } from "@/lib/data/ideas";
import {
  useIdeas,
  createIdeaItem,
  updateIdeaItem,
  deleteIdeaItem,
} from "@/lib/hooks/use-ideas";

const STATUSES: IdeaStatus[] = ["spark", "exploring", "parked", "shipped"];
const STATUS_COLOR: Record<IdeaStatus, string> = {
  spark: "var(--mc-energy)",
  exploring: "var(--mc-water)",
  parked: "var(--color-fg-3)",
  shipped: "var(--mc-fat)",
};
const STATUS_LABEL: Record<IdeaStatus, string> = {
  spark: "Spark",
  exploring: "Exploring",
  parked: "Parked",
  shipped: "Shipped",
};

function nextStatus(s: IdeaStatus): IdeaStatus {
  return STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
}

export function IdeasClient() {
  const { ideas } = useIdeas();
  const [statusFilter, setStatusFilter] = React.useState<IdeaStatus | "all">("all");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of ideas) for (const t of i.tags ?? []) set.add(t);
    return [...set].sort();
  }, [ideas]);

  const filtered = ideas.filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (tagFilter == null || (i.tags ?? []).includes(tagFilter))
  );

  return (
    <Screen title="Ideas" subtitle="The board for everything you're sitting on.">
      <QuickAdd />

      <div className="space-y-2">
        <Segmented
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
          ]}
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
                className={cn(
                  "rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs transition",
                  tagFilter === t
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-[var(--color-stroke)] text-[var(--color-fg-3)] hover:text-[var(--color-fg-2)]"
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-3)]">
          {ideas.length === 0 ? "No ideas yet — capture one above." : "Nothing matches that filter."}
        </p>
      ) : (
        filtered.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
      )}
    </Screen>
  );
}

function QuickAdd() {
  const [title, setTitle] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [tags, setTags] = React.useState("");

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    haptic("success");
    await createIdeaItem({
      title: t,
      body: body.trim() || undefined,
      tags: parseTags(tags),
    });
    setTitle("");
    setBody("");
    setTags("");
    setOpen(false);
  };

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Capture an idea…"
            onFocus={() => setOpen(true)}
          />
          <Button type="submit" size="icon" disabled={!title.trim()} aria-label="Add idea">
            <Plus size={18} />
          </Button>
        </div>
        {open && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details (optional)"
              rows={2}
            />
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags, comma, separated (optional)"
            />
          </div>
        )}
      </form>
    </Card>
  );
}

function IdeaCard({ idea }: { idea: IdeaRow }) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(idea.title);
  const [body, setBody] = React.useState(idea.body ?? "");

  const save = async () => {
    if (!title.trim()) return;
    await updateIdeaItem(idea.id, { title: title.trim(), body: body.trim() || null });
    setEditing(false);
  };

  const status = idea.status as IdeaStatus;

  return (
    <Card className="group">
      {editing ? (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Details" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!title.trim()}>
              <Check size={15} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X size={15} /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                updateIdeaItem(idea.id, { status: nextStatus(status) });
              }}
              className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-stroke)] px-2 py-0.5 text-[11px] transition hover:border-[var(--color-stroke-strong)]"
              style={{ color: STATUS_COLOR[status] }}
              aria-label="Change status"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
              {STATUS_LABEL[status]}
            </button>
            <div className="flex-1">
              <div className="text-[15px] font-medium text-[var(--color-fg)]">{idea.title}</div>
              {idea.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-fg-2)]">{idea.body}</p>
              )}
              {idea.tags && idea.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {idea.tags.map((t) => (
                    <span key={t} className="text-[11px] text-[var(--color-fg-3)]">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
              <button
                type="button"
                aria-label="Edit"
                onClick={() => setEditing(true)}
                className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-fg)]"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                aria-label="Delete"
                onClick={() => {
                  haptic("soft");
                  deleteIdeaItem(idea.id);
                }}
                className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
