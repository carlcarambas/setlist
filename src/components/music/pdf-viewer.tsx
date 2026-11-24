"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AlertCircle } from "lucide-react";

// Must be set in the same module that renders <Document> (react-pdf README).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** Renders every page at the container's width. Text/annotation layers are off: sheet music doesn't need them. */
export default function PdfViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        loading={<ViewerMessage>Loading sheet…</ViewerMessage>}
        error={
          <ViewerMessage error>
            The sheet couldn&apos;t be displayed. Try downloading it instead, or reload the page.
          </ViewerMessage>
        }
      >
        {width
          ? Array.from({ length: pageCount }, (_, i) => (
              <figure key={i} className="mb-4 overflow-hidden rounded-md border bg-white shadow-sm">
                <Page
                  pageNumber={i + 1}
                  width={width}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<div style={{ height: width * 1.3 }} className="animate-pulse bg-muted" />}
                />
                <figcaption className="sr-only">
                  {title}, page {i + 1} of {pageCount}
                </figcaption>
              </figure>
            ))
          : null}
      </Document>
      {pageCount > 1 ? (
        <p className="text-center text-xs text-muted-foreground">{pageCount} pages</p>
      ) : null}
    </div>
  );
}

function ViewerMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className="flex min-h-48 items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
    >
      {error ? <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden /> : null}
      {children}
    </div>
  );
}
