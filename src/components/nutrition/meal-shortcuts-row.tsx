"use client";

import * as React from "react";
import { ChefHat, Utensils } from "lucide-react";
import { useSavedMeals, createMeal } from "@/lib/hooks/use-meals";
import { useRecipes } from "@/lib/hooks/use-recipes";
import { todayStr } from "@/lib/date";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

type Shortcut = {
  key: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  source: "saved" | "recipe";
  savedMealId?: string;
};

export function MealShortcutsRow() {
  const { savedMeals } = useSavedMeals();
  const { recipes } = useRecipes();

  const shortcuts = React.useMemo<Shortcut[]>(() => {
    const out: Shortcut[] = [];
    const seen = new Set<string>();

    const topSaved = [...savedMeals]
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 4);
    for (const s of topSaved) {
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key: `saved-${s.id}`,
        name: s.name,
        calories: Math.round(s.calories),
        protein: Math.round(s.protein),
        carbs: s.carbs != null ? Math.round(s.carbs) : undefined,
        fat: s.fat != null ? Math.round(s.fat) : undefined,
        source: "saved",
        savedMealId: s.id,
      });
    }

    for (const r of recipes.slice(0, 6)) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key: `recipe-${r.id}`,
        name: r.name,
        calories: Math.round(r.caloriesPerServing),
        protein: Math.round(r.proteinPerServing ?? 0),
        carbs:
          r.carbsPerServing != null
            ? Math.round(r.carbsPerServing)
            : undefined,
        fat:
          r.fatPerServing != null ? Math.round(r.fatPerServing) : undefined,
        source: "recipe",
      });
    }

    return out;
  }, [savedMeals, recipes]);

  if (shortcuts.length === 0) return null;

  const logShortcut = async (s: Shortcut) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    haptic("success");
    await createMeal({
      date: todayStr(),
      time: `${hh}:${mm}`,
      name: s.name,
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs ?? null,
      fat: s.fat ?? null,
      savedMealId: s.savedMealId ?? null,
      photoIndexeddbKey: null,
      thumbnailDataUrl: null,
      aiAnalysis: null,
      aiLogged: false,
    });
  };

  return (
    <section>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-3)] font-medium mb-2 px-1">
        Quick log
      </div>
      <div className="-mx-4 px-4 overflow-x-auto hide-scroll">
        <div className="flex gap-2 snap-x snap-mandatory">
          {shortcuts.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => logShortcut(s)}
              className={cn(
                "snap-start shrink-0 w-[110px] h-[88px] rounded-xl",
                "border border-[var(--color-stroke)] bg-[var(--color-card)]",
                "p-2.5 text-left active:scale-[0.97]",
                "transition-transform duration-[80ms] ease-out"
              )}
            >
              <div className="flex items-center gap-1.5">
                {s.source === "recipe" ? (
                  <ChefHat
                    size={11}
                    className="text-[var(--color-accent)]"
                  />
                ) : (
                  <Utensils
                    size={11}
                    className="text-[var(--color-fg-3)]"
                  />
                )}
                <span className="text-[9px] uppercase tracking-wider text-[var(--color-fg-3)]">
                  {s.source === "recipe" ? "Recipe" : "Saved"}
                </span>
              </div>
              <div className="mt-1 text-[12px] font-semibold truncate">
                {s.name}
              </div>
              <div className="text-[10px] text-[var(--color-fg-3)] tnum mt-0.5">
                {s.calories} kcal · {s.protein}g P
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
