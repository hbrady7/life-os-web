"use client";

import { useStore } from "@/store";
import { useToday, useWins } from "@/store/selectors";
import { ListSection } from "./list-section";

export function WinsSection() {
  const today = useToday();
  const items = useWins(today);
  const add = useStore((s) => s.addWin);
  const remove = useStore((s) => s.removeWin);
  const update = useStore((s) => s.updateWin);

  return (
    <ListSection
      title="Wins & Positives"
      placeholder="What went well?"
      bullet="plus"
      items={items}
      onAdd={(text) => add(text)}
      onRemove={remove}
      onUpdate={update}
      emptyText="Worth noting even small ones."
    />
  );
}
