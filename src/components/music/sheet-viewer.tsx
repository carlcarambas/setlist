"use client";

import dynamic from "next/dynamic";

// react-pdf needs the browser (canvas, workers), so it never renders on the server.
const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      Loading viewer…
    </div>
  ),
});

export function SheetViewer({ url, title }: { url: string; title: string }) {
  return <PdfViewer url={url} title={title} />;
}
