"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page fails unexpectedly. Server errors arrive with only a reference (digest) that
 * matches the entry Next.js writes to the server log (Railway → Logs); no details reach the browser.
 */
export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";
  useEffect(() => {
    console.error("Setlist page error", digest || error);
  }, [error, digest]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page couldn&apos;t load. Try again; if it keeps happening, tell an administrator
        {digest ? (
          <>
            {" "}
            and mention reference <code className="font-mono">{digest}</code>
          </>
        ) : null}
        .
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button className="h-11" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild variant="outline" className="h-11">
          {/* A full page load, so a broken client state can't follow along. */}
          <a href="/dashboard">Go to Home</a>
        </Button>
      </div>
    </div>
  );
}
