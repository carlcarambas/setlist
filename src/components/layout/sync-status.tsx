"use client";

import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { relativeTime } from "@/components/plans/plan-status";
import { useSyncStatus } from "@/features/local-db/use-live-query";
import { useOnline } from "@/features/offline/use-online";
import { requestSync } from "@/features/sync/engine";

/** One line under the header: offline, first sync, or sync trouble. Silent when all is well. */
export function SyncStatusBar() {
  const online = useOnline();
  const status = useSyncStatus();
  const synced = status.lastSyncedAt ? `synced ${relativeTime(status.lastSyncedAt)}` : "not synced yet";

  if (!online) {
    return (
      <Bar>
        <CloudOff className="size-4 shrink-0" aria-hidden />
        <span>Offline: showing what&apos;s on this device ({synced}). Changes need a connection.</span>
      </Bar>
    );
  }
  if (status.empty && status.state === "syncing") {
    return (
      <Bar>
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span>Getting the library and plans onto this device…</span>
      </Bar>
    );
  }
  if (status.state === "error") {
    return (
      <Bar>
        <RefreshCw className="size-4 shrink-0" aria-hidden />
        <span>
          Couldn&apos;t sync ({synced}). Retrying automatically.{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => void requestSync()}>
            Try now
          </button>
        </span>
      </Bar>
    );
  }
  return null;
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 border-b bg-muted px-4 py-2 text-sm">
      {children}
    </div>
  );
}
