import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { LibrarySearchForm, searchHref } from "@/components/music/library-search";
import { Button } from "@/components/ui/button";
import { listCategories, searchLibrary } from "@/features/library/queries";
import { librarySearchSchema } from "@/features/library/schemas";
import { isAdmin, requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Music Library" };

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <>
      <PageHeader
        title="Music Library"
        description="Search, preview and download the ministry's sheet music."
        actions={
          <Suspense>
            <AddMusicAction />
          </Suspense>
        }
      />
      <Suspense fallback={<SectionSkeleton />}>
        <LibraryResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Administrators only (spec v2 §4.2). */
async function AddMusicAction() {
  if (!isAdmin(await requireActiveMember())) return null;
  return (
    <Button asChild className="h-11 gap-2">
      <Link href="/library/new">
        <Plus className="size-4" aria-hidden />
        Add music
      </Link>
    </Button>
  );
}

async function LibraryResults({ searchParams }: Pick<PageProps<"/library">, "searchParams">) {
  const admin = isAdmin(await requireActiveMember());
  const search = librarySearchSchema.parse(await searchParams);
  const [{ pieces, total, pageCount }, categories] = await Promise.all([
    searchLibrary(search),
    listCategories(),
  ]);
  const filtered = Boolean(search.q || search.category || search.tag);

  return (
    <>
      <LibrarySearchForm search={search} categories={categories} />

      {pieces.length === 0 ? (
        filtered ? (
          <EmptyState icon={Library} title="No music matches your search">
            Try a shorter title or clear the filters.
          </EmptyState>
        ) : (
          <EmptyState icon={Library} title="The library is empty">
            {admin ? (
              <>
                <Link href="/library/new" className="underline underline-offset-4">
                  Add the first song
                </Link>{" "}
                by uploading a PDF.
              </>
            ) : (
              "An administrator adds the music. Check back soon."
            )}
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "song" : "songs"}
          </p>
          <ul className="divide-y rounded-lg border">
            {pieces.map((p) => (
              <li key={p.id} className="relative flex flex-col gap-1 p-4 hover:bg-accent/50">
                <Link href={`/library/${p.id}`} className="font-medium after:absolute after:inset-0">
                  {p.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[p.composer, p.category, `${p.arrangementCount} ${p.arrangementCount === 1 ? "arrangement" : "arrangements"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.tags.length || p.status === "archived" ? (
                  <p className="relative z-10 mt-1 flex flex-wrap gap-2 text-xs">
                    {p.status === "archived" ? <span className="rounded-full border px-2 py-0.5">Archived</span> : null}
                    {p.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={searchHref(search, { tag, page: 1 })}
                        className="rounded-full bg-muted px-2 py-0.5 hover:underline"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
              {search.page > 1 ? (
                <Link href={searchHref(search, { page: search.page - 1 })} className="min-h-11 content-center underline underline-offset-4">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                Page {search.page} of {pageCount}
              </span>
              {search.page < pageCount ? (
                <Link href={searchHref(search, { page: search.page + 1 })} className="min-h-11 content-center underline underline-offset-4">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
