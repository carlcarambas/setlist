"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile bot check (spec v2 §4.1 ACC-03). Supabase Auth verifies the token on
 * anonymous sign-ins, password sign-ins and password resets. Loaded with a script tag, so there's no
 * npm dependency. Usually invisible; it shows a checkbox only when Cloudflare wants an interaction.
 */

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Renders the check and reports each new token. Change `resetKey` to get a fresh token
 * (tokens are single-use, e.g. after a failed sign-in).
 */
export function Turnstile({
  onToken,
  onError,
  resetKey,
}: {
  onToken: (token: string) => void;
  onError?: () => void;
  resetKey?: unknown;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onError });
  useEffect(() => {
    callbacks.current = { onToken, onError };
  });

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId = api.render(container.current, {
          sitekey: turnstileSiteKey,
          appearance: "interaction-only",
          callback: (token: string) => callbacks.current.onToken(token),
          "error-callback": () => callbacks.current.onError?.(),
          "expired-callback": () => widgetId && api.reset(widgetId),
        });
      })
      .catch(() => callbacks.current.onError?.());
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  return <div ref={container} />;
}

/** A Turnstile check that puts its token in a hidden `captchaToken` field of the surrounding form. */
export function TurnstileField({ resetKey }: { resetKey?: unknown }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="hidden" name="captchaToken" defaultValue="" />
      <Turnstile
        resetKey={resetKey}
        onToken={(token) => {
          if (input.current) input.current.value = token;
        }}
      />
    </>
  );
}
