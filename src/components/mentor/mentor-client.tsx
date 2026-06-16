"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Send, Sparkles, Trash2, Plus } from "lucide-react";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn, round1 } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { UserContext } from "@/lib/user-context";
import type { MemoryKind } from "@/lib/data/memories";
import {
  useMemories,
  createMemoryItem,
  deleteMemoryItem,
} from "@/lib/hooks/use-memories";
import { createIdeaItem } from "@/lib/hooks/use-ideas";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "How's my week looking?",
  "Am I drinking enough water?",
  "What should I focus on today?",
  "How's my recovery trending?",
] as const;

const MEMORY_KINDS: Array<{ value: MemoryKind; label: string }> = [
  { value: "note", label: "Note" },
  { value: "idea", label: "Idea" },
  { value: "reminder", label: "Reminder" },
  { value: "goal", label: "Goal" },
];

export function MentorClient({
  initialContext,
  firstName,
}: {
  initialContext: UserContext | null;
  firstName: string | null;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    haptic("tap");
    const userMsg: ChatMessage = {
      id: "u" + Date.now().toString(36),
      role: "user",
      content: trimmed,
    };
    const assistantId = "a" + Date.now().toString(36);
    const next = [...messages, userMsg];
    setMessages([...next, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const tag = await res.text().catch(() => "");
        const msg =
          res.status === 503 || tag === "missing-key"
            ? "AI isn't configured yet (missing Gemini key)."
            : "Couldn't reach the Mentor. Try again in a moment.";
        setMessages((cur) =>
          cur.map((m) => (m.id === assistantId ? { ...m, content: msg } : m))
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((cur) =>
          cur.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }
    } catch {
      setMessages((cur) =>
        cur.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Couldn't reach the Mentor. Check your connection." }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  const greeting = firstName ? `Hey ${firstName}.` : "Hey.";

  return (
    <Screen title="Mentor" subtitle="Your coach — it already knows your numbers.">
      {initialContext && <StatsTicker ctx={initialContext} />}

      <p className="flex items-center gap-1.5 text-xs text-[var(--color-fg-2)]">
        <Sparkles size={13} className="text-[var(--mc-peak)]" />
        I can see your profile, workouts, water, weights, wearable, and notes.
      </p>

      <div className="card p-3 md:p-4">
        <div
          ref={scrollRef}
          className="nice-scroll max-h-[46vh] min-h-[140px] overflow-y-auto space-y-3 pr-1"
        >
          {messages.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[15px] text-[var(--color-fg)]">{greeting}</p>
              <p className="mt-1 text-sm text-[var(--color-fg-2)]">
                Ask me anything, or tap a prompt below.
              </p>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} />)
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={streaming}
              onClick={() => send(p)}
              className="rounded-[var(--radius-pill)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-1.5 text-xs text-[var(--color-fg-2)] transition hover:text-[var(--color-fg)] hover:border-[var(--color-stroke-strong)] active:scale-[0.97] disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your Mentor…"
            disabled={streaming}
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || !input.trim()}
            aria-label="Send"
          >
            <Send size={18} />
          </Button>
        </form>
      </div>

      <TheVoid />
    </Screen>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
          isUser
            ? "bg-[var(--color-accent)] text-[#0b0b0f]"
            : "bg-[var(--color-elevated)] text-[var(--color-fg)]"
        )}
      >
        {message.content || (
          <span className="inline-flex gap-1">
            <Dot /> <Dot /> <Dot />
          </span>
        )}
      </div>
    </motion.div>
  );
}

function Dot() {
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-fg-3)] animate-pulse-dot" />
  );
}

function StatsTicker({ ctx }: { ctx: UserContext }) {
  const goalsDone = ctx.goalsToday.filter((g) => g.done).length;
  const chips: Array<{ label: string; value: string }> = [
    { label: "Peak", value: ctx.recovery.peakState != null ? `${ctx.recovery.peakState}` : "—" },
    { label: "Sleep", value: ctx.sleep.score != null ? `${ctx.sleep.score}%` : "—" },
    { label: "Strain", value: ctx.recovery.strain != null ? `${ctx.recovery.strain}` : "—" },
    { label: "Workouts 7d", value: `${ctx.workouts7d}` },
    {
      label: "Weight",
      value: ctx.weight.latest != null ? `${round1(ctx.weight.latest)}` : "—",
    },
    { label: "Goals", value: `${goalsDone}/${ctx.goalsToday.length}` },
  ];
  return (
    <div className="hide-scroll flex gap-2 overflow-x-auto">
      {chips.map((c) => (
        <div
          key={c.label}
          className="shrink-0 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-card)] px-3 py-2"
        >
          <div className="label">{c.label}</div>
          <div className="mt-0.5 text-lg font-bold tnum text-[var(--color-fg)]">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

const KIND_COLOR: Record<MemoryKind, string> = {
  idea: "var(--mc-energy)",
  reminder: "var(--mc-water)",
  goal: "var(--color-accent)",
  note: "var(--color-fg-3)",
};

function TheVoid() {
  const { memories: allMemories } = useMemories();
  // Ideas captured here now route to the Mind board; don't list them in the void.
  const memories = allMemories.filter((m) => m.kind !== "idea");
  const [text, setText] = React.useState("");
  const [kind, setKind] = React.useState<MemoryKind>("note");

  const add = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    haptic("success");
    setText("");
    // Ideas live on the Mind idea board, not in mentor memory.
    if (kind === "idea") await createIdeaItem({ title: trimmed });
    else await createMemoryItem({ content: trimmed, kind });
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">The void</h2>
        <span className="text-xs text-[var(--color-fg-3)]">
          {memories.length} {memories.length === 1 ? "thought" : "thoughts"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-fg-2)]">
        Capture a thought — the Mentor remembers it.
      </p>

      <div className="mt-3 space-y-2">
        <Segmented
          size="sm"
          value={kind}
          onChange={setKind}
          options={MEMORY_KINDS}
        />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind…"
          />
          <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Capture">
            <Plus size={18} />
          </Button>
        </form>
      </div>

      {memories.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {memories.map((m) => (
            <li
              key={m.id}
              className="group flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-stroke)] bg-[var(--color-elevated)] px-3 py-2"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: KIND_COLOR[m.kind as MemoryKind] }}
              />
              <span className="flex-1 text-sm text-[var(--color-fg)]">
                {m.content}
              </span>
              <button
                type="button"
                aria-label="Delete"
                onClick={() => {
                  haptic("soft");
                  deleteMemoryItem(m.id);
                }}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 h-8 w-8 grid place-items-center rounded-lg text-[var(--color-fg-3)] hover:text-[var(--color-danger)] transition"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
