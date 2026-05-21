import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

type HapticPattern = "tap" | "soft" | "success" | "warn" | "error" | "long";

// Web fallback patterns for browsers that expose navigator.vibrate.
const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  soft: 6,
  success: [12, 30, 18],
  warn: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
  long: 24,
};

// iOS Taptic Engine bindings — much richer than Web Vibration API. Hit
// the native plugin when running inside the Capacitor shell, fall back
// to navigator.vibrate in the regular web/PWA context.
export function haptic(kind: HapticPattern = "tap") {
  if (typeof window === "undefined") return;

  if (Capacitor.isNativePlatform()) {
    try {
      switch (kind) {
        case "tap":
        case "soft":
          void Haptics.impact({ style: ImpactStyle.Light });
          return;
        case "long":
          void Haptics.impact({ style: ImpactStyle.Medium });
          return;
        case "success":
          void Haptics.notification({ type: NotificationType.Success });
          return;
        case "warn":
          void Haptics.notification({ type: NotificationType.Warning });
          return;
        case "error":
          void Haptics.notification({ type: NotificationType.Error });
          return;
      }
    } catch {
      // ignore — fall through to web fallback below
    }
  }

  const nav = window.navigator as Navigator & {
    vibrate?: (p: number | number[]) => boolean;
  };
  if (!nav.vibrate) return;
  try {
    nav.vibrate(WEB_PATTERNS[kind]);
  } catch {
    // ignore
  }
}
