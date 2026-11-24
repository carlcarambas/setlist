"use client";

import { useEffect, useState } from "react";
import { CloudDownload, HardDrive, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localDb } from "@/features/local-db/db";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import {
  enqueue,
  isStoragePersisted,
  librarySheets,
  requestPersistentStorage,
  storageEstimate,
} from "@/features/offline/downloads";
import { useDownloads, useFileIndex, useKeptPlans } from "@/features/offline/hooks";
import { deleteAllSheets } from "@/features/offline/sheets";
import { fitsInStorage, formatBytes, missingSheets, totalBytes } from "@/features/offline/status";
import { useOnline } from "@/features/offline/use-online";

/** Settings → Storage on this device (spec v2 §4.5 OFF-04, OFF-09, OFF-10, OFF-11). */
export function StoragePanel() {
  const online = useOnline();
  const files = useFileIndex();
  const kept = useKeptPlans();
  const downloads = useDownloads();
  const library = useLiveQuery(() => librarySheets(localDb()), []);
  const [estimate, setEstimate] = useState<{ quota?: number; usage?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savedBytes = files ? [...files.values()].reduce((sum, f) => sum + f.bytes, 0) : 0;
  useEffect(() => {
    void storageEstimate().then(setEstimate);
    void isStoragePersisted().then(setPersisted);
  }, [savedBytes]);

  const missing = library && files ? missingSheets(library, files) : [];
  const downloading = [...downloads.items.values()].filter((i) => i.state === "queued" || i.state === "downloading").length;

  async function downloadLibrary() {
    setNotice(null);
    if (!fitsInStorage(totalBytes(missing), await storageEstimate())) {
      setNotice(`Not enough space: the remaining sheets need ${formatBytes(totalBytes(missing))}.`);
      return;
    }
    void requestPersistentStorage().then(setPersisted);
    enqueue(missing, true);
  }

  async function removeSheets() {
    if (!window.confirm("Remove every downloaded sheet from this device? Plans stop being kept offline.")) return;
    setBusy(true);
    await deleteAllSheets().finally(() => setBusy(false));
  }

  async function clearAll() {
    if (!window.confirm("Clear all offline data on this device? Sheets are removed, and plans, songs and events download again the next time you're online.")) return;
    setBusy(true);
    await deleteAllSheets();
    await localDb().delete();
    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Storage on this device</h2>
        </CardTitle>
        <CardDescription>
          Plans, songs and events are always kept here. Sheets are kept when you open them, keep a plan offline, or
          download them below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <dl className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <HardDrive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="shrink-0 text-muted-foreground">Sheets saved:</dt>
            <dd>
              {files ? `${files.size} (${formatBytes(savedBytes)})` : "…"}
              {kept?.size ? ` · ${kept.size} ${kept.size === 1 ? "plan" : "plans"} kept offline` : null}
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <HardDrive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="shrink-0 text-muted-foreground">Space used:</dt>
            <dd>
              {estimate?.usage !== undefined && estimate.quota
                ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)} available to Setlist`
                : "Not reported by this browser"}
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="shrink-0 text-muted-foreground">Protected from automatic cleanup:</dt>
            <dd className="flex items-center gap-2">
              {persisted === null ? "…" : persisted ? "Yes" : "Not yet"}
              {persisted === false ? (
                <Button variant="outline" className="h-9" onClick={() => void requestPersistentStorage().then(setPersisted)}>
                  Ask the browser
                </Button>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {downloading ? (
            <p role="status" className="flex min-h-11 items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Downloading {downloading} {downloading === 1 ? "sheet" : "sheets"}…
            </p>
          ) : missing.length && online ? (
            <Button variant="outline" className="h-11 gap-2" onClick={() => void downloadLibrary()}>
              <CloudDownload className="size-4" aria-hidden />
              Download the whole library · {missing.length} {missing.length === 1 ? "sheet" : "sheets"} ·{" "}
              {formatBytes(totalBytes(missing))}
            </Button>
          ) : library?.length && !missing.length ? (
            <p className="flex min-h-11 items-center">Every sheet in the library is on this device.</p>
          ) : null}
          {files?.size ? (
            <Button variant="outline" className="h-11 gap-2" onClick={() => void removeSheets()} disabled={busy}>
              <Trash2 className="size-4" aria-hidden />
              Remove all downloaded sheets
            </Button>
          ) : null}
          <Button variant="outline" className="h-11 gap-2" onClick={() => void clearAll()} disabled={busy || !online}>
            <Trash2 className="size-4" aria-hidden />
            Clear all offline data
          </Button>
        </div>
        {!online ? <p className="text-muted-foreground">Clearing offline data needs a connection to download it again.</p> : null}
        {downloads.storageFull ? (
          <p role="alert" className="text-destructive">Storage on this device is full. Remove downloads to free space.</p>
        ) : null}
        {notice ? (
          <p role="alert" className="text-destructive">
            {notice}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
