"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { todayStr } from "@/lib/date";
import { useStore } from "@/store";
import { haptic } from "@/lib/haptics";

export function SleepLogModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = todayStr();
  const log = useStore((s) => s.health[today]);
  const setHealth = useStore((s) => s.setHealth);

  const [hours, setHours] = React.useState(log?.sleepHours ?? 7.5);
  const [quality, setQuality] = React.useState(log?.sleepQuality ?? 7);

  React.useEffect(() => {
    if (open) {
      setHours(log?.sleepHours ?? 7.5);
      setQuality(log?.sleepQuality ?? 7);
    }
  }, [open, log]);

  const save = () => {
    setHealth(today, { sleepHours: hours, sleepQuality: quality });
    haptic("success");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log sleep"
      description="How was last night?"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="label">Hours</span>
            <span className="text-2xl font-semibold tnum">
              {hours.toFixed(1)}h
            </span>
          </div>
          <Slider
            value={hours}
            min={0}
            max={12}
            step={0.25}
            onChange={setHours}
            marks={[0, 4, 8, 12]}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="label">Quality</span>
            <span className="text-2xl font-semibold tnum">{quality}/10</span>
          </div>
          <Slider
            value={quality}
            min={1}
            max={10}
            step={1}
            onChange={setQuality}
            marks={[1, 5, 10]}
          />
        </div>
      </div>
    </Modal>
  );
}
