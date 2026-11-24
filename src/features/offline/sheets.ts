"use client";

/**
 * Offline copies of PDF sheets (spec v2 §4.5), kept in Cache Storage. App code and pages are
 * precached by the service worker; sheets are saved here when opened.
 * Keyed by arrangement id + file version, so a replaced PDF is fetched again.
 * Every cache Setlist creates starts with "setlist-".
 */
const CACHE_PREFIX = "setlist-";
const SHEETS_CACHE = `${CACHE_PREFIX}sheets-v1`;

const keyFor = (arrangementId: string, version: string) =>
  `/__offline/sheets/${arrangementId}?v=${encodeURIComponent(version)}`;

const hasCaches = () => typeof window !== "undefined" && "caches" in window;

/** Returns the sheet's PDF, from the offline copy if there is one, else from the server (and saves it). */
export async function loadSheet(arrangementId: string, version: string): Promise<Blob> {
  if (hasCaches()) {
    const cached = await (await caches.open(SHEETS_CACHE)).match(keyFor(arrangementId, version));
    if (cached) return cached.blob();
  }
  return fetchAndSave(arrangementId, version);
}

async function fetchAndSave(arrangementId: string, version: string): Promise<Blob> {
  // Authorized by the app, then redirected to a short-lived Storage URL.
  const response = await fetch(`/api/sheets/${arrangementId}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Sheet unavailable (${response.status})`);
  const blob = await response.blob();

  if (hasCaches()) {
    const cache = await caches.open(SHEETS_CACHE);
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname === `/__offline/sheets/${arrangementId}`) await cache.delete(request);
    }
    await cache.put(
      keyFor(arrangementId, version),
      new Response(blob, { headers: { "Content-Type": "application/pdf" } }),
    );
  }
  return blob;
}

export async function isSheetSaved(arrangementId: string, version: string) {
  if (!hasCaches()) return false;
  return Boolean(await (await caches.open(SHEETS_CACHE)).match(keyFor(arrangementId, version)));
}

/** Saves every sheet of a plan for offline use. Reports progress; skips ones already saved. */
export async function saveSheetsForOffline(
  sheets: { arrangementId: string; version: string }[],
  onProgress: (saved: number, total: number) => void,
) {
  const unique = [...new Map(sheets.map((s) => [s.arrangementId, s])).values()];
  let saved = 0;
  let failed = 0;
  onProgress(0, unique.length);
  for (const sheet of unique) {
    try {
      if (!(await isSheetSaved(sheet.arrangementId, sheet.version))) {
        await fetchAndSave(sheet.arrangementId, sheet.version);
      }
      saved += 1;
    } catch {
      failed += 1;
    }
    onProgress(saved, unique.length);
  }
  return { saved, failed, total: unique.length };
}
