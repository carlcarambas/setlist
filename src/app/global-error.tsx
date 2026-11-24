"use client";

import "./globals.css";
import { ErrorView } from "@/components/layout/error-view";

/** Replaces the root layout when it fails; must render its own <html> and <body>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh px-4 antialiased">
        <title>Something went wrong · Setlist</title>
        <ErrorView error={error} retry={retry} />
      </body>
    </html>
  );
}
