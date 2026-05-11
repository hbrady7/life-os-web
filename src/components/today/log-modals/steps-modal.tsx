"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { todayStr } from "@/lib/date";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";

export function StepsLogModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = todayStr();
  const log = useStore((s) => s.health[today]);
  const setHealth = useStore((s) => s.setHealth);

  const [val, setVal] = React.useState(
    log?.steps ? String(log.steps) : ""
  );

  React.useEffect(() => {
    if (open) setVal(log?.steps ? String(log.steps) : "");
  }, [open, log]);

  const save = () => {
    const n = parseInt(val, 10);
    setHealth(today, { steps: Number.isFinite(n) ? n : undefined });
    haptic("success");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log steps"
      description="Total steps today"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <input
        type="number"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="0"
        className="control no-zoom w-full h-20 text-4xl font-bold tnum text-center px-3 outline-none accent-ring"
      />
    </Modal>
  );
}
