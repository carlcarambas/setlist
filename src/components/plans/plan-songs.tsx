"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CloudCheck, Loader2, Menu, X } from "lucide-react";
import { SheetViewer } from "@/components/music/sheet-viewer";
import { Button } from "@/components/ui/button";
import type { PlanItemView } from "@/features/local-db/queries";
import { useFileIndex } from "@/features/offline/hooks";
import { loadSheet } from "@/features/offline/sheets";
import { useWakeLock } from "@/features/sheets/use-wake-lock";
import { cn } from "@/lib/utils";

/**
 * The plan as members use it during a service: the ordered song list, each sheet one
 * tap away in a full-screen viewer with previous/next. A sheet that's been opened stays on the
 * device; "Keep offline" (KeepOffline) saves them all (spec v2 §4.5).
 */
export function PlanSongs({ items }: { items: PlanItemView[] }) {
  const playable = items.filter((i) => i.arrangementId);
  const files = useFileIndex();
  const sheet = useSheetInUrl();
  const openIndex = playable.findIndex((p) => p.id === sheet.openId);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No songs in this plan yet.
      </p>
    );
  }

  return (
    <>
      <ol className="-mx-3 divide-y border-y">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-3 sm:py-4">
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
            {files?.has(item.arrangementId) ? (
              <CloudCheck className="size-4 shrink-0 text-muted-foreground" aria-label="On this device" />
            ) : null}
            <Button
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => sheet.open(item.id)}
              disabled={!item.arrangementId}
              aria-label={`Open sheet: ${item.songTitle}, ${item.arrangementTitle}`}
            >
              Open
            </Button>
          </li>
        ))}
      </ol>
      {openIndex >= 0 ? (
        <SheetDialog
          items={playable}
          index={openIndex}
          onIndexChange={(index) => sheet.change(playable[index].id)}
          onClose={sheet.close}
        />
      ) : null}
    </>
  );
}

/**
 * Which song's sheet is open, kept in the address (?sheet=<item id>). Opening adds a history entry,
 * so the phone's Back button or gesture closes the sheet and stays on the plan; changing song
 * replaces it, so one Back always closes. Uses the History API directly: no request, works offline.
 */
function useSheetInUrl() {
  const openId = useSearchParams().get("sheet");
  const pushed = useRef(false);
  const closing = useRef(false);

  useEffect(() => {
    if (openId) return;
    pushed.current = false;
    closing.current = false;
  }, [openId]);

  const urlWith = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("sheet", id);
    else url.searchParams.delete("sheet");
    return url;
  };

  return {
    openId,
    open(id: string) {
      closing.current = false;
      pushed.current = true;
      window.history.pushState(null, "", urlWith(id));
    },
    change(id: string) {
      window.history.replaceState(null, "", urlWith(id));
    },
    close() {
      // The dialog can report closing twice (our button, then its own event).
      if (closing.current) return;
      closing.current = true;
      if (pushed.current) window.history.back();
      else window.history.replaceState(null, "", urlWith(null));
    },
  };
}

function SheetDialog({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: PlanItemView[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const item = items[index];
  const [barHidden, setBarHidden] = useState(false);
  useWakeLock();
  const [sheet, setSheet] = useState<{ id: string; file: Blob; outdated: boolean } | { id: string; error: true } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal(); // native modal: focus trap and Esc to close
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [item.id]);

  useEffect(() => {
    let cancelled = false;
    loadSheet(item.arrangementId, item.fileVersion)
      .then(({ blob, outdated }) => !cancelled && setSheet({ id: item.id, file: blob, outdated }))
      .catch(() => !cancelled && setSheet({ id: item.id, error: true }));
    return () => {
      cancelled = true;
    };
  }, [item.id, item.arrangementId, item.fileVersion]);

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
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        // Anyone using a keyboard gets the controls back.
        if (e.key === "Tab") setBarHidden(false);
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-labelledby="sheet-dialog-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        {barHidden ? (
          <Button
            variant="outline"
            className="fixed top-[max(0.5rem,env(safe-area-inset-top))] left-2 z-10 size-11 bg-background"
            onClick={() => setBarHidden(false)}
            aria-label="Show controls"
          >
            <Menu className="size-5" aria-hidden />
          </Button>
        ) : null}
        <header
          className={cn(
            "flex items-center gap-2 border-b px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4",
            barHidden && "hidden",
          )}
        >
          <Button variant="ghost" className="size-11 shrink-0" onClick={onClose} aria-label="Close sheet">
            <X className="size-5" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 id="sheet-dialog-title" className="line-clamp-2 leading-tight font-semibold">
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
        <div ref={bodyRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none md:px-6 md:py-3">
          <div className="mx-auto max-w-4xl">
            {!current ? (
              <p role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading sheet…
              </p>
            ) : "error" in current ? (
              <p role="alert" className="flex min-h-48 items-center justify-center text-center text-sm">
                This sheet isn&apos;t available offline yet. Open it once while connected.
              </p>
            ) : (
              <>
                {current.outdated ? <OutdatedNote /> : null}
                <SheetViewer
                  key={item.id}
                  file={current.file}
                  title={`${item.songTitle} — ${item.arrangementTitle}`}
                  onTap={() => {
                    // Focus moves to the sheet first, so it isn't lost with the hidden bar.
                    bodyRef.current?.focus({ preventScroll: true });
                    setBarHidden((hidden) => !hidden);
                  }}
                  hideControls={barHidden}
                  fullScreen
                />
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function OutdatedNote() {
  return (
    <p role="status" className="mb-3 rounded-lg border bg-surface-soft p-3 text-sm">
      Older version: this sheet was replaced since it was saved. The new one downloads when you&apos;re online.
    </p>
  );
}
