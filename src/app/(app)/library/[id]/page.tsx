import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { ArchiveToggle } from "@/components/music/edit-forms";
import { Button } from "@/components/ui/button";
import { formatFileSize, getPiece } from "@/features/library/queries";
import { requireActiveMember } from "@/lib/auth/member";
import { z } from "zod";

export const metadata: Metadata = { title: "Music details" };

export default function PiecePage({ params }: PageProps<"/library/[id]">) {
  return (
    <>
      <Link href="/library" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Music Library
      </Link>
      <Suspense fallback={<SectionSkeleton />}>
        <PieceDetails params={params} />
      </Suspense>
    </>
  );
}

async function PieceDetails({ params }: Pick<PageProps<"/library/[id]">, "params">) {
  await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const piece = await getPiece(id.data);
  if (!piece) notFound();

  const archived = piece.status === "archived";
  const arrangements = piece.arrangements;

  return (
    <>
      <PageHeader
        title={piece.title}
        description={[piece.composer, piece.category].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href={`/library/${piece.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            </Button>
            <ArchiveToggle kind="piece" id={piece.id} archived={archived} name={piece.title} />
          </>
        }
      />

      {archived ? (
        <p role="status" className="mb-6 rounded-md border p-3 text-sm">
          <strong>Archived.</strong> This song is hidden from the library and can&apos;t get new
          arrangements. Plans that already use it keep working. Restore it to use it again.
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
            Arrangements ({arrangements.length})
          </h2>
          {!archived ? (
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href={`/library/${piece.id}/arrangements/new`}>
                <Plus className="size-4" aria-hidden />
                Add arrangement
              </Link>
            </Button>
          ) : null}
        </div>

        {arrangements.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sheets yet. Add an arrangement to upload a PDF.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {arrangements.map((a) => (
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
                    {a.uploader?.display_name ?? "a member"} on{" "}
                    {new Date(a.created_at).toLocaleDateString("en", { dateStyle: "medium" })}
                  </p>
                  {a.status === "archived" ? (
                    <span className="mt-1 inline-block rounded-full border px-2 py-0.5 text-xs">Archived</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="h-11 gap-2">
                    <Link href={`/sheets/${a.id}`}>
                      <Eye className="size-4" aria-hidden />
                      View
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 gap-2">
                    <a href={`/api/sheets/${a.id}?download=1`}>
                      <Download className="size-4" aria-hidden />
                      Download
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-11 gap-2">
                    <Link href={`/library/${piece.id}/arrangements/${a.id}/edit`} aria-label={`Edit ${a.title}`}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Added by {piece.creator?.display_name ?? "a member"} ·{" "}
        {new Date(piece.created_at).toLocaleDateString("en", { dateStyle: "medium" })}
      </p>
    </>
  );
}
