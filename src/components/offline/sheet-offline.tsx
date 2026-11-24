"use client";

import { CloudCheck, CloudDownload, Loader2, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pinSheet, retryFailed, unpinSheet } from "@/features/offline/downloads";
import { useDownloads, useFileIndex } from "@/features/offline/hooks";
import { formatBytes, type SheetRef } from "@/features/offline/status";
import { useOnline } from "@/features/offline/use-online";

/** Per-sheet offline control on the song page (spec v2 OFF-04/OFF-05). */
export function SheetOffline({ sheet, title }: { sheet: SheetRef; title: string }) {
  const online = useOnline();
  const files = useFileIndex();
  const downloads = useDownloads();
  const saved = files?.get(sheet.arrangementId);
  const job = downloads.items.get(sheet.arrangementId);

  if (job?.state === "queued" || job?.state === "downloading") {
    return (
      <span role="status" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {saved ? "Updating…" : "Saving…"}
      </span>
    );
  }
  if (job?.state === "failed" && online) {
    return (
      <Button variant="outline" className="h-11 gap-2" onClick={() => retryFailed([sheet.arrangementId])}>
        <RotateCw className="size-4" aria-hidden />
        Retry saving
      </Button>
    );
  }
  if (saved) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex min-h-11 items-center gap-1 text-sm">
          <CloudCheck className="size-4" aria-hidden />
          On this device{saved.version !== sheet.version ? " (older version)" : null}
        </span>
        {saved.pinned ? (
          <Button
            variant="ghost"
            className="size-11"
            onClick={() => void unpinSheet(sheet.arrangementId)}
            aria-label={`Remove ${title} from this device`}
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </span>
    );
  }
  if (!online) return null;
  return (
    <Button variant="outline" className="h-11 gap-2" onClick={() => void pinSheet(sheet)}>
      <CloudDownload className="size-4" aria-hidden />
      Save offline · {formatBytes(sheet.bytes)}
    </Button>
  );
}
