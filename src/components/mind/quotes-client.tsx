"use client";

import * as React from "react";
import { Plus, Trash2, Pencil, Check, X, Search, Quote as QuoteIcon } from "lucide-react";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import type { QuoteRow } from "@/lib/data/quotes";
import {
  useQuotes,
  createQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
} from "@/lib/hooks/use-quotes";

export function QuotesClient() {
  const { quotes } = useQuotes();
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? quotes.filter((quote) =>
        [quote.text, quote.saidBy, quote.context]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q))
      )
    : quotes;

  return (
    <Screen title="Quotes" subtitle="The smartest things you've heard.">
      <QuickCapture />

      <div className="control flex items-center gap-2 px-3.5">
        <Search size={15} className="text-[var(--color-fg-3)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search quotes…"
          className="no-zoom h-11 flex-1 bg-transparent outline-none placeholder:text-[var(--color-fg-3)]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-3)]">
          {quotes.length === 0 ? "No quotes saved yet." : "Nothing matches that search."}
        </p>
      ) : (
        filtered.map((quote) => <QuoteCard key={quote.id} quote={quote} />)
      )}
    </Screen>
  );
}

function QuickCapture() {
  const [text, setText] = React.useState("");
  const [saidBy, setSaidBy] = React.useState("");
  const [context, setContext] = React.useState("");

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    haptic("success");
    await createQuoteItem({
      text: t,
      saidBy: saidBy.trim() || undefined,
      context: context.trim() || undefined,
    });
    setText("");
    setSaidBy("");
    setContext("");
  };

  return (
    <Card>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="The smartest thing you heard…"
          rows={2}
        />
        <div className="flex gap-2">
          <Input value={saidBy} onChange={(e) => setSaidBy(e.target.value)} placeholder="Who said it (optional)" />
          <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Where / context (optional)" />
        </div>
        <Button type="submit" size="sm" disabled={!text.trim()}>
          <Plus size={16} /> Save quote
        </Button>
      </form>
    </Card>
  );
}

function QuoteCard({ quote }: { quote: QuoteRow }) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(quote.text);
  const [saidBy, setSaidBy] = React.useState(quote.saidBy ?? "");
  const [context, setContext] = React.useState(quote.context ?? "");

  const save = async () => {
    if (!text.trim()) return;
    await updateQuoteItem(quote.id, {
      text: text.trim(),
      saidBy: saidBy.trim() || null,
      context: context.trim() || null,
    });
    setEditing(false);
  };

  return (
    <Card className="group">
      {editing ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <Input value={saidBy} onChange={(e) => setSaidBy(e.target.value)} placeholder="Who said it" />
            <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!text.trim()}>
              <Check size={15} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X size={15} /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <QuoteIcon size={16} className="mt-1 shrink-0 text-[var(--color-fg-3)]" />
          <div className="flex-1">
            <p className="whitespace-pre-wrap text-[15px] text-[var(--color-fg)]">{quote.text}</p>
            {(quote.saidBy || quote.context) && (
              <p className="mt-1 text-xs text-[var(--color-fg-3)]">
                {quote.saidBy && <span className="text-[var(--color-fg-2)]">— {quote.saidBy}</span>}
                {quote.saidBy && quote.context ? " · " : ""}
                {quote.context}
              </p>
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
                deleteQuoteItem(quote.id);
              }}
              className="h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
