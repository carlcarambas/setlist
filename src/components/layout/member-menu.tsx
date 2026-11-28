"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Quiet outline on the dark sidebar, so the current page stays the brightest thing there.
const ON_DARK =
  "w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:border-highlight focus-visible:ring-highlight/50";

export function MemberMenu({ name, email, isAdmin }: { name: string | null; email: string | null; isAdmin: boolean }) {
  return (
    <div className="grid gap-3 border-t border-white/10 p-4">
      <div className="px-2">
        <p className="truncate text-sm font-medium">{name ?? (isAdmin ? "Administrator" : "This device")}</p>
        <p className="truncate text-sm text-white/60">{isAdmin ? email : "No sign-in needed"}</p>
      </div>
      {isAdmin ? (
        <SignOutButton variant="outline" className={ON_DARK} />
      ) : (
        <Button asChild variant="outline" className={cn("h-11", ON_DARK)}>
          <Link href="/sign-in">
            <LogIn className="size-4" aria-hidden />
            Administrator sign in
          </Link>
        </Button>
      )}
    </div>
  );
}
