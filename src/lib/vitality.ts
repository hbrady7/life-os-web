/**
 * Vitality settings live inside the existing userSettings JSON blob under
 * a `vitality` key (read via useUserSettings / getSettings, written via
 * saveSettings / upsertSettings). This module is the single source of
 * truth for the shape + defaults, plus a deep-merge reader so older blobs
 * stay forward-compatible.
 */

export type CaffeinePreset = { label: string; mg: number };

export type VitalitySettings = {
  caffeine: {
    sweetSpotMg: number;
    cautionMg: number;
    ceilingMg: number;
    /** Last hour (0–23) caffeine is advisable; past it the banner warns. */
    cutoffHour: number;
    presets: CaffeinePreset[];
  };
  supplements: {
    /** Hour the "taken today" state conceptually resets (UI only). */
    resetHour: number;
  };
  hydration: {
    mlPerKg: number;
    bottleOz: number;
    /** Extra user-entered contributions to the daily target, in oz. */
    modifiers: Array<{ label: string; oz: number }>;
  };
};

export const DEFAULT_VITALITY_SETTINGS: VitalitySettings = {
  caffeine: {
    sweetSpotMg: 250,
    cautionMg: 300,
    ceilingMg: 400,
    cutoffHour: 12,
    presets: [
      { label: "Coffee", mg: 95 },
      { label: "Espresso", mg: 65 },
      { label: "Cold brew", mg: 155 },
      { label: "Green tea", mg: 30 },
      { label: "Energy drink", mg: 160 },
      { label: "Pre-workout", mg: 200 },
    ],
  },
  supplements: { resetHour: 4 },
  hydration: {
    mlPerKg: 35,
    bottleOz: 20,
    modifiers: [],
  },
};

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

/** Merge a settings blob's `vitality` slice over the defaults. */
export function readVitalitySettings(
  blob: Record<string, unknown> | undefined | null
): VitalitySettings {
  const v = (blob?.vitality ?? {}) as DeepPartial<VitalitySettings>;
  const d = DEFAULT_VITALITY_SETTINGS;
  return {
    caffeine: {
      sweetSpotMg: v.caffeine?.sweetSpotMg ?? d.caffeine.sweetSpotMg,
      cautionMg: v.caffeine?.cautionMg ?? d.caffeine.cautionMg,
      ceilingMg: v.caffeine?.ceilingMg ?? d.caffeine.ceilingMg,
      cutoffHour: v.caffeine?.cutoffHour ?? d.caffeine.cutoffHour,
      presets:
        (v.caffeine?.presets as CaffeinePreset[] | undefined) ??
        d.caffeine.presets,
    },
    supplements: {
      resetHour: v.supplements?.resetHour ?? d.supplements.resetHour,
    },
    hydration: {
      mlPerKg: v.hydration?.mlPerKg ?? d.hydration.mlPerKg,
      bottleOz: v.hydration?.bottleOz ?? d.hydration.bottleOz,
      modifiers:
        (v.hydration?.modifiers as Array<{ label: string; oz: number }> | undefined) ??
        d.hydration.modifiers,
    },
  };
}

export const ML_PER_OZ = 29.5735;
