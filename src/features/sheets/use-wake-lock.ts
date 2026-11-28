"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while a sheet is being read. The browser releases the lock whenever the app is
 * hidden, so it's requested again on return. Where wake lock is unsupported or refused (e.g. low
 * battery), nothing happens and the phone's own sleep setting applies.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    let requesting = false;

    async function acquire() {
      if (requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (done) await next.release();
        else lock = next;
      } catch {
        // Refused: nothing to do.
      } finally {
        requesting = false;
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}
