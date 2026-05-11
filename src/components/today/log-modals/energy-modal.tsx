"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { todayStr } from "@/lib/date";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";

export function EnergyLogModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = todayStr();
  const log = useStore((s) => s.health[today]);
  const setHealth = useStore((s) => s.setHealth);

  const [val, setVal] = React.useState(log?.energy ?? 6);

  React.useEffect(() => {
    if (open) setVal(log?.energy ?? 6);
  }, [open, log]);

  const save = () => {
    setHealth(today, { energy: val });
    haptic("success");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log energy"
      description="Where's your energy at?"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="text-center">
          <div className="label text-[10px]">Energy</div>
          <div className="text-6xl font-bold tnum mt-2">{val}</div>
          <div className="text-sm text-[var(--color-fg-2)] mt-1">out of 10</div>
        </div>
        <Slider
          value={val}
          min={1}
          max={10}
          step={1}
          onChange={setVal}
          marks={[1, 5, 10]}
        />
      </div>
    </Modal>
  );
}
