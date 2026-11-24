"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Ends the administrator session. Offline copies stay: the device continues as a member
 * (spec v2 §4.1), and plans and sheets aren't personal.
 */
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
          await signOut();
        })
      }
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
