"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchSongsForPlan } from "@/features/plans/actions";

export type SongResult = Awaited<ReturnType<typeof searchSongsForPlan>>[number];

/** Search the library from inside the plan editor and add a specific arrangement (PLAN-04/05). */
export function LibraryPanel({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (song: SongResult, arrangement: SongResult["arrangements"][number]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchSongsForPlan(query).catch(() => []);
      if (!cancelled) {
        setResults(found);
        setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <label htmlFor="library-search" className="sr-only">
          Search songs by title
        </label>
        <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" aria-hidden />
        <Input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs by title"
          className="h-11 pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Searching…
          </span>
        ) : query ? (
          `${results?.length ?? 0} matching songs`
        ) : (
          "Recently added songs"
        )}
        {lastAdded ? <span className="sr-only"> Added {lastAdded}.</span> : null}
      </p>

      {results && results.length === 0 && !loading ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {query ? "No songs match." : "The library has no songs yet."}{" "}
          <Link href="/library/new" className="underline underline-offset-4">
            Add music
          </Link>
        </p>
      ) : (
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {results?.map((song) => (
            <li key={song.id} className="rounded-lg border p-3">
              <p className="font-medium">{song.title}</p>
              {song.composer ? <p className="text-xs text-muted-foreground">{song.composer}</p> : null}
              <ul className="mt-2 grid gap-1">
                {song.arrangements.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm">
                      {a.title}
                      {a.musicalKey ? <span className="text-muted-foreground"> · {a.musicalKey}</span> : null}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 shrink-0 gap-1"
                      disabled={disabled}
                      onClick={() => {
                        onAdd(song, a);
                        setLastAdded(`${song.title}, ${a.title}`);
                      }}
                      aria-label={`Add ${song.title}, ${a.title}`}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
