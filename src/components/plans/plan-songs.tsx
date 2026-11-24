"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CloudCheck, CloudDownload, Loader2, X } from "lucide-react";
import { preloadPdfViewer, SheetViewer } from "@/components/music/sheet-viewer";
import { Button } from "@/components/ui/button";
import {
  loadSheet,
  rememberSavedPlan,
  saveAppAssetsForOffline,
  savePageForOffline,
  saveSheetsForOffline,
} from "@/features/offline/sheets";
import type { PlanItemView } from "@/features/plans/queries";

type OfflineState =
  | { kind: "saving"; saved: number; total: number }
  | { kind: "saved"; total: number }
  | { kind: "partial"; saved: number; total: number }
  | { kind: "idle" };

/**
 * The plan as members use it during a service: the ordered song list, each sheet one
 * tap away in a full-screen viewer with previous/next. Opening the plan saves its
 * sheets for offline use (spec §19 P9).
 *
 * Public share links pass `sheetBasePath` (e.g. /share/<token>/sheets): sheets then load
 * from there and nothing is saved on the device.
 */
export function PlanSongs({
  planId,
  planTitle,
  items,
  sheetBasePath,
}: {
  planId: string;
  planTitle: string;
  items: PlanItemView[];
  sheetBasePath?: string;
}) {
  const playable = items.filter((i) => i.arrangementId);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [offline, setOffline] = useState<OfflineState>({ kind: "idle" });

  useEffect(() => {
    if (sheetBasePath || !("caches" in window) || !playable.length || !navigator.onLine) return;
    let cancelled = false;
    saveSheetsForOffline(
      playable.map((i) => ({ arrangementId: i.arrangementId, version: i.fileVersion })),
      (saved, total) => !cancelled && setOffline({ kind: "saving", saved, total }),
    ).then(async ({ saved, failed, total }) => {
      if (cancelled) return;
      setOffline(failed ? { kind: "partial", saved, total } : { kind: "saved", total });
      if (!failed) rememberSavedPlan({ id: planId, title: planTitle, savedAt: new Date().toISOString(), songs: items.length });
      // Load the viewer code and PDF worker now, so the service worker keeps them for offline use.
      await preloadPdfViewer().catch(() => undefined);
      await saveAppAssetsForOffline();
      await savePageForOffline();
    });
    return () => {
      cancelled = true;
    };
    // Re-run only when the set of sheets changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable.map((i) => `${i.arrangementId}:${i.fileVersion}`).join(",")]);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No songs in this plan yet.
      </p>
    );
  }

  return (
    <>
      <OfflineStatus state={offline} />
      <ol className="divide-y rounded-lg border">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
            <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground" aria-hidden>
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="sr-only">{index + 1}. </span>
                {item.songTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {[item.arrangementTitle, item.musicalKey && `Key of ${item.musicalKey}`, item.bpm && `${item.bpm} BPM`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.notes ? <p className="mt-1 text-sm whitespace-pre-line">{item.notes}</p> : null}
            </div>
            <Button
              className="h-11 shrink-0"
              onClick={() => setOpenIndex(playable.findIndex((p) => p.id === item.id))}
              disabled={!item.arrangementId}
              aria-label={`Open sheet: ${item.songTitle}, ${item.arrangementTitle}`}
            >
              Open
            </Button>
          </li>
        ))}
      </ol>
      {openIndex !== null ? (
        <SheetDialog
          items={playable}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          sheetBasePath={sheetBasePath}
        />
      ) : null}
    </>
  );
}

function OfflineStatus({ state }: { state: OfflineState }) {
  const base = "mb-3 flex items-center gap-2 text-sm text-muted-foreground";
  switch (state.kind) {
    case "saving":
      return (
        <p role="status" className={base}>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving sheets for offline use… {state.saved}/{state.total}
        </p>
      );
    case "saved":
      return (
        <p role="status" className={base}>
          <CloudCheck className="size-4" aria-hidden />
          Available offline on this device
        </p>
      );
    case "partial":
      return (
        <p role="status" className={base}>
          <CloudDownload className="size-4" aria-hidden />
          {state.saved} of {state.total} sheets saved for offline use. Open this plan again while online to finish.
        </p>
      );
    default:
      return null;
  }
}

function SheetDialog({
  items,
  index,
  onIndexChange,
  onClose,
  sheetBasePath,
}: {
  items: PlanItemView[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  sheetBasePath?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const item = items[index];
  const [sheet, setSheet] = useState<{ id: string; file: Blob } | { id: string; error: true } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal(); // native modal: focus trap and Esc to close
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = sheetBasePath
      ? fetch(`${sheetBasePath}/${item.arrangementId}`).then((r) => {
          if (!r.ok) throw new Error(`Sheet unavailable (${r.status})`);
          return r.blob();
        })
      : loadSheet(item.arrangementId, item.fileVersion);
    load
      .then((file) => !cancelled && setSheet({ id: item.id, file }))
      .catch(() => !cancelled && setSheet({ id: item.id, error: true }));
    return () => {
      cancelled = true;
    };
  }, [item.id, item.arrangementId, item.fileVersion, sheetBasePath]);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  const current = sheet?.id === item.id ? sheet : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-labelledby="sheet-dialog-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
          <Button variant="ghost" className="size-11 shrink-0" onClick={() => dialogRef.current?.close()} aria-label="Close sheet">
            <X className="size-5" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 id="sheet-dialog-title" className="truncate font-semibold">
              {index + 1}. {item.songTitle}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {[item.arrangementTitle, item.musicalKey && `Key of ${item.musicalKey}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="outline" className="size-11 shrink-0" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous song">
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="size-11 shrink-0"
            onClick={() => go(1)}
            disabled={index === items.length - 1}
            aria-label="Next song"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {!current ? (
              <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading sheet…
              </p>
            ) : "error" in current ? (
              <p role="alert" className="flex min-h-48 items-center justify-center text-center text-sm">
                {sheetBasePath
                  ? "This sheet couldn't be loaded. The link may have expired or been revoked."
                  : "This sheet isn't available offline yet. Open it once while connected."}
              </p>
            ) : (
              <SheetViewer key={item.id} file={current.file} title={`${item.songTitle} — ${item.arrangementTitle}`} />
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
