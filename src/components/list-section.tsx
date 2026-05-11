"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { ListItem } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "./ui/card";

type Props = {
  title: string;
  placeholder: string;
  items: ListItem[];
  bullet?: "dot" | "plus" | "minus";
  onChange: (next: ListItem[]) => void;
};

const bulletColor: Record<NonNullable<Props["bullet"]>, string> = {
  dot: "var(--color-accent)",
  plus: "var(--color-success)",
  minus: "var(--color-danger)",
};

const bulletGlyph: Record<NonNullable<Props["bullet"]>, string> = {
  dot: "•",
  plus: "+",
  minus: "−",
};

export function ListSection({
  title,
  placeholder,
  items,
  bullet = "dot",
  onChange,
}: Props) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: uid(), text }]);
    setDraft("");
  };

  const edit = (id: string, text: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));

  const remove = (id: string) =>
    onChange(items.filter((i) => i.id !== id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="text-xs text-[var(--color-fg-dim)] tabular-nums">
          {items.length}
        </span>
      </CardHeader>

      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2 rounded-xl px-1.5 py-1"
          >
            <span
              aria-hidden
              className="w-5 text-center font-semibold leading-none"
              style={{ color: bulletColor[bullet] }}
            >
              {bulletGlyph[bullet]}
            </span>
            <input
              value={item.text}
              onChange={(e) => edit(item.id, e.target.value)}
              className="flex-1 bg-transparent no-zoom text-[15px] outline-none placeholder:text-[var(--color-fg-dim)] py-2 text-[var(--color-fg)]"
            />
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label="Delete"
              className="h-9 w-9 grid place-items-center rounded-lg text-[var(--color-fg-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="control no-zoom flex-1 h-10 px-3 placeholder:text-[var(--color-fg-dim)] outline-none accent-ring"
        />
        <button
          type="submit"
          aria-label="Add"
          disabled={!draft.trim()}
          className="h-10 w-10 grid place-items-center rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] active:scale-95 transition disabled:opacity-40"
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </form>
    </Card>
  );
}
