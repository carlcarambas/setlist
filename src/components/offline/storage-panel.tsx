"use client";

import { useEffect, useState } from "react";
import { CloudDownload, Loader2, Trash2 } from "lucide-react";
import { SettingsRow, SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
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
    <SettingsSection
      title="Storage on this device"
      description="Plans, songs and events are always kept here. Sheets are kept when you open them, keep a plan offline, or download them below."
    >
      <dl className="border-t">
        <SettingsRow label="Sheets saved">
          {files ? `${files.size} (${formatBytes(savedBytes)})` : "…"}
          {kept?.size ? ` · ${kept.size} ${kept.size === 1 ? "plan" : "plans"} kept offline` : null}
        </SettingsRow>
        <SettingsRow label="Space used">
          {estimate?.usage !== undefined && estimate.quota
            ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}`
            : "Not reported by this browser"}
        </SettingsRow>
        <SettingsRow label="Protected from automatic cleanup">
          {persisted === null ? "…" : persisted ? "Yes" : "Not yet"}
          {persisted === false ? (
            <Button
              variant="outline"
              className="h-11 px-5"
              onClick={() => void requestPersistentStorage().then(setPersisted)}
            >
              Ask the browser
            </Button>
          ) : null}
        </SettingsRow>
      </dl>

      {downloading ? (
        <p role="status" className="flex min-h-11 items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Downloading {downloading} {downloading === 1 ? "sheet" : "sheets"}…
        </p>
      ) : missing.length && online ? (
        <Button
          className="h-auto min-h-11 w-full gap-2 px-5 py-2 whitespace-normal sm:w-auto sm:justify-self-start"
          onClick={() => void downloadLibrary()}
        >
          <CloudDownload className="size-4" aria-hidden />
          <span className="text-balance">
            Download the whole library ·{" "}
            <span className="whitespace-nowrap">
              {missing.length} {missing.length === 1 ? "sheet" : "sheets"} · {formatBytes(totalBytes(missing))}
            </span>
          </span>
        </Button>
      ) : library?.length && !missing.length ? (
        <p className="flex min-h-11 items-center">Every sheet in the library is on this device.</p>
      ) : null}
      {downloads.storageFull ? (
        <p role="alert" className="text-destructive">Storage on this device is full. Remove downloads to free space.</p>
      ) : null}
      {notice ? (
        <p role="alert" className="text-destructive">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {files?.size ? (
          <Button variant="outline" className="h-11 gap-2 px-5" onClick={() => void removeSheets()} disabled={busy}>
            <Trash2 className="size-4" aria-hidden />
            Remove all downloaded sheets
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="h-11 gap-2 px-5"
          onClick={() => void clearAll()}
          disabled={busy || !online}
        >
          <Trash2 className="size-4" aria-hidden />
          Clear all offline data
        </Button>
      </div>
      {!online ? (
        <p className="text-sm text-muted-foreground">Clearing offline data needs a connection to download it again.</p>
      ) : null}
    </SettingsSection>
  );
}
