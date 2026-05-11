"use client";

import * as React from "react";
import { Send, Sparkles, X } from "lucide-react";
import { LifeOSData } from "@/lib/types";
import { uid } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  context: LifeOSData;
};

export function Overseer({ context }: Props) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  // auto-scroll to bottom on new content
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // close on Esc, lock body scroll while open
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setError(null);

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const assistantId = uid();
    const placeholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, placeholder]);
    setDraft("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/overseer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({
            role,
            content,
          })),
          context,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((cur) =>
          cur.map((m) =>
            m.id === assistantId ? { ...m, content: acc } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // user cancelled
      } else {
        const msg = err instanceof Error ? err.message : "Something broke.";
        setError(msg);
        setMessages((cur) => cur.filter((m) => m.id !== assistantId));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      {/* floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Overseer"
        className="fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] h-14 w-14 grid place-items-center rounded-full bg-[var(--color-accent-strong)] text-white shadow-[var(--shadow-float)] hover:bg-[var(--color-accent)] active:scale-95 transition"
      >
        <Sparkles size={22} strokeWidth={2.2} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-label="Overseer"
            className="relative w-full sm:max-w-md h-[88dvh] flex flex-col card rounded-b-none sm:rounded-b-[var(--radius-card)] sm:mb-6 animate-panel-up"
          >
            <header className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 grid place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold">Overseer</div>
                  <div className="text-[11px] text-[var(--color-fg-dim)]">
                    Sees your day. Speaks plain.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-9 w-9 grid place-items-center rounded-full text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition"
              >
                <X size={18} />
              </button>
            </header>

            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto nice-scroll px-5 py-2 space-y-3"
            >
              {messages.length === 0 && !streaming && (
                <EmptyState onPick={(p) => setDraft(p)} />
              )}

              {messages
                .filter((m) => m.content.length > 0)
                .map((m) => (
                  <Bubble key={m.id} role={m.role} content={m.content} />
                ))}

              {streaming &&
                messages[messages.length - 1]?.role === "assistant" &&
                messages[messages.length - 1]?.content === "" && (
                  <TypingDots />
                )}

              {error && (
                <div className="text-xs text-[var(--color-danger)] bg-[color:color-mix(in_srgb,var(--color-danger)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <footer
              className="border-t border-[var(--color-border)] px-3 py-3"
              style={{
                paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask Overseer anything…"
                  className="control no-zoom flex-1 px-3 py-2.5 min-h-[44px] max-h-32 resize-none outline-none accent-ring"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={cancel}
                    aria-label="Stop"
                    className="h-11 px-3 grid place-items-center rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label="Send"
                    className="h-11 w-11 grid place-items-center rounded-xl bg-[var(--color-accent-strong)] text-white active:scale-95 transition disabled:opacity-40"
                  >
                    <Send size={17} />
                  </button>
                )}
              </form>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap text-[15px] leading-[1.45] rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? "bg-[var(--color-accent-strong)] text-white rounded-br-md"
            : "bg-[var(--color-surface-2)] text-[var(--color-fg)] rounded-bl-md"
        }`}
      >
        {content || " "}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--color-surface-2)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        <Dot delay="0s" />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse-dot"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const prompts = [
    "What should I focus on next?",
    "Sum up my day so far.",
    "Plan tomorrow based on today.",
  ];
  return (
    <div className="pt-6 pb-4 text-center text-[var(--color-fg-muted)]">
      <p className="text-sm leading-relaxed mb-4 px-4">
        I can see your goals, wins, struggles, and plan. Ask me anything.
      </p>
      <div className="flex flex-col items-stretch gap-1.5 px-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] py-2 px-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] transition text-left"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
