"use client";

import * as React from "react";
import {
  clampDateWithin,
  shiftDate,
  todayStr,
} from "@/lib/date";
import { useStore } from "@/store";
import type { DateStr } from "@/lib/types";

type DayCtx = {
  date: DateStr;
  setDate: (d: DateStr) => void;
  step: (delta: number) => void;
  goToday: () => void;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  daysBack: number;
  daysForward: number;
  canGoBack: boolean;
  canGoForward: boolean;
};

const Ctx = React.createContext<DayCtx | null>(null);

export function DayProvider({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings.dayNavigation);
  const [date, setDateRaw] = React.useState<DateStr>(() => todayStr());

  // Forward navigation is disabled — "tomorrow" view added no value, just
  // showed an empty 0% Goals card. Ignore any persisted daysForward and
  // hard-cap at 0 so canGoForward stays false everywhere.
  const daysForward = 0;
  const daysBack = settings.daysBack;

  const setDate = React.useCallback(
    (d: DateStr) => {
      setDateRaw(clampDateWithin(d, daysBack, daysForward));
    },
    [daysBack]
  );

  const step = React.useCallback(
    (delta: number) => {
      setDate(shiftDate(date, delta));
    },
    [date, setDate]
  );

  const goToday = React.useCallback(() => setDate(todayStr()), [setDate]);

  const today = todayStr();
  const isToday = date === today;
  const isPast = date < today;
  const isFuture = false; // forward beyond today is permanently disabled
  const minDate = shiftDate(today, -daysBack);

  const value: DayCtx = {
    date,
    setDate,
    step,
    goToday,
    isToday,
    isPast,
    isFuture,
    daysBack,
    daysForward,
    canGoBack: date > minDate,
    // Forward is allowed when looking at the past — caps at today.
    canGoForward: !isToday,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Selected day date — falls back to actual today when no DayProvider is mounted. */
export function useSelectedDate(): DateStr {
  const ctx = React.useContext(Ctx);
  return ctx?.date ?? todayStr();
}

/** Full day-navigation context. Only valid inside a DayProvider. */
export function useDay(): DayCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error("useDay must be used inside a DayProvider");
  }
  return ctx;
}

/** True if the user is viewing actual-today. Defaults to true outside a provider. */
export function useIsActualToday(): boolean {
  const ctx = React.useContext(Ctx);
  return ctx ? ctx.isToday : true;
}
