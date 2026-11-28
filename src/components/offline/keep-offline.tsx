"use client";

import { useState } from "react";
import { CloudCheck, CloudDownload, Loader2, RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keepPlan, retryFailed, storageEstimate } from "@/features/offline/downloads";
import { useDownloads, useFileIndex, useKeptPlans } from "@/features/offline/hooks";
import { fitsInStorage, formatBytes, missingSheets, offlineStatus, totalBytes, type SheetRef } from "@/features/offline/status";
import { useOnline } from "@/features/offline/use-online";

/**
 * "Keep offline" for a plan (spec v2 §4.5, §5.1), on one line above the setlist: shows the download
 * size first, progress while downloading, and failures with Retry. Kept plans update themselves after
 * each sync; "Remove from device" is in the plan's More menu.
 */
export function KeepOffline({ planId, sheets }: { planId: string; sheets: SheetRef[] }) {
  const online = useOnline();
  const files = useFileIndex();
  const kept = useKeptPlans();
  const downloads = useDownloads();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!files || !kept || !sheets.length) return null;

  const isKept = kept.has(planId);
  const status = offlineStatus(sheets, files);
  const missing = missingSheets(sheets, files);
  const ids = new Set(sheets.map((s) => s.arrangementId));
  const mine = [...downloads.items].filter(([id]) => ids.has(id));
  const inProgress = mine.filter(([, i]) => i.state === "queued" || i.state === "downloading");
  const failed = mine.filter(([, i]) => i.state === "failed");
  const gone = mine.filter(([, i]) => i.state === "gone");
  const uniqueCount = ids.size;

  async function keep() {
    setNotice(null);
    const estimate = await storageEstimate();
    if (!fitsInStorage(totalBytes(missing), estimate)) {
      setNotice(`Not enough space on this device: these sheets need ${formatBytes(totalBytes(missing))}. Remove other downloads in Settings first.`);
      return;
    }
    setBusy(true);
    await keepPlan(planId).finally(() => setBusy(false));
  }

  return (
    <div className="mb-3 grid gap-2 text-sm">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p role="status" className="flex items-center gap-2">
          {inProgress.length ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Downloading {uniqueCount - missingCountAfter(inProgress.length, failed.length, missing.length)} of {uniqueCount}{" "}
              sheets…
            </>
          ) : status === "complete" || status === "outdated" ? (
            <>
              <CloudCheck className="size-4" aria-hidden />
              {isKept ? "Available offline on this device" : "All sheets are on this device"}
              {status === "outdated" ? " (a newer version of a sheet will download when you're online)" : null}
            </>
          ) : (
            <>
              <CloudDownload className="size-4" aria-hidden />
              {status === "partial"
                ? `${uniqueCount - missing.length} of ${uniqueCount} sheets on this device`
                : "Not available offline yet"}
            </>
          )}
        </p>
        {!isKept && online && !inProgress.length ? (
          <Button variant="outline" className="h-11 gap-2" onClick={() => void keep()} disabled={busy}>
            {missing.length ? (
              <>Keep offline · {formatBytes(totalBytes(missing))}</>
            ) : (
              "Keep offline"
            )}
          </Button>
        ) : null}
      </div>
      {!online && !isKept && missing.length ? (
        <p className="text-muted-foreground">Connect to the internet to keep this plan offline.</p>
      ) : null}
      {downloads.storageFull && failed.length ? (
        <Problem>Storage on this device is full. Remove downloads in Settings, then retry.</Problem>
      ) : null}
      {failed.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <Problem>
            {failed.length} {failed.length === 1 ? "sheet" : "sheets"} couldn&apos;t be downloaded.
          </Problem>
          {online ? (
            <Button variant="outline" className="h-11 gap-2" onClick={() => retryFailed(failed.map(([id]) => id))}>
              <RotateCw className="size-4" aria-hidden />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {gone.length ? (
        <Problem>
          {gone.length} {gone.length === 1 ? "sheet is" : "sheets are"} no longer available on the server.
        </Problem>
      ) : null}
      {notice ? <Problem>{notice}</Problem> : null}
    </div>
  );
}

/** Sheets still missing while downloads run: the queued/downloading ones plus failures not retried. */
function missingCountAfter(inProgress: number, failed: number, missing: number) {
  return Math.min(missing, inProgress + failed);
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-destructive">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
