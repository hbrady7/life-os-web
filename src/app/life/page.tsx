"use client";

import * as React from "react";
import { Plus, Check, Trash2, Sparkles } from "lucide-react";
import { Screen } from "@/components/screen";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { ToggleRow } from "@/components/ui/toggle";
import { Confetti } from "@/components/confetti";
import { useStore } from "@/store";
import {
  useActiveLifeGoals,
  useCompletedLifeGoals,
} from "@/store/selectors";
import {
  LIFE_GOAL_CATEGORIES,
  LifeGoal,
  LifeGoalCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

type Tab = "active" | "done" | "all";

export default function LifePage() {
  const active = useActiveLifeGoals();
  const completed = useCompletedLifeGoals();
  const [tab, setTab] = React.useState<Tab>("active");
  const [filter, setFilter] = React.useState<LifeGoalCategory | "all">("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LifeGoal | null>(null);

  const all = tab === "active" ? active : tab === "done" ? completed : [...active, ...completed];
  const filtered =
    filter === "all" ? all : all.filter((g) => g.category === filter);

  return (
    <Screen title="Life" subtitle="The big stuff.">
      <div className="flex justify-center">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: `Active · ${active.length}` },
            { value: "done", label: `Done · ${completed.length}` },
            { value: "all", label: "All" },
          ]}
          size="sm"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scroll -mx-1 px-1 pb-1">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
        {LIFE_GOAL_CATEGORIES.map((c) => (
          <FilterChip
            key={c.key}
            active={filter === c.key}
            onClick={() => setFilter(c.key)}
            label={`${c.emoji} ${c.label}`}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} />
          Add life goal
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-10">
          <div className="text-sm text-[var(--color-fg-2)]">
            {tab === "done" ? "Nothing checked off yet." : "Nothing here yet."}
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 text-xs text-[var(--color-accent)]"
          >
            Add your first →
          </button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <LifeGoalCard
              key={g.id}
              goal={g}
              onClick={() => setEditing(g)}
            />
          ))}
        </div>
      )}

      <AddLifeGoalModal open={addOpen} onClose={() => setAddOpen(false)} />
      <LifeGoalDetailModal
        goal={editing}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-full text-xs border whitespace-nowrap shrink-0 transition",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[color:color-mix(in_srgb,var(--color-accent)_24%,transparent)]"
          : "border-[var(--color-stroke)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)]"
      )}
    >
      {label}
    </button>
  );
}

function LifeGoalCard({
  goal,
  onClick,
}: {
  goal: LifeGoal;
  onClick: () => void;
}) {
  const cat = LIFE_GOAL_CATEGORIES.find((c) => c.key === goal.category);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full card p-3.5 text-left card-hover relative overflow-hidden"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">
          {goal.emoji || cat?.emoji || "🌱"}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-sm font-semibold truncate",
              goal.completed && "line-through text-[var(--color-fg-3)]"
            )}
          >
            {goal.title}
          </div>
          {goal.description && (
            <div className="text-[11px] text-[var(--color-fg-3)] truncate mt-0.5">
              {goal.description}
            </div>
          )}
        </div>
        {goal.targetYear && !goal.completed && (
          <span className="h-6 px-2 inline-flex items-center rounded-full bg-[var(--color-elevated)] border border-[var(--color-stroke)] text-[10px] text-[var(--color-fg-2)] tnum">
            {goal.targetYear}
          </span>
        )}
        {goal.completed && (
          <Check size={16} className="text-[var(--color-success)]" />
        )}
      </div>
      {goal.measurable && !goal.completed && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-[var(--color-elevated)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)]"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <span className="text-[10px] tnum text-[var(--color-fg-3)] shrink-0">
            {goal.progress}%
          </span>
        </div>
      )}
    </button>
  );
}

function AddLifeGoalModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addLifeGoal = useStore((s) => s.addLifeGoal);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [emoji, setEmoji] = React.useState("");
  const [category, setCategory] = React.useState<LifeGoalCategory>("personal");
  const [targetYear, setTargetYear] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setEmoji("");
      setCategory("personal");
      setTargetYear("");
    }
  }, [open]);

  const save = () => {
    if (!title.trim()) return;
    addLifeGoal({
      title: title.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      category,
      targetYear: targetYear ? parseInt(targetYear, 10) : undefined,
    });
    haptic("success");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New life goal"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            Add
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <div className="label mb-2">Emoji</div>
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="text-2xl text-center"
              placeholder="🌱"
            />
          </div>
          <div>
            <div className="label mb-2">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Visit Japan"
              autoFocus
            />
          </div>
        </div>
        <div>
          <div className="label mb-2">Description (optional)</div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <div className="label mb-2">Category</div>
          <div className="grid grid-cols-4 gap-1.5">
            {LIFE_GOAL_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cn(
                  "h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition",
                  category === c.key
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-stroke)] bg-[var(--color-elevated)]"
                )}
              >
                <span className="text-base">{c.emoji}</span>
                <span className="text-[9px] text-[var(--color-fg-2)]">
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-2">Target year (optional)</div>
          <Input
            type="number"
            inputMode="numeric"
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            placeholder="2030"
          />
        </div>
      </div>
    </Modal>
  );
}

function LifeGoalDetailModal({
  goal,
  onClose,
}: {
  goal: LifeGoal | null;
  onClose: () => void;
}) {
  const open = !!goal;
  const updateLifeGoal = useStore((s) => s.updateLifeGoal);
  const removeLifeGoal = useStore((s) => s.removeLifeGoal);
  const completeLifeGoal = useStore((s) => s.completeLifeGoal);
  const goals = useStore((s) => s.goals);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [emoji, setEmoji] = React.useState("");
  const [category, setCategory] = React.useState<LifeGoalCategory>("personal");
  const [targetYear, setTargetYear] = React.useState("");
  const [measurable, setMeasurable] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [reflectOpen, setReflectOpen] = React.useState(false);
  const [reflection, setReflection] = React.useState("");
  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (!goal) return;
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setEmoji(goal.emoji ?? "");
    setCategory(goal.category);
    setTargetYear(goal.targetYear ? String(goal.targetYear) : "");
    setMeasurable(goal.measurable);
    setProgress(goal.progress);
    setReflectOpen(false);
    setReflection("");
  }, [goal]);

  if (!open) return null;

  const persist = () => {
    updateLifeGoal(goal.id, {
      title: title.trim() || goal.title,
      description: description.trim() || undefined,
      emoji: emoji.trim() || undefined,
      category,
      targetYear: targetYear ? parseInt(targetYear, 10) : undefined,
      measurable,
      progress,
    });
  };

  const linkedDailyGoals = goals.filter((g) => g.lifeGoalId === goal.id);

  return (
    <>
      {showConfetti && <Confetti />}
      <Modal
        open={open}
        onClose={() => {
          persist();
          onClose();
        }}
        title={`${goal.emoji ?? "✨"} ${goal.title}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm(`Remove "${goal.title}"?`)) {
                  removeLifeGoal(goal.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={12} />
              Delete
            </Button>
            {!goal.completed && (
              <Button
                onClick={() => setReflectOpen(true)}
                className="!bg-[var(--color-success)] !text-black"
              >
                <Check size={14} />
                Mark complete
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {goal.completed && goal.completedAt && (
            <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--color-success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_10%,transparent)] p-3 text-sm text-[var(--color-success)] inline-flex items-center gap-2">
              <Sparkles size={14} />
              Completed on{" "}
              {new Date(goal.completedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}

          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="text-2xl text-center"
              placeholder="🌱"
            />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={goal.completed}
            />
          </div>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Why does this matter? What does it look like?"
            disabled={goal.completed}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-2">Category</div>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as LifeGoalCategory)
                }
                disabled={goal.completed}
                className="control no-zoom h-11 w-full px-3 outline-none accent-ring"
              >
                {LIFE_GOAL_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label mb-2">Target year</div>
              <Input
                type="number"
                inputMode="numeric"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                disabled={goal.completed}
              />
            </div>
          </div>

          <ToggleRow
            label="Measurable"
            description="Track progress 0–100%"
            checked={measurable}
            onChange={(v) => {
              if (!goal.completed) setMeasurable(v);
            }}
          />
          {measurable && (
            <div>
              <div className="label mb-2">Progress · {progress}%</div>
              <Slider
                value={progress}
                min={0}
                max={100}
                step={5}
                onChange={setProgress}
              />
            </div>
          )}

          {linkedDailyGoals.length > 0 && (
            <div>
              <div className="label mb-2">
                Daily goals linked to this ({linkedDailyGoals.length})
              </div>
              <ul className="space-y-1">
                {linkedDailyGoals.slice(0, 10).map((g) => (
                  <li
                    key={g.id}
                    className={cn(
                      "text-xs px-2 py-1 rounded-md border border-[var(--color-stroke)] bg-[var(--color-elevated)]",
                      g.completed
                        ? "line-through text-[var(--color-fg-3)]"
                        : ""
                    )}
                  >
                    {g.text} · {g.date}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        title="How does it feel?"
        description="Optional. Creates a journal entry."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setReflectOpen(false)}>
              Skip
            </Button>
            <Button
              onClick={() => {
                completeLifeGoal(goal.id, reflection);
                setShowConfetti(true);
                setReflectOpen(false);
                window.setTimeout(() => setShowConfetti(false), 1900);
                window.setTimeout(() => onClose(), 1700);
                haptic("success");
              }}
            >
              Mark complete
            </Button>
          </div>
        }
      >
        <Textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          rows={6}
          placeholder="A few words about hitting this milestone…"
          autoFocus
        />
      </Modal>
    </>
  );
}
