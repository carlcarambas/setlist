"use client";

/**
 * Offline copies of PDF sheets (spec §19 P9), kept in Cache Storage.
 * Keyed by arrangement id + file version, so a replaced PDF is fetched again.
 * Every cache Setlist creates starts with "setlist-", so sign-out can clear them all.
 */
export const CACHE_PREFIX = "setlist-";
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

const ASSETS_CACHE = `${CACHE_PREFIX}assets-v1`;

/**
 * Saves every script, stylesheet and font this page has loaded, so it can start offline.
 * The service worker also caches assets as they pass through it, but files the browser
 * served from its own memory cache never reach it, and one missing chunk breaks the page.
 */
export async function saveAppAssetsForOffline() {
  if (!hasCaches()) return;
  const urls = new Set<string>();
  const add = (raw: string | null) => {
    if (!raw) return;
    const url = new URL(raw, location.href);
    if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) urls.add(url.pathname + url.search);
  };
  for (const entry of performance.getEntriesByType("resource")) add(entry.name);
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((s) => add(s.getAttribute("src")));
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((l) => add(l.getAttribute("href")));

  const cache = await caches.open(ASSETS_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search));
  await Promise.all([...urls].filter((u) => !have.has(u)).map((u) => cache.add(u).catch(() => undefined)));
}

/**
 * Saves the current page's HTML for offline use. Needed on the first visit, which loads
 * before the service worker is in control and so never passes through it.
 */
export async function savePageForOffline() {
  if (!hasCaches()) return;
  const response = await fetch(location.pathname, { headers: { Accept: "text/html" }, credentials: "same-origin" }).catch(
    () => null,
  );
  if (response?.ok && !response.redirected) {
    await (await caches.open(`${CACHE_PREFIX}pages-v1`)).put(location.pathname, response);
  }
}

const SAVED_PLANS_KEY = "setlist:offline-plans";

export type SavedPlan = { id: string; title: string; savedAt: string; songs: number };

/** Remembers which plans are saved on this device, for the offline page's list. */
export function rememberSavedPlan(plan: SavedPlan) {
  try {
    const all = listSavedPlans().filter((p) => p.id !== plan.id);
    localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify([plan, ...all].slice(0, 50)));
  } catch {
    // Storage full or blocked: the plan still works offline, it just isn't listed.
  }
}

export function listSavedPlans(): SavedPlan[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_PLANS_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedPlan[]) : [];
  } catch {
    return [];
  }
}

/**
 * Removes this member's offline data: saved plan pages, sheets and the saved-plans list.
 * Called on sign-out. App code (no personal data) is kept, and the offline page is saved
 * again so it still works after the next sign-in.
 */
export async function clearOfflineData() {
  try {
    localStorage.removeItem(SAVED_PLANS_KEY);
  } catch {}
  if (!hasCaches()) return;
  const keep = `${CACHE_PREFIX}assets-v1`;
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== keep).map((n) => caches.delete(n)));
  await caches
    .open(`${CACHE_PREFIX}pages-v1`)
    .then((cache) => cache.add("/offline"))
    .catch(() => undefined);
}
