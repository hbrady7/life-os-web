/**
 * Client-only Web Push helpers. Wraps the service-worker subscription
 * dance + base64url decode for the VAPID key. Every helper is safe to
 * call outside a Push-capable environment — they return null / false
 * instead of throwing so the caller can render a "not available" UI
 * without try/catch noise.
 */

export type PushSupport = {
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  /** iOS Safari only ships Push API in standalone PWA mode (>=16.4),
   *  never in the in-tab browser. We detect standalone via the same
   *  media query the rest of the app uses. */
  iosStandaloneRequired: boolean;
  available: boolean;
};

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return {
      hasNotification: false,
      hasServiceWorker: false,
      hasPushManager: false,
      iosStandaloneRequired: false,
      available: false,
    };
  }
  const hasNotification = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  const iosStandaloneRequired = isIos && !isStandalone;
  const available =
    hasNotification &&
    hasServiceWorker &&
    hasPushManager &&
    !iosStandaloneRequired;
  return {
    hasNotification,
    hasServiceWorker,
    hasPushManager,
    iosStandaloneRequired,
    available,
  };
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Base64url → ArrayBuffer for PushManager.subscribe applicationServerKey.
 *
 * Returning a fresh ArrayBuffer (rather than a Uint8Array view) sidesteps
 * the strict-mode "ArrayBufferLike vs ArrayBuffer" mismatch in lib.dom
 * — `applicationServerKey` wants legacy `BufferSource`, which Uint8Array
 * over a generic ArrayBufferLike doesn't satisfy under TS 5.9.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Full subscribe flow: fetch VAPID key, call PushManager.subscribe,
 * POST the resulting subscription to /api/push/subscribe. Returns the
 * subscription on success, null on any failure (permission denied,
 * VAPID unset, service-worker not ready, etc.).
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!getPushSupport().available) return null;
  const reg = await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const keyRes = await fetch("/api/push/vapid-public-key");
  if (!keyRes.ok) return null;
  const { key } = (await keyRes.json()) as { key: string };
  if (!key) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Re-send to server in case the row was lost; upsert is idempotent.
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: existing.toJSON() }),
    });
    return existing;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBuffer(key),
  });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) {
    // Server rejected — undo the browser-side subscription so we don't
    // leak an endpoint that the server doesn't know about.
    await sub.unsubscribe().catch(() => {});
    return null;
  }
  return sub;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sub = await getExistingSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return true;
}

export async function savePushPrefs(
  endpoint: string,
  patch: { dailyWeightEnabled?: boolean; photoDayEnabled?: boolean }
): Promise<boolean> {
  const res = await fetch("/api/push/prefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, ...patch }),
  });
  return res.ok;
}

/** Fetched once per Settings open — figures out whether VAPID is wired
 *  up server-side. We treat a 404 from the public-key endpoint as
 *  "feature disabled" rather than an error. */
export async function isPushAvailableServerSide(): Promise<boolean> {
  try {
    const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
