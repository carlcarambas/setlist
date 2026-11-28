"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibrarySearch } from "@/features/library/schemas";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

/** Plain GET form, so the search stays in the URL. */
export function LibrarySearchForm({ search, categories }: { search: LibrarySearch; categories: string[] }) {
  const filtered = search.q || search.category || search.tag || search.archived;
  return (
    <form method="get" action="/library" role="search" className="mb-6 grid gap-3">
      <div className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search by title
        </label>
        <Input id="q" name="q" type="search" placeholder="Search by title" defaultValue={search.q} className="h-11" />
        <Button type="submit" variant="outline" className="h-11 gap-2">
          <Search className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Search</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        {/* Keyed so that clearing the filters resets it. */}
        <CategorySelect key={search.category} initial={search.category} categories={categories} />
        {search.tag ? <input type="hidden" name="tag" value={search.tag} /> : null}
        <label className="flex min-h-11 items-center gap-2">
          <Checkbox key={String(search.archived)} name="archived" value="1" defaultChecked={search.archived} />
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

const ALL = "all categories";

/** "All categories" submits an empty value, which Radix can't give an item. */
function CategorySelect({ initial, categories }: { initial: string; categories: string[] }) {
  const [value, setValue] = useState(initial);
  // The current filter stays listed while the categories are still loading.
  const options = initial && !categories.includes(initial) ? [initial, ...categories] : categories;
  return (
    <>
      <input type="hidden" name="category" value={value} />
      <Select value={value || ALL} onValueChange={(v) => setValue(v === ALL ? "" : v)}>
        <SelectTrigger id="category" className="min-w-48" />
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {options.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
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
