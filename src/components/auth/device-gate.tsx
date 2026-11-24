"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, WifiOff } from "lucide-react";
import { Turnstile, turnstileSiteKey } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/features/offline/use-online";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

/**
 * First visit on a device: pass the bot check, then become an anonymous member (spec v2 §4.1).
 * No account, no password; the session is a normal Supabase session, so RLS applies as usual.
 */
export function DeviceGate() {
  const params = useSearchParams();
  const online = useOnline();
  const [state, setState] = useState<"checking" | "joining" | "failed">("checking");
  const [attempt, setAttempt] = useState(0);

  async function join(captchaToken: string) {
    setState("joining");
    const { error } = await createClient().auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setState("failed");
      return;
    }
    // A full navigation, so the server renders the page with the new session cookie.
    window.location.replace(safeNextPath(params.get("next")));
  }

  if (!turnstileSiteKey) {
    return <p role="alert">Setlist isn&apos;t configured yet (missing bot-check key).</p>;
  }

  if (!online) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <WifiOff className="size-6 text-muted-foreground" aria-hidden />
        <p>You&apos;re offline. Connect to the internet once to set up Setlist on this device.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {state === "failed" ? (
        <>
          <p role="alert">Setlist couldn&apos;t get ready. Check your connection and try again.</p>
          <Button
            className="h-11"
            onClick={() => {
              setState("checking");
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Getting Setlist ready…
        </p>
      )}
      {state !== "failed" ? (
        <Turnstile resetKey={attempt} onToken={(token) => void join(token)} onError={() => setState("failed")} />
      ) : null}
    </div>
  );
}
