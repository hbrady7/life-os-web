"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { useStore } from "@/store";
import { useStruggles, useToday } from "@/store/selectors";
import { ListSection } from "./list-section";
import { useOverseer } from "@/components/overseer/overseer-context";

export function StrugglesSection() {
  const today = useToday();
  const items = useStruggles(today);
  const add = useStore((s) => s.addStruggle);
  const remove = useStore((s) => s.removeStruggle);
  const update = useStore((s) => s.updateStruggle);
  const overseer = useOverseer();

  return (
    <ListSection
      title="Current Struggles"
      placeholder="What's hard right now?"
      bullet="minus"
      items={items}
      onAdd={(text) => add(text)}
      onRemove={remove}
      onUpdate={update}
      itemAction={{
        icon: MessageCircle,
        label: "Ask Overseer",
        onClick: (i) => {
          overseer?.open(`Help me with this: ${i.text}`);
        },
      }}
      emptyText="It's okay if nothing's hard."
    />
  );
}
