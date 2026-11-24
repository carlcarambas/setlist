"use client";

import { useEffect, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { clearOfflineData } from "@/features/offline/sheets";
import { cn } from "@/lib/utils";

/** Signs out and removes this device's offline copies of plans and sheets (spec §19 P9). */
export function SignOutButton({ className, variant = "ghost" }: { className?: string; variant?: "ghost" | "outline" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      className={cn("h-11 gap-3", className)}
      onClick={() =>
        startTransition(async () => {
          await clearOfflineData();
          await signOut();
        })
      }
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/** Clears offline copies whenever the sign-in page is shown (e.g. after a session ended). */
export function ClearOfflineData() {
  useEffect(() => {
    void clearOfflineData();
  }, []);
  return null;
}
