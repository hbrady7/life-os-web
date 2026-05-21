"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/toggle";
import {
  getPushSupport,
  getNotificationPermission,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  savePushPrefs,
  isPushAvailableServerSide,
} from "@/lib/push-client";
import { haptic } from "@/lib/haptics";

type State =
  | { kind: "loading" }
  /** VAPID not configured on server → hide the toggles, show short note. */
  | { kind: "server_disabled" }
  /** Browser doesn't support push (e.g. iOS in-tab Safari). */
  | { kind: "unsupported"; iosStandaloneRequired: boolean }
  /** User denied permission at the OS / browser level. */
  | { kind: "blocked" }
  /** Push works but no subscription yet — show "Enable" CTA. */
  | { kind: "ready" }
  /** Subscribed — show the prefs toggles. */
  | {
      kind: "subscribed";
      endpoint: string;
      dailyWeightEnabled: boolean;
      photoDayEnabled: boolean;
    };

/**
 * Push reminders card. Renders one of several states depending on
 * (a) whether VAPID is configured server-side, (b) browser support,
 * (c) OS permission, and (d) whether a subscription exists for this
 * device. iOS in-tab Safari is called out explicitly because Push API
 * support there requires the user to add the app to the home screen
 * first — surfacing that caveat saves a "why isn't this working" loop.
 */
export function RemindersCard() {
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [pending, setPending] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const support = getPushSupport();
    const serverOk = await isPushAvailableServerSide();
    if (!serverOk) {
      setState({ kind: "server_disabled" });
      return;
    }
    if (!support.available) {
      setState({
        kind: "unsupported",
        iosStandaloneRequired: support.iosStandaloneRequired,
      });
      return;
    }
    const perm = getNotificationPermission();
    if (perm === "denied") {
      setState({ kind: "blocked" });
      return;
    }
    const sub = await getExistingSubscription();
    if (!sub) {
      setState({ kind: "ready" });
      return;
    }
    setState({
      kind: "subscribed",
      endpoint: sub.endpoint,
      // Defaults match the schema; the server stores the truth, but for
      // a fresh subscribe we use schema defaults until the user toggles.
      dailyWeightEnabled: true,
      photoDayEnabled: true,
    });
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEnable = async () => {
    setPending(true);
    haptic("tap");
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        await refresh();
        return;
      }
      haptic("success");
      await refresh();
    } finally {
      setPending(false);
    }
  };

  const onDisable = async () => {
    setPending(true);
    haptic("warn");
    try {
      await unsubscribeFromPush();
      await refresh();
    } finally {
      setPending(false);
    }
  };

  const onTogglePref = async (
    key: "dailyWeightEnabled" | "photoDayEnabled",
    value: boolean
  ) => {
    if (state.kind !== "subscribed") return;
    haptic("tap");
    setState({ ...state, [key]: value });
    await savePushPrefs(state.endpoint, { [key]: value });
  };

  if (state.kind === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <Bell size={14} className="text-[var(--color-accent)]" />
        </CardHeader>
        <div className="text-xs text-[var(--color-fg-3)] inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          Checking…
        </div>
      </Card>
    );
  }

  if (state.kind === "server_disabled") {
    return null;
  }

  if (state.kind === "unsupported") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <BellOff size={14} className="text-[var(--color-fg-3)]" />
        </CardHeader>
        <p className="text-[12px] text-[var(--color-fg-2)] leading-relaxed">
          {state.iosStandaloneRequired
            ? "On iOS, push notifications work only after adding Life OS to your home screen. Tap the Share icon in Safari, then \"Add to Home Screen,\" then open the app from the icon and come back here."
            : "This browser doesn't support web push notifications."}
        </p>
      </Card>
    );
  }

  if (state.kind === "blocked") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <BellOff size={14} className="text-[var(--color-danger)]" />
        </CardHeader>
        <p className="text-[12px] text-[var(--color-fg-2)] leading-relaxed">
          Notifications are blocked for this site. Re-enable them in your
          browser&rsquo;s site settings, then come back and tap Enable.
        </p>
      </Card>
    );
  }

  if (state.kind === "ready") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <Bell size={14} className="text-[var(--color-accent)]" />
        </CardHeader>
        <p className="text-[12px] text-[var(--color-fg-2)] leading-relaxed mb-3">
          Daily weight check-in + photo-day nudge on the 1st and 15th.
          One notification per day max.
        </p>
        <Button
          variant="primary"
          className="w-full"
          disabled={pending}
          onClick={onEnable}
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Enabling…
            </>
          ) : (
            <>
              <Bell size={14} />
              Enable reminders
            </>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <Bell size={14} className="text-[var(--color-accent)]" />
      </CardHeader>
      <div className="space-y-1">
        <ToggleRow
          label="Daily weight"
          description="A morning nudge to log your weight."
          checked={state.dailyWeightEnabled}
          onChange={(v) => onTogglePref("dailyWeightEnabled", v)}
        />
        <ToggleRow
          label="Photo day"
          description="A reminder on the 1st and 15th to capture body comp photos."
          checked={state.photoDayEnabled}
          onChange={(v) => onTogglePref("photoDayEnabled", v)}
        />
      </div>
      <Button
        variant="secondary"
        className="w-full mt-3"
        disabled={pending}
        onClick={onDisable}
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Disabling…
          </>
        ) : (
          <>
            <BellOff size={14} />
            Disable on this device
          </>
        )}
      </Button>
      <p className="mt-3 text-[11px] text-[var(--color-fg-3)] leading-relaxed">
        Reminders fire once per day at 08:00 UTC. Each device has its own
        toggles — muting here won&rsquo;t affect your other browsers.
      </p>
    </Card>
  );
}
