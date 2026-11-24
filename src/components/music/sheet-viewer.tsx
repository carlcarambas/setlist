"use client";

import dynamic from "next/dynamic";

// One shared import() so preloading fetches exactly the chunks the viewer uses.
// (Two separate import() calls can be split into different chunks, and offline only the
// preloaded ones are saved.)
const loadPdfViewer = () => import("./pdf-viewer");

// react-pdf needs the browser (canvas, workers), so it never renders on the server.
const PdfViewer = dynamic(loadPdfViewer, {
  ssr: false,
  loading: () => (
    <div role="status" className="flex min-h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      Loading viewer…
    </div>
  ),
});

/** Loads the viewer code and PDF worker ahead of time (used before going offline). */
export async function preloadPdfViewer() {
  const viewer = await loadPdfViewer();
  await fetch(viewer.workerSrc).catch(() => undefined);
}

export function SheetViewer({ file, title }: { file: string | Blob; title: string }) {
  return <PdfViewer file={file} title={title} />;
}
