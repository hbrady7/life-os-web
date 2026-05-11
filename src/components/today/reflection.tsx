"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sparkles, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { todayStr, isPast8pm } from "@/lib/date";
import { useStore } from "@/store";
import { useWins, useToday } from "@/store/selectors";
import { haptic } from "@/lib/haptics";

export function ReflectionCard() {
  const today = useToday();
  const showCard = React.useMemo(() => isPast8pm(), []);
  const journal = useStore((s) => s.journal);
  const alreadyReflected = journal.some(
    (j) => j.date === today && j.source === "reflection"
  );
  const [open, setOpen] = React.useState(false);

  if (!showCard) return null;
  if (alreadyReflected) {
    return (
      <section className="card p-4 flex items-center gap-3 border-[color:color-mix(in_srgb,var(--color-success)_22%,transparent)]">
        <div className="h-9 w-9 grid place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]">
          <Check size={16} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Reflection saved</div>
          <div className="text-xs text-[var(--color-fg-2)]">
            View it in Journal
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full card p-5 text-left card-hover relative overflow-hidden"
      >
        <div className="absolute inset-y-0 right-0 w-40 grad-soft pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 grid place-items-center rounded-xl grad-hero text-white">
            <Moon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tracking-tight">
              Evening reflection
            </div>
            <div className="text-xs text-[var(--color-fg-2)] mt-0.5">
              Close out the day — 5 quick prompts.
            </div>
          </div>
          <Sparkles size={16} className="text-[var(--color-accent)]" />
        </div>
      </button>

      <ReflectionModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ReflectionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = todayStr();
  const wins = useWins(today);
  const addJournal = useStore((s) => s.addJournal);
  const addPlan = useStore((s) => s.addPlan);

  const [step, setStep] = React.useState(0);
  const [mood, setMood] = React.useState(7);
  const [energy, setEnergy] = React.useState(5);
  const [wellText, setWellText] = React.useState(
    wins.map((w) => "• " + w.text).join("\n")
  );
  const [improveText, setImproveText] = React.useState("");
  const [topGoals, setTopGoals] = React.useState<string[]>(["", "", ""]);

  React.useEffect(() => {
    if (open) {
      setStep(0);
      setMood(7);
      setEnergy(5);
      setWellText(wins.map((w) => "• " + w.text).join("\n"));
      setImproveText("");
      setTopGoals(["", "", ""]);
    }
  }, [open, wins]);

  const finish = () => {
    const text = [
      "**Mood:** " + mood + "/10",
      "**Energy:** " + energy + "/10",
      "",
      "**What went well:**",
      wellText.trim(),
      "",
      "**What I'd improve:**",
      improveText.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    addJournal({
      date: today,
      mood,
      energy,
      text,
      tags: ["reflection"],
      source: "reflection",
    });
    topGoals
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => addPlan(t, today));
    haptic("success");
    onClose();
  };

  const steps = [
    {
      title: "Mood now",
      body: (
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-6xl font-bold tnum">{mood}</div>
            <div className="text-sm text-[var(--color-fg-2)]">out of 10</div>
          </div>
          <Slider
            value={mood}
            min={1}
            max={10}
            step={1}
            onChange={setMood}
            marks={[1, 5, 10]}
          />
        </div>
      ),
    },
    {
      title: "Energy now",
      body: (
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-6xl font-bold tnum">{energy}</div>
            <div className="text-sm text-[var(--color-fg-2)]">out of 10</div>
          </div>
          <Slider
            value={energy}
            min={1}
            max={10}
            step={1}
            onChange={setEnergy}
            marks={[1, 5, 10]}
          />
        </div>
      ),
    },
    {
      title: "What went well",
      body: (
        <Textarea
          value={wellText}
          onChange={(e) => setWellText(e.target.value)}
          rows={6}
          placeholder="• A small thing counts"
        />
      ),
    },
    {
      title: "What you'd improve",
      body: (
        <Textarea
          value={improveText}
          onChange={(e) => setImproveText(e.target.value)}
          rows={6}
          placeholder="One concrete adjustment for next time"
        />
      ),
    },
    {
      title: "Top 3 for tomorrow",
      body: (
        <div className="space-y-2">
          {topGoals.map((v, i) => (
            <Input
              key={i}
              value={v}
              onChange={(e) =>
                setTopGoals((arr) =>
                  arr.map((x, idx) => (idx === i ? e.target.value : x))
                )
              }
              placeholder={`Goal ${i + 1}`}
            />
          ))}
        </div>
      ),
    },
  ];

  const last = step === steps.length - 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${step + 1} / ${steps.length}  ·  ${steps[step].title}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {last ? (
            <Button onClick={finish}>Save reflection</Button>
          ) : (
            <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Next
            </Button>
          )}
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {steps[step].body}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
