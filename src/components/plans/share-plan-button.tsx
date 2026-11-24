"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sends a plan's link to the team (spec 2.1 PLAN-15). Phones open their share sheet (Messenger,
 * WhatsApp, text…); elsewhere the link is copied. Anyone opening it gets the plan, no sign-in needed.
 */
export function SharePlanButton({ planId, title }: { planId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/plan?id=${planId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title} (Setlist)`, url });
        return;
      } catch (error) {
        // Closing the share sheet isn't an error; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link to share the plan:", url);
    }
  }

  return (
    <Button variant="outline" className="h-11 gap-2" onClick={() => void share()}>
      {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}
