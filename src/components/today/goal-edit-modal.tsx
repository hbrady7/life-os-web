"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Goal, Priority, LIFE_GOAL_CATEGORIES } from "@/lib/types";
import { useActiveLifeGoals } from "@/store/selectors";

const EMOJI_SET = [
  "💪",
  "🧠",
  "📚",
  "🏃",
  "🧘",
  "💼",
  "✍️",
  "🍳",
  "🚿",
  "☕",
  "💧",
  "🌱",
  "✅",
  "⚡",
];

type Props = {
  goal: Goal | null;
  onClose: () => void;
  onSave: (patch: Partial<Goal>) => void;
  onDelete: () => void;
};

export function GoalEditModal({ goal, onClose, onSave, onDelete }: Props) {
  const open = !!goal;
  const [text, setText] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("P2");
  const [emoji, setEmoji] = React.useState<string | undefined>();
  const [category, setCategory] = React.useState("");
  const [time, setTime] = React.useState("");
  const [lifeGoalId, setLifeGoalId] = React.useState<string>("");
  const activeLifeGoals = useActiveLifeGoals();

  React.useEffect(() => {
    if (!goal) return;
    setText(goal.text);
    setPriority(goal.priority);
    setEmoji(goal.emoji);
    setCategory(goal.category ?? "");
    setTime(
      goal.timeEstimateMin != null ? String(goal.timeEstimateMin) : ""
    );
    setLifeGoalId(goal.lifeGoalId ?? "");
  }, [goal]);

  const save = () => {
    onSave({
      text: text.trim() || goal?.text || "",
      priority,
      emoji: emoji ?? undefined,
      category: category.trim() || undefined,
      timeEstimateMin: time ? parseInt(time, 10) || undefined : undefined,
      lifeGoalId: lifeGoalId || undefined,
    });
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit goal"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="label mb-2">Text</div>
          <Input value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        <div>
          <div className="label mb-2">Priority</div>
          <Segmented<Priority>
            value={priority}
            onChange={setPriority}
            options={[
              {
                value: "P1",
                label: (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-p1)" }}
                    />
                    P1
                  </span>
                ),
              },
              {
                value: "P2",
                label: (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-p2)" }}
                    />
                    P2
                  </span>
                ),
              },
              {
                value: "P3",
                label: (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--color-p3)" }}
                    />
                    P3
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div>
          <div className="label mb-2">Emoji</div>
          <div className="grid grid-cols-7 gap-1.5">
            <button
              type="button"
              onClick={() => setEmoji(undefined)}
              className={
                "h-10 rounded-lg border text-xs " +
                (emoji == null
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-stroke)] text-[var(--color-fg-2)]")
              }
            >
              None
            </button>
            {EMOJI_SET.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={
                  "h-10 rounded-lg border text-xl " +
                  (emoji === e
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-stroke)] hover:border-[var(--color-stroke-strong)]")
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-2">Category</div>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Work, Health…"
            />
          </div>
          <div>
            <div className="label mb-2">Time (min)</div>
            <Input
              type="number"
              inputMode="numeric"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="30"
            />
          </div>
        </div>

        {activeLifeGoals.length > 0 && (
          <div>
            <div className="label mb-2">Linked life goal</div>
            <select
              value={lifeGoalId}
              onChange={(e) => setLifeGoalId(e.target.value)}
              className="control no-zoom h-11 w-full px-3 outline-none accent-ring"
            >
              <option value="">— none —</option>
              {activeLifeGoals.map((g) => {
                const cat = LIFE_GOAL_CATEGORIES.find(
                  (c) => c.key === g.category
                );
                return (
                  <option key={g.id} value={g.id}>
                    {g.emoji || cat?.emoji} {g.title}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
