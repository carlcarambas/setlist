"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Library, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { LibrarySearchForm, searchHref } from "@/components/music/library-search";
import { Button } from "@/components/ui/button";
import { librarySearchSchema } from "@/features/library/schemas";
import { localDb } from "@/features/local-db/db";
import { useIsAdmin } from "@/features/local-db/hooks";
import { listCategories, searchLibrary } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";

export function LibraryView() {
  const params = useSearchParams();
  const search = librarySearchSchema.parse(Object.fromEntries(params));
  const isAdmin = useIsAdmin();
  const result = useLiveQuery(() => searchLibrary(localDb(), search), [search]);
  const categories = useLiveQuery(() => listCategories(localDb()), []) ?? [];
  const filtered = Boolean(search.q || search.category || search.tag);

  return (
    <>
      <PageHeader
        title="Music Library"
        description="Search, preview and download the ministry's sheet music."
        actions={
          isAdmin ? (
            <OnlineOnly>
              <Button asChild className="h-11 gap-2">
                <Link href="/library/new">
                  <Plus className="size-4" aria-hidden />
                  Add music
                </Link>
              </Button>
            </OnlineOnly>
          ) : undefined
        }
      />
      <LibrarySearchForm search={search} categories={categories} />

      {result === undefined ? (
        <LocalSkeleton />
      ) : result.pieces.length === 0 ? (
        filtered ? (
          <EmptyState icon={Library} title="No music matches your search">
            Try a shorter title or clear the filters.
          </EmptyState>
        ) : (
          <EmptyState icon={Library} title="The library is empty">
            {isAdmin ? (
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
            {result.total} {result.total === 1 ? "song" : "songs"}
          </p>
          <ul className="-mx-3 divide-y border-y">
            {result.pieces.map((p) => (
              <li key={p.id} className="relative flex flex-col gap-1 px-3 py-4 hover:bg-surface-soft">
                <Link href={`/song?id=${p.id}`} className="font-medium after:absolute after:inset-0">
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
                        className="rounded-full bg-muted px-3 py-1 hover:underline"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {result.pageCount > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
              {result.page > 1 ? (
                <Link href={searchHref(search, { page: result.page - 1 })} className="min-h-11 content-center underline underline-offset-4">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                Page {result.page} of {result.pageCount}
              </span>
              {result.page < result.pageCount ? (
                <Link href={searchHref(search, { page: result.page + 1 })} className="min-h-11 content-center underline underline-offset-4">
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
