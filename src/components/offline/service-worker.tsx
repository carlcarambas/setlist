"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js (generated after each build; see scripts/build-sw.mjs) and asks it to cache any
 * app pages it couldn't get at install, e.g. before this device had a session. Production builds
 * only: in development the service worker would serve stale code while files change.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.active?.postMessage("fill-shell"))
      .catch(() => undefined);
  }, []);
  return null;
}
