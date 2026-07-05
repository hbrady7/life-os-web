/**
 * The circadian engine. The interface follows the sun: chrome accent +
 * ambient tint shift across four dayparts. Boundaries are fixed clock
 * hours (not solar-computed) so the app feels predictable — dawn energy
 * in the morning, clean monochrome focus midday, violet at dusk,
 * indigo at night.
 */

export type Daypart = "dawn" | "day" | "dusk" | "night";

export function daypartForHour(hour: number): Daypart {
  if (hour >= 5 && hour < 11) return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export function currentDaypart(now: Date = new Date()): Daypart {
  return daypartForHour(now.getHours());
}

export type AccentSpec = {
  /** Soft/base accent — text, icons, rings. */
  base: string;
  /** Strong accent — filled buttons, active states. */
  strong: string;
  /** Text/icon color ON a strong-accent fill. */
  contrast: string;
  /** HSL triplet for translucent soft fills. */
  h: number;
  s: number;
  l: number;
};

/**
 * Daypart accents. Midday is deliberately near-white: during focus
 * hours the chrome goes monochrome and color belongs to the data;
 * warmth returns at the morning and evening rituals.
 */
export const DAYPART_ACCENT: Record<Daypart, AccentSpec> = {
  dawn: { base: "#F5B06E", strong: "#EE9A3F", contrast: "#1D1204", h: 32, s: 87, l: 70 },
  day: { base: "#E9EDF6", strong: "#F7F9FE", contrast: "#0B0E16", h: 222, s: 42, l: 94 },
  dusk: { base: "#C0A6F5", strong: "#A47FF0", contrast: "#150B27", h: 262, s: 80, l: 81 },
  night: { base: "#8E9CF5", strong: "#6C7FF2", contrast: "#070C24", h: 231, s: 84, l: 76 },
};

/** Pinned (non-auto) accents — the escape hatch from follow-the-sun. */
export const PINNED_ACCENT: Record<string, AccentSpec> = {
  violet: { base: "#A78BFA", strong: "#8B5CF6", contrast: "#FFFFFF", h: 258, s: 90, l: 76 },
  emerald: { base: "#34D399", strong: "#10B981", contrast: "#04150E", h: 160, s: 70, l: 60 },
  rose: { base: "#FB7185", strong: "#F43F5E", contrast: "#FFFFFF", h: 350, s: 84, l: 70 },
  amber: { base: "#FBBF24", strong: "#F59E0B", contrast: "#1C1203", h: 35, s: 95, l: 60 },
};

export function resolveAccent(accent: string, daypart: Daypart): AccentSpec {
  if (accent === "auto") return DAYPART_ACCENT[daypart];
  return PINNED_ACCENT[accent] ?? DAYPART_ACCENT[daypart];
}

/** Human daypart label for chips ("DAWN", "DUSK"...). */
export const DAYPART_LABEL: Record<Daypart, string> = {
  dawn: "Dawn",
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};

/**
 * 24h horizon gradient stops shared by every HorizonBand instance.
 * Percent = hour/24. Hues match DAYPART_ACCENT strongs so the band
 * reads as "the accent's origin story."
 */
export const HORIZON_STOPS =
  "#6C7FF2 0%, #6C7FF2 17%, #EE9A3F 29%, #E9EDF6 50%, #A47FF0 78%, #6C7FF2 91%, #6C7FF2 100%";

/** Fraction of the day elapsed, 0..1. */
export function dayFraction(now: Date = new Date()): number {
  return (
    (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
  );
}
