"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, Trash2 } from "lucide-react";
import { Goal } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "./ui/card";

type Props = {
  goals: Goal[];
  onChange: (next: Goal[]) => void;
};

export function Goals({ goals, onChange }: Props) {
  const [draft, setDraft] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...goals, { id: uid(), text, done: false }]);
    setDraft("");
  };

  const toggle = (id: string) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));

  const edit = (id: string, text: string) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, text } : g)));

  const remove = (id: string) => onChange(goals.filter((g) => g.id !== id));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = goals.findIndex((g) => g.id === active.id);
    const newIndex = goals.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(goals, oldIndex, newIndex));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals for Today</CardTitle>
        <span className="text-xs text-[var(--color-fg-dim)] tabular-nums">
          {goals.filter((g) => g.done).length} / {goals.length}
        </span>
      </CardHeader>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={goals.map((g) => g.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1.5">
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                onToggle={() => toggle(g.id)}
                onEdit={(t) => edit(g.id, t)}
                onRemove={() => remove(g.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

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
          placeholder="Add a goal"
          className="control no-zoom flex-1 h-10 px-3 placeholder:text-[var(--color-fg-dim)] outline-none accent-ring"
        />
        <button
          type="submit"
          aria-label="Add goal"
          className="h-10 w-10 grid place-items-center rounded-xl bg-[var(--color-accent-strong)] text-white active:scale-95 transition disabled:opacity-40"
          disabled={!draft.trim()}
        >
          <Plus size={18} strokeWidth={2.4} />
        </button>
      </form>
    </Card>
  );
}

function GoalRow({
  goal,
  onToggle,
  onEdit,
  onRemove,
}: {
  goal: Goal;
  onToggle: () => void;
  onEdit: (t: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl px-1.5 py-1 ${
        isDragging
          ? "bg-[var(--color-surface-2)] shadow-[var(--shadow-float)]"
          : ""
      }`}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="h-9 w-7 grid place-items-center text-[var(--color-fg-dim)] touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={goal.done}
        aria-label={goal.done ? "Mark as not done" : "Mark as done"}
        className={`h-6 w-6 shrink-0 grid place-items-center rounded-md border transition ${
          goal.done
            ? "bg-[var(--color-accent-strong)] border-[var(--color-accent-strong)] text-white"
            : "border-[var(--color-border-strong)] hover:border-[var(--color-fg-muted)]"
        }`}
      >
        {goal.done && <Check size={14} strokeWidth={3} />}
      </button>

      <input
        value={goal.text}
        onChange={(e) => onEdit(e.target.value)}
        className={`flex-1 bg-transparent no-zoom text-[15px] outline-none placeholder:text-[var(--color-fg-dim)] py-2 ${
          goal.done
            ? "line-through text-[var(--color-fg-dim)]"
            : "text-[var(--color-fg)]"
        }`}
      />

      <button
        type="button"
        onClick={onRemove}
        aria-label="Delete goal"
        className="h-9 w-9 grid place-items-center rounded-lg text-[var(--color-fg-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
