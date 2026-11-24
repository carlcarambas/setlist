import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibrarySearch } from "@/features/library/schemas";

/** Plain GET form: works without JavaScript and keeps the search in the URL. */
export function LibrarySearchForm({ search, categories }: { search: LibrarySearch; categories: string[] }) {
  const filtered = search.q || search.category || search.tag || search.archived;
  return (
    <form method="get" action="/library" role="search" className="mb-6 grid gap-3">
      <div className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search by title
        </label>
        <Input id="q" name="q" type="search" placeholder="Search by title" defaultValue={search.q} className="h-11" />
        <Button type="submit" className="h-11 gap-2">
          <Search className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={search.category}
          className="h-11 rounded-md border bg-background px-3"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {search.tag ? <input type="hidden" name="tag" value={search.tag} /> : null}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="archived" value="1" defaultChecked={search.archived} className="size-4" />
          Include archived
        </label>
        {search.tag ? (
          <span className="rounded-full border px-3 py-1">
            Tag: {search.tag}
          </span>
        ) : null}
        {filtered ? (
          <Link href="/library" className="min-h-11 content-center underline underline-offset-4">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function searchHref(search: LibrarySearch, changes: Partial<LibrarySearch>) {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.tag) params.set("tag", next.tag);
  if (next.archived) params.set("archived", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}
