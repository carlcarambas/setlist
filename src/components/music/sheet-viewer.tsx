"use client";

import dynamic from "next/dynamic";

// The service worker precaches every chunk of the build, including this one, for offline use.
const loadPdfViewer = () => import("./pdf-viewer");

// react-pdf needs the browser (canvas, workers), so it never renders on the server.
const PdfViewer = dynamic(loadPdfViewer, {
  ssr: false,
  loading: () => (
    <div role="status" className="flex min-h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
      Loading viewer…
    </div>
  ),
});

export function SheetViewer(props: {
  file: string | Blob;
  title: string;
  onTap?: () => void;
  hideControls?: boolean;
  fullScreen?: boolean;
}) {
  return <PdfViewer {...props} />;
}
