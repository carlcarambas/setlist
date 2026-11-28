"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SearchX, WifiOff } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { useSyncStatus } from "@/features/local-db/use-live-query";
import { useOnline } from "@/features/offline/use-online";
import { requestSync } from "@/features/sync/engine";

export function LocalSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/**
 * Something isn't on this device. Until this page load's first sync has finished it may simply not
 * have arrived yet (e.g. right after creating it), so show a skeleton rather than "not found".
 */
export function NotOnDevice({ what, backHref, backLabel }: { what: string; backHref: string; backLabel: string }) {
  const status = useSyncStatus();
  const online = useOnline();
  // One more sync before giving up: the item may have been created moments ago.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void requestSync().finally(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [online]);
  if (!status.settled || (online && !checked)) return <LocalSkeleton />;
  return (
    <EmptyState icon={SearchX} title={`This ${what} isn't on this device`}>
      It may have been deleted, or it hasn&apos;t synced yet.{" "}
      <a href={backHref} className="underline underline-offset-4">
        {backLabel}
      </a>
    </EmptyState>
  );
}

/** Wraps an action that changes data: offline it's replaced by a short explanation. */
export function OnlineOnly({ children, label = "Needs a connection" }: { children: ReactNode; label?: string }) {
  const online = useOnline();
  if (online) return <>{children}</>;
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-soft px-4 text-sm text-muted-foreground">
      <WifiOff className="size-4" aria-hidden />
      {label}
    </span>
  );
}
