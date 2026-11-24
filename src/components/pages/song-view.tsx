"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CloudCheck, Download, Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, NotOnDevice, OnlineOnly } from "@/components/local/states";
import { ArchiveToggle } from "@/components/music/edit-forms";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/features/library/schemas";
import { localDb } from "@/features/local-db/db";
import { useIsAdmin } from "@/features/local-db/hooks";
import { getSong } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import { isSheetSaved } from "@/features/offline/sheets";

export function SongView() {
  const id = useSearchParams().get("id") ?? "";
  const isAdmin = useIsAdmin();
  const piece = useLiveQuery(() => getSong(localDb(), id), [id]);
  const saved = useLiveQuery(
    async () => {
      const song = await getSong(localDb(), id);
      const entries = await Promise.all(
        (song?.arrangements ?? []).map(async (a) => [a.id, await isSheetSaved(a.id, a.fileVersion)] as const),
      );
      return new Map(entries);
    },
    [id],
  );

  const back = (
    <Link href="/library" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      Music Library
    </Link>
  );

  if (piece === undefined) return <LocalSkeleton />;
  if (piece === null) {
    return (
      <>
        {back}
        <NotOnDevice what="song" backHref="/library" backLabel="Back to the library" />
      </>
    );
  }

  const archived = piece.status === "archived";
  return (
    <>
      {back}
      <PageHeader
        title={piece.title}
        description={[piece.composer, piece.category].filter(Boolean).join(" · ") || undefined}
        actions={
          isAdmin ? (
            <OnlineOnly>
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link href={`/library/${piece.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              </Button>
              <ArchiveToggle kind="piece" id={piece.id} archived={archived} name={piece.title} />
            </OnlineOnly>
          ) : undefined
        }
      />

      {archived ? (
        <p role="status" className="mb-6 rounded-md border p-3 text-sm">
          <strong>Archived.</strong> This song is hidden from the library and can&apos;t get new arrangements.
          Plans that already use it keep working.
        </p>
      ) : null}

      {piece.description ? <p className="mb-4 max-w-prose whitespace-pre-line">{piece.description}</p> : null}
      {piece.tags.length ? (
        <p className="mb-6 flex flex-wrap gap-2 text-xs">
          {piece.tags.map((tag) => (
            <Link key={tag} href={`/library?tag=${encodeURIComponent(tag)}`} className="rounded-full bg-muted px-2 py-0.5 hover:underline">
              #{tag}
            </Link>
          ))}
        </p>
      ) : null}

      <section aria-labelledby="arrangements-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="arrangements-heading" className="text-lg font-semibold">
            Arrangements ({piece.arrangements.length})
          </h2>
          {isAdmin && !archived ? (
            <OnlineOnly>
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link href={`/library/${piece.id}/arrangements/new`}>
                  <Plus className="size-4" aria-hidden />
                  Add arrangement
                </Link>
              </Button>
            </OnlineOnly>
          ) : null}
        </div>

        {piece.arrangements.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No sheets yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {piece.arrangements.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.title}
                    {a.musical_key ? <span className="text-muted-foreground"> · Key of {a.musical_key}</span> : null}
                    {a.bpm ? <span className="text-muted-foreground"> · {a.bpm} BPM</span> : null}
                  </p>
                  {a.instrument_notes ? <p className="text-sm">{a.instrument_notes}</p> : null}
                  <p className="truncate text-xs text-muted-foreground">
                    {a.original_filename} · {formatFileSize(a.file_size_bytes)} · uploaded by{" "}
                    {a.uploaderName ?? "an administrator"} on{" "}
                    {new Date(a.created_at).toLocaleDateString("en", { dateStyle: "medium" })}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    {a.status === "archived" ? <span className="rounded-full border px-2 py-0.5">Archived</span> : null}
                    {saved?.get(a.id) ? (
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <CloudCheck className="size-3" aria-hidden />
                        On this device
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="h-11 gap-2">
                    <Link href={`/sheet?id=${a.id}`}>
                      <Eye className="size-4" aria-hidden />
                      View
                    </Link>
                  </Button>
                  <OnlineOnly label="Download needs a connection">
                    <Button asChild variant="outline" className="h-11 gap-2">
                      <a href={`/api/sheets/${a.id}?download=1`}>
                        <Download className="size-4" aria-hidden />
                        Download
                      </a>
                    </Button>
                  </OnlineOnly>
                  {isAdmin ? (
                    <OnlineOnly>
                      <Button asChild variant="outline" className="h-11 gap-2">
                        <Link href={`/library/${piece.id}/arrangements/${a.id}/edit`} aria-label={`Edit ${a.title}`}>
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </Link>
                      </Button>
                    </OnlineOnly>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
