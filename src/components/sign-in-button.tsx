"use client";

import * as React from "react";
import { LogIn, Loader2 } from "lucide-react";

/**
 * Client-side GitHub sign-in trigger. The previous server-action form
 * swallowed any `signIn()` throw (missing AUTH_SECRET, bad provider
 * config) and the page just sat there. This version drives the auth
 * flow via the standard Auth.js endpoints so the browser handles the
 * redirect, AND it surfaces failures inline instead of failing silent.
 *
 * Flow (matches `next-auth/react`'s default signIn(): GET /api/auth/csrf
 * → POST /api/auth/signin/github with the CSRF token, then follow the
 * 302 to GitHub). We do this manually rather than importing
 * next-auth/react because v5's React entry point pulls in more than
 * we need on this single-purpose screen.
 */
export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const csrfRes = await fetch("/api/auth/csrf", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!csrfRes.ok) {
        throw new Error(`csrf endpoint returned ${csrfRes.status}`);
      }
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
      if (!csrfToken) {
        throw new Error("no csrf token in response");
      }

      const form = new URLSearchParams();
      form.set("csrfToken", csrfToken);
      form.set("callbackUrl", callbackUrl);

      // Submit via a real form-style navigation so the browser follows
      // the 302 → GitHub. fetch() would intercept the redirect and need
      // manual handling; <form> submission lets the browser do it.
      const formEl = document.createElement("form");
      formEl.method = "POST";
      formEl.action = "/api/auth/signin/github";
      formEl.style.display = "none";
      for (const [k, v] of form.entries()) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        formEl.appendChild(input);
      }
      document.body.appendChild(formEl);
      formEl.submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="w-full h-12 rounded-xl bg-[var(--color-accent-strong)] text-white font-medium inline-flex items-center justify-center gap-2 shadow-[var(--shadow-glow)] active:scale-[0.98] transition disabled:opacity-70"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        Continue with GitHub
      </button>
      {error && (
        <p
          role="alert"
          className="mt-3 text-[12px] text-[var(--color-danger)]"
        >
          Sign-in failed: {error}
        </p>
      )}
    </div>
  );
}
