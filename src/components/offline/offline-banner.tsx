"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/features/offline/use-online";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b bg-muted px-4 py-2 text-sm">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        You&apos;re offline. Plans saved on this device still open;{" "}
        <Link href="/offline" className="underline underline-offset-4">
          see saved plans
        </Link>
        . Editing and uploads are paused.
      </span>
    </div>
  );
}
