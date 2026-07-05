"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Target,
  Repeat,
  Pen,
  Utensils,
  Dumbbell,
  ListChecks,
  ChefHat,
  Activity,
  Droplets,
  SmilePlus,
  Zap,
  Scale,
  Footprints,
  Apple,
  BookOpen,
  CornerDownLeft,
} from "lucide-react";
import useSWR from "swr";
import { useStore, type QuickLogKind } from "@/store";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { addWater } from "@/lib/hooks/use-metrics";
import { todayStr } from "@/lib/date";
import { useHabits } from "@/lib/hooks/use-habits";
import { useJournalEntries } from "@/lib/hooks/use-journal";
import { useSavedMeals } from "@/lib/hooks/use-meals";
import { useRecipes } from "@/lib/hooks/use-recipes";
import { useWorkoutRoutines } from "@/lib/hooks/use-workout-routines";
import { EXERCISE_LIBRARY } from "@/lib/exercise-library";
import type { GoalRow } from "@/lib/data/goals";
import type { JournalRow } from "@/lib/data/journal";
import type { SavedMealRow } from "@/lib/data/meals";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

type Props = {
  open: boolean;
  onClose: () => void;
};

type SearchKind =
  | "goal"
  | "habit"
  | "journal"
  | "meal"
  | "routine"
  | "recipe"
  | "exercise";

type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
};

const KIND_ICON: Record<SearchKind, typeof Search> = {
  goal: Target,
  habit: Repeat,
  journal: Pen,
  meal: Utensils,
  routine: ListChecks,
  recipe: ChefHat,
  exercise: Activity,
};

const KIND_LABEL: Record<SearchKind, string> = {
  goal: "Goal",
  habit: "Habit",
  journal: "Journal",
  meal: "Meal",
  routine: "Routine",
  recipe: "Recipe",
  exercise: "Exercise",
};

// Section ordering controls the grouped render order under the input.
const KIND_ORDER: SearchKind[] = [
  "goal",
  "habit",
  "journal",
  "meal",
  "recipe",
  "routine",
  "exercise",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type CommandAction = {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string;
  Icon: typeof Search;
  color?: string;
  /** "log" opens a metric modal, "water" logs instantly, "nav" routes. */
  kind: "log" | "water" | "nav";
  logKind?: QuickLogKind;
  href?: string;
};

/**
 * The action layer that turns search into a command bar. Shown in full
 * when the query is empty; fuzzy-filtered alongside search hits when
 * typing.
 */
const COMMAND_ACTIONS: CommandAction[] = [
  { id: "water8", title: "Log water · +8 oz", subtitle: "Adds instantly", keywords: "water drink hydrate oz glass", Icon: Droplets, color: "var(--mc-water)", kind: "water" },
  { id: "mood", title: "Log mood", keywords: "mood feeling emotion", Icon: SmilePlus, color: "var(--mc-mood)", kind: "log", logKind: "mood" },
  { id: "energy", title: "Log energy", keywords: "energy tired alert", Icon: Zap, color: "var(--mc-energy)", kind: "log", logKind: "energy" },
  { id: "weight", title: "Log weight", keywords: "weight weigh scale lb kg", Icon: Scale, color: "var(--mc-weight)", kind: "log", logKind: "weight" },
  { id: "steps", title: "Log steps", keywords: "steps walk count", Icon: Footprints, color: "var(--mc-steps)", kind: "log", logKind: "steps" },
  { id: "meal", title: "Log a meal", subtitle: "Nutrition", keywords: "meal food eat calories macro photo", Icon: Apple, color: "var(--mc-calories)", kind: "nav", href: "/nutrition" },
  { id: "workout", title: "Start a workout", subtitle: "Gym", keywords: "workout gym lift train session", Icon: Dumbbell, color: "var(--pillar-strain)", kind: "nav", href: "/gym" },
  { id: "journal", title: "New journal entry", subtitle: "Journal", keywords: "journal write note reflect voice", Icon: BookOpen, color: "var(--mc-sleep)", kind: "nav", href: "/journal" },
];

function scoreMatch(text: string, q: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  if (new RegExp(`\\b${escapeRe(q)}`).test(t)) return 200;
  if (t.includes(q)) return 100;
  return 0;
}

export function UniversalSearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const openQuickLog = useStore((s) => s.openQuickLog);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const runAction = React.useCallback(
    (a: CommandAction) => {
      haptic("tap");
      if (a.kind === "water") {
        void addWater(todayStr(), 8);
        haptic("success");
        onClose();
      } else if (a.kind === "log" && a.logKind) {
        // openQuickLog also closes the search surface via store state.
        openQuickLog(a.logKind);
      } else if (a.kind === "nav" && a.href) {
        router.push(a.href);
        onClose();
      }
    },
    [onClose, openQuickLog, router]
  );

  // Cross-day goals: /api/data/goals with no `?date=...` returns all goals.
  const allGoals = useSWR<GoalRow[]>(open ? "/api/data/goals" : null);
  const { habits } = useHabits();
  const { entries: journalEntries } = useJournalEntries();
  // FIXME: there is no cross-day meals reader in v2 (use-meals only exposes
  // useMealsForDate). Saved meals are the only durable cross-day searchable
  // surface, so we use them here. Re-evaluate if a useAllMeals() hook lands.
  const { savedMeals } = useSavedMeals();
  const { recipes } = useRecipes();
  const { routines } = useWorkoutRoutines();
  // Lift sessions still live in Zustand (per CLAUDE.md, the route
  // intentionally skips SWR caching for sessions).
  const liftSessions = useStore((s) => s.liftSessions);

  React.useEffect(() => {
    if (!open) setQuery("");
    setActiveIndex(0);
  }, [open]);

  const hits = React.useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchHit[] = [];

    for (const g of allGoals.data ?? []) {
      const s = scoreMatch(g.text, q);
      if (s > 0) {
        out.push({
          kind: "goal",
          id: g.id,
          title: g.text,
          subtitle: g.date,
          href: `/?date=${g.date}`,
          score: s + (g.completed ? -10 : 0),
        });
      }
    }

    for (const h of habits) {
      const s = scoreMatch(h.name, q);
      if (s > 0) {
        out.push({
          kind: "habit",
          id: h.id,
          title: h.name,
          href: `/habits`,
          score: s,
        });
      }
    }

    for (const j of journalEntries as JournalRow[]) {
      const s1 = scoreMatch(j.summary ?? "", q);
      const s2 = scoreMatch(j.text ?? "", q);
      const s = Math.max(s1, s2 - 30);
      if (s > 0) {
        const text = j.text ?? "";
        out.push({
          kind: "journal",
          id: j.id,
          title: j.summary || text.slice(0, 60) || "Journal entry",
          subtitle: text.slice(0, 80),
          href: `/journal`,
          score: s,
        });
      }
    }

    for (const m of savedMeals as SavedMealRow[]) {
      if (!m.name) continue;
      const s = scoreMatch(m.name, q);
      if (s > 0) {
        out.push({
          kind: "meal",
          id: m.id,
          title: m.name,
          subtitle: `${Math.round(m.calories)} kcal · saved`,
          href: `/nutrition`,
          score: s,
        });
      }
    }

    for (const r of recipes) {
      const s = scoreMatch(r.name, q);
      if (s > 0) {
        out.push({
          kind: "recipe",
          id: r.id,
          title: r.name,
          subtitle: `${Math.round(r.caloriesPerServing)} kcal/serving`,
          href: `/nutrition`,
          score: s,
        });
      }
    }

    for (const t of routines) {
      const s = scoreMatch(t.name, q);
      if (s > 0) {
        out.push({
          kind: "routine",
          id: t.id,
          title: t.name,
          subtitle: `${t.exercises.length} exercises`,
          href: `/gym`,
          score: s,
        });
      }
    }

    // Exercises — dedupe by lowercase name. Surface user-logged lifts first
    // (boost score), then library exercises.
    const exerciseSeen = new Set<string>();
    for (const sess of liftSessions) {
      for (const ex of sess.exercises) {
        const key = ex.normalizedName || ex.name.toLowerCase().trim();
        if (exerciseSeen.has(key)) continue;
        const s = scoreMatch(ex.name, q);
        if (s > 0) {
          exerciseSeen.add(key);
          out.push({
            kind: "exercise",
            id: key,
            title: ex.name,
            subtitle: "Logged",
            href: `/gym/exercise/${encodeURIComponent(ex.name)}`,
            score: s + 50,
          });
        }
      }
    }
    for (const ex of EXERCISE_LIBRARY) {
      const key = ex.name.toLowerCase().trim();
      if (exerciseSeen.has(key)) continue;
      const aliasMatch = (ex.aliases ?? []).reduce(
        (best, a) => Math.max(best, scoreMatch(a, q)),
        0
      );
      const s = Math.max(scoreMatch(ex.name, q), aliasMatch);
      if (s > 0) {
        exerciseSeen.add(key);
        out.push({
          kind: "exercise",
          id: key,
          title: ex.name,
          subtitle: ex.muscleGroup,
          href: `/gym/exercise/${encodeURIComponent(ex.name)}`,
          score: s,
        });
      }
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [
    query,
    allGoals.data,
    habits,
    journalEntries,
    savedMeals,
    recipes,
    routines,
    liftSessions,
  ]);

  // Grouped view, preserving global rank within each group.
  const groups = React.useMemo(() => {
    const byKind = new Map<SearchKind, SearchHit[]>();
    for (const h of hits) {
      const arr = byKind.get(h.kind) ?? [];
      arr.push(h);
      byKind.set(h.kind, arr);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map((k) => ({
      kind: k,
      hits: byKind.get(k)!,
    }));
  }, [hits]);

  // Actions: full list on empty query, keyword-filtered while typing.
  const actionHits = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMAND_ACTIONS;
    return COMMAND_ACTIONS.filter(
      (a) =>
        scoreMatch(a.title, q) > 0 ||
        a.keywords.split(" ").some((k) => k.startsWith(q))
    );
  }, [query]);

  // Flat list for keyboard nav — actions first, then search hits, in
  // rendered order.
  const totalCount = actionHits.length + hits.length;
  const flatSearchHits = React.useMemo(
    () => groups.flatMap((g) => g.hits),
    [groups]
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalCount === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex < actionHits.length) {
        const a = actionHits[activeIndex];
        if (a) runAction(a);
        return;
      }
      const hit = flatSearchHits[activeIndex - actionHits.length];
      if (hit) {
        haptic("tap");
        router.push(hit.href);
        onClose();
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Search & log" size="lg">
      <div className="space-y-3" onKeyDown={onKeyDown}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Log something, or search everything…"
          inputMode="search"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {query.trim().length >= 2 && totalCount === 0 && (
          <div className="text-center py-6">
            <Search
              size={20}
              className="mx-auto text-[var(--color-fg-3)] mb-2"
            />
            <div className="text-xs text-[var(--color-fg-3)]">No matches.</div>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto nice-scroll space-y-3 -mx-1 px-1">
          {actionHits.length > 0 && (
            <section className="space-y-1">
              <div className="label px-2">Actions</div>
              <ul className="space-y-0.5">
                {actionHits.map((a, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => runAction(a)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-control)] text-left",
                          "transition-colors duration-[120ms] active:scale-[0.99]",
                          isActive
                            ? "bg-[var(--color-elevated)]"
                            : "hover:bg-[var(--color-card-hover)]"
                        )}
                      >
                        <span
                          className="h-7 w-7 grid place-items-center rounded-full shrink-0"
                          style={{
                            background: a.color
                              ? `color-mix(in srgb, ${a.color} 14%, transparent)`
                              : "var(--color-elevated)",
                            color: a.color ?? "var(--color-fg-2)",
                          }}
                        >
                          <a.Icon size={14} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-medium truncate">
                            {a.title}
                          </div>
                          {a.subtitle && (
                            <div className="text-xs text-[var(--color-fg-3)] truncate">
                              {a.subtitle}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <CornerDownLeft
                            size={13}
                            className="text-[var(--color-fg-3)] shrink-0"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {groups.map((group) => {
            let runningIndex = 0;
            // Compute the starting flat-index of this group so per-row index
            // aligns with keyboard activeIndex.
            for (const g of groups) {
              if (g.kind === group.kind) break;
              runningIndex += g.hits.length;
            }
            return (
              <section key={group.kind} className="space-y-1">
                <div className="label px-2">{KIND_LABEL[group.kind]}</div>
                <ul className="space-y-0.5">
                  {group.hits.map((h, i) => {
                    const Icon = KIND_ICON[h.kind];
                    const flatIdx = actionHits.length + runningIndex + i;
                    const isActive = flatIdx === activeIndex;
                    return (
                      <li key={`${h.kind}-${h.id}`}>
                        <Link
                          href={h.href}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => {
                            haptic("tap");
                            onClose();
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-control)]",
                            "transition-colors duration-[120ms]",
                            "active:scale-[0.99]",
                            isActive
                              ? "bg-[var(--color-elevated)]"
                              : "hover:bg-[var(--color-card-hover)]"
                          )}
                        >
                          <Icon
                            size={16}
                            className="text-[var(--color-fg-3)] shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] font-medium truncate">
                              {h.title}
                            </div>
                            {h.subtitle && (
                              <div className="text-xs text-[var(--color-fg-3)] truncate">
                                {h.subtitle}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)] tnum shrink-0">
                            {KIND_LABEL[h.kind]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
