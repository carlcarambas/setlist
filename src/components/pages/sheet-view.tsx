"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { LocalSkeleton, NotOnDevice, OnlineOnly } from "@/components/local/states";
import { SheetViewer } from "@/components/music/sheet-viewer";
import { OutdatedNote } from "@/components/plans/plan-songs";
import { Button } from "@/components/ui/button";
import { localDb } from "@/features/local-db/db";
import { getSheet } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import { loadSheet } from "@/features/offline/sheets";
import { useWakeLock } from "@/features/sheets/use-wake-lock";

/** One sheet, from the device's saved copy if there is one, else downloaded (and saved). */
export function SheetView() {
  useWakeLock();
  const id = useSearchParams().get("id") ?? "";
  const sheet = useLiveQuery(() => getSheet(localDb(), id), [id]);
  const version = sheet?.fileVersion;
  const [file, setFile] = useState<{ key: string; blob?: Blob; outdated?: boolean; error?: true } | null>(null);
  const key = `${id}:${version}`;

  useEffect(() => {
    if (!version) return;
    let cancelled = false;
    loadSheet(id, version)
      .then(({ blob, outdated }) => !cancelled && setFile({ key, blob, outdated }))
      .catch(() => !cancelled && setFile({ key, error: true }));
    return () => {
      cancelled = true;
    };
  }, [id, version, key]);

  if (sheet === undefined) return <LocalSkeleton />;
  if (sheet === null) return <NotOnDevice what="sheet" backHref="/library" backLabel="Back to the library" />;

  const { arrangement, piece } = sheet;
  const current = file?.key === key ? file : null;
  return (
    <div data-wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/song?id=${piece.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {piece.title}
          </Link>
          <h1 className="text-2xl font-semibold">
            {arrangement.title}
            {arrangement.musical_key ? <span className="text-muted-foreground"> · Key of {arrangement.musical_key}</span> : null}
          </h1>
        </div>
        <OnlineOnly label="Download needs a connection">
          <Button asChild variant="outline" className="h-11 gap-2">
            <a href={`/api/sheets/${arrangement.id}?download=1`}>
              <Download className="size-4" aria-hidden />
              Download
            </a>
          </Button>
        </OnlineOnly>
      </div>
      {!current ? (
        <LocalSkeleton />
      ) : current.blob ? (
        <>
          {current.outdated ? <OutdatedNote /> : null}
          <div className="-mx-4 md:mx-0">
            <SheetViewer file={current.blob} title={`${piece.title} — ${arrangement.title}`} />
          </div>
        </>
      ) : (
        <p role="alert" className="rounded-lg border p-6 text-center text-sm">
          This sheet isn&apos;t saved on this device yet. Open it once while connected.
        </p>
      )}
    </div>
  );
}
