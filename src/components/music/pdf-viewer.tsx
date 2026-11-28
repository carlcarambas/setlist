"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Must be set in the same module that renders <Document> (react-pdf README).
export const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** Page widths as a multiple of the screen's: fit, larger, largest. */
const ZOOM_STEPS = [1, 1.5, 2];
const ZOOM_KEY = "setlist:sheet-zoom";

/** The reader's chosen size, remembered so it holds from song to song. */
function savedStep() {
  try {
    const step = Number(localStorage.getItem(ZOOM_KEY));
    return ZOOM_STEPS[step] ? step : 0;
  } catch {
    return 0;
  }
}

/**
 * Renders every page at the container's width, so a sheet is as large as the screen allows. Zoom
 * (button or double tap) re-renders sharper, wider pages that pan sideways. Text/annotation layers
 * are off: sheet music doesn't need them.
 */
export default function PdfViewer({
  file,
  title,
  onTap,
  hideControls = false,
  fullScreen = false,
}: {
  file: string | Blob;
  title: string;
  /** A single tap on a page (the full-screen viewer uses it to hide its top bar). */
  onTap?: () => void;
  hideControls?: boolean;
  /** In the full-screen viewer there is no tab bar to keep clear of. */
  fullScreen?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [pageCount, setPageCount] = useState(0);
  // This component only renders in the browser, so the saved size can be read right away.
  const [step, setStep] = useState(savedStep);
  const tapTimer = useRef<number | null>(null);
  const zoom = ZOOM_STEPS[step];
  const nextStep = (step + 1) % ZOOM_STEPS.length;

  useEffect(() => () => window.clearTimeout(tapTimer.current ?? undefined), []);

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, String(step));
    } catch {}
  }, [step]);

  // Waits briefly after a tap, so a double tap (zoom) doesn't also count as a single tap.
  function tap() {
    if (tapTimer.current !== null) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setStep(nextStep);
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      onTap?.();
    }, 280);
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full touch-manipulation overflow-x-auto" onClick={tap}>
        <Document
          file={file}
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
                <figure
                  key={i}
                  className="mb-2 w-fit overflow-hidden border-y bg-white md:mb-4 md:rounded-lg md:border-y-0 md:ring-1 md:ring-border"
                >
                  <Page
                    pageNumber={i + 1}
                    width={Math.floor(width * zoom)}
                    // Sharp on high-density screens without exceeding mobile canvas limits when zoomed.
                    devicePixelRatio={Math.min(window.devicePixelRatio, zoom > 1 ? 2 : 3)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={<div style={{ width, height: width * 1.3 }} className="animate-pulse bg-muted" />}
                  />
                  <figcaption className="sr-only">
                    {title}, page {i + 1} of {pageCount}
                  </figcaption>
                </figure>
              ))
            : null}
        </Document>
      </div>
      {pageCount > 1 ? (
        <p className="text-center text-xs text-muted-foreground">{pageCount} pages</p>
      ) : null}
      {pageCount && !hideControls ? (
        <div
          className={cn(
            "pointer-events-none sticky z-10 flex justify-end p-3",
            fullScreen ? "bottom-[env(safe-area-inset-bottom)]" : "bottom-20 md:bottom-3",
          )}
        >
          <Button
            variant="outline"
            className="pointer-events-auto h-11 gap-2"
            onClick={() => setStep(nextStep)}
          >
            {nextStep === 0 ? <ZoomOut className="size-4" aria-hidden /> : <ZoomIn className="size-4" aria-hidden />}
            {nextStep === 0 ? "Fit width" : "Zoom in"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ViewerMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? "alert" : "status"}
      className="flex min-h-48 items-center justify-center gap-2 rounded-lg border p-6 text-center text-sm text-muted-foreground"
    >
      {error ? <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden /> : null}
      {children}
    </div>
  );
}
