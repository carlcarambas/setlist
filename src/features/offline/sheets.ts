"use client";

import { localDb } from "@/features/local-db/db";

/**
 * Offline copies of PDF sheets (spec v2 §4.5). Bytes live in Cache Storage "setlist-sheets-v1"
 * (kept across app updates), keyed by arrangement id + file version, so a replaced PDF is fetched
 * again. The Dexie table `sheet_files` indexes them for badges and totals.
 */
const SHEETS_CACHE = "setlist-sheets-v1";
const PREFIX = "/__offline/sheets/";

const keyFor = (arrangementId: string, version: string) => `${PREFIX}${arrangementId}?v=${encodeURIComponent(version)}`;

const hasCaches = () => typeof window !== "undefined" && "caches" in window;

/** Raised when the browser refuses to store more (spec v2 §4.5 "Storage limits"). */
export class StorageFullError extends Error {}
/** The server no longer has this sheet. */
export class SheetGoneError extends Error {}

function isQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
}

async function savedVersions(arrangementId: string) {
  if (!hasCaches()) return [];
  const cache = await caches.open(SHEETS_CACHE);
  return (await cache.keys()).filter((r) => new URL(r.url).pathname === `${PREFIX}${arrangementId}`);
}

/**
 * Downloads a sheet and saves it, replacing older versions only after the new one is stored.
 * `pinned` marks it as saved on its own (kept even when no kept plan needs it).
 */
export async function saveSheet(arrangementId: string, version: string, pinned: boolean): Promise<Blob> {
  // Authorized by the app, then redirected to a short-lived Storage URL.
  const response = await fetch(`/api/sheets/${arrangementId}`, { credentials: "same-origin" });
  if (response.status === 404) throw new SheetGoneError();
  if (!response.ok) throw new Error(`Sheet unavailable (${response.status})`);
  const blob = await response.blob();
  if (!hasCaches()) return blob;

  const cache = await caches.open(SHEETS_CACHE);
  const old = await savedVersions(arrangementId);
  try {
    await cache.put(keyFor(arrangementId, version), new Response(blob, { headers: { "Content-Type": "application/pdf" } }));
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError();
    throw error;
  }
  for (const request of old) {
    if (new URL(request.url).searchParams.get("v") !== version) await cache.delete(request);
  }
  const db = localDb();
  const existing = await db.sheet_files.get(arrangementId);
  await db.sheet_files.put({
    arrangement_id: arrangementId,
    version,
    bytes: blob.size,
    saved_at: new Date().toISOString(),
    pinned: pinned || Boolean(existing?.pinned),
  });
  return blob;
}

/**
 * The sheet's PDF for viewing. Saved copy at the current version first; online, download it (and keep
 * it: opened sheets stay on the device); otherwise any older saved version, flagged `outdated`.
 */
export async function loadSheet(arrangementId: string, version: string): Promise<{ blob: Blob; outdated: boolean }> {
  if (hasCaches()) {
    const exact = await (await caches.open(SHEETS_CACHE)).match(keyFor(arrangementId, version));
    if (exact) return { blob: await exact.blob(), outdated: false };
  }
  try {
    return { blob: await saveSheet(arrangementId, version, true), outdated: false };
  } catch (error) {
    const [older] = await savedVersions(arrangementId);
    const response = older ? await (await caches.open(SHEETS_CACHE)).match(older) : undefined;
    if (response) return { blob: await response.blob(), outdated: true };
    throw error;
  }
}

/** Removes a sheet's saved copies and its index entry. */
export async function deleteSheet(arrangementId: string) {
  if (hasCaches()) {
    const cache = await caches.open(SHEETS_CACHE);
    for (const request of await savedVersions(arrangementId)) await cache.delete(request);
  }
  await localDb().sheet_files.delete(arrangementId);
}

/** Removes every saved sheet and the list of kept plans. */
export async function deleteAllSheets() {
  if (hasCaches()) await caches.delete(SHEETS_CACHE);
  const db = localDb();
  await db.transaction("rw", db.sheet_files, db.kept_plans, async () => {
    await db.sheet_files.clear();
    await db.kept_plans.clear();
  });
}

/**
 * Makes the index match the cache: drops entries whose bytes are gone (e.g. the browser cleared the
 * cache) and indexes copies saved before the index existed. Runs at app start.
 */
export async function reconcileSheetIndex() {
  if (!hasCaches()) return;
  const db = localDb();
  const cache = await caches.open(SHEETS_CACHE);
  const cached = new Map<string, { version: string; request: Request }>();
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(PREFIX)) {
      cached.set(url.pathname.slice(PREFIX.length), { version: url.searchParams.get("v") ?? "", request });
    }
  }
  const indexed = await db.sheet_files.toArray();
  for (const row of indexed) {
    if (cached.get(row.arrangement_id)?.version !== row.version) await db.sheet_files.delete(row.arrangement_id);
  }
  const known = new Set(indexed.map((r) => r.arrangement_id));
  for (const [arrangementId, { version, request }] of cached) {
    if (known.has(arrangementId)) continue;
    const blob = await (await cache.match(request))?.blob();
    await db.sheet_files.put({
      arrangement_id: arrangementId,
      version,
      bytes: blob?.size ?? 0,
      saved_at: new Date().toISOString(),
      pinned: true,
    });
  }
}
