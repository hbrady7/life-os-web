"use client";

import * as React from "react";

/**
 * Adds `data-pwa="standalone"` to <html> when the app is running in
 * installed-PWA mode (iOS Safari "Add to Home Screen", Android Chrome
 * install). Lets CSS / components target standalone-only tweaks via
 *
 *     html[data-pwa="standalone"] .something { … }
 *
 * No effect when running inside a browser tab.
 *
 * The detection runs on mount, on `display-mode: standalone` change
 * (the spec allows browsers to dynamically swap modes), and on a
 * legacy iOS Safari fallback (`window.navigator.standalone`).
 */
export function PwaMode() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");

    const sync = () => {
      const standalone =
        mq.matches ||
        // iOS Safari pre-PWA-spec hint. Older devices may still report
        // this even on newer iOS releases.
        (window.navigator as { standalone?: boolean }).standalone === true;
      const root = document.documentElement;
      if (standalone) root.setAttribute("data-pwa", "standalone");
      else root.removeAttribute("data-pwa");
    };

    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return null;
}
