"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Install guidance (spec v2 §4.5 OFF-10). iPhone/iPad Safari can't install by prompt and may remove
 * a site's data after 7 days unused unless it's on the Home Screen, so it gets an explanation.
 * Browsers with an install prompt (Android, desktop Chrome/Edge) get an Install button.
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "setlist:install-hint-dismissed";
let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallHint() {
  const [kind, setKind] = useState<"ios" | "prompt" | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {}
    if (dismissed || isStandalone()) return;
    const decide = () => setKind(isIos() ? "ios" : deferredPrompt ? "prompt" : null);
    decide();
    window.addEventListener("beforeinstallprompt", decide);
    return () => window.removeEventListener("beforeinstallprompt", decide);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setKind(null);
  }

  if (!kind) return null;
  return (
    <aside aria-label="Install Setlist" className="mb-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <div className="flex-1 space-y-2">
        {kind === "ios" ? (
          <>
            <p className="font-medium">Add Setlist to your Home Screen</p>
            <p>
              Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> in Safari, then{" "}
              <strong>Add to Home Screen</strong>. Installed, Setlist keeps your offline plans and sheets: Safari may
              remove data from websites you don&apos;t open for 7 days.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Install Setlist</p>
            <p>It opens like an app and works offline.</p>
            <Button
              className="h-11 gap-2"
              onClick={async () => {
                await deferredPrompt?.prompt();
                deferredPrompt = null;
                setKind(null);
              }}
            >
              <Download className="size-4" aria-hidden />
              Install app
            </Button>
          </>
        )}
      </div>
      <Button variant="ghost" className="size-11 shrink-0" onClick={dismiss} aria-label="Dismiss">
        <X className="size-4" aria-hidden />
      </Button>
    </aside>
  );
}
