"use client";

import { localDb, type SetlistDB } from "@/features/local-db/db";
import { fileVersion } from "@/features/local-db/queries";
import { deleteSheet, saveSheet, SheetGoneError, StorageFullError } from "./sheets";
import { missingSheets, removableSheets, type FileIndex, type SheetRef } from "./status";

/**
 * One download queue for the whole app (spec v2 §4.5 OFF-04/OFF-09): 3 at a time, one retry per
 * sheet. Progress is shared, so leaving a page doesn't cancel anything. Storage full stops the queue;
 * other failures are listed for Retry. Never runs offline.
 */

export type ItemState = "queued" | "downloading" | "failed" | "gone";
type Item = { version: string; bytes: number; pinned: boolean; state: ItemState; attempts: number };

export type DownloadsSnapshot = {
  items: ReadonlyMap<string, Readonly<Item>>;
  storageFull: boolean;
};

const CONCURRENCY = 3;
let items = new Map<string, Item>();
let storageFull = false;
let active = 0;
let snapshot: DownloadsSnapshot = { items, storageFull };
const listeners = new Set<() => void>();

function emit() {
  items = new Map(items);
  snapshot = { items, storageFull };
  listeners.forEach((l) => l());
}

export function subscribeDownloads(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDownloads() {
  return snapshot;
}

/** Queues sheets that aren't saved at their current version yet. */
export function enqueue(sheets: SheetRef[], pinned: boolean) {
  for (const s of sheets) {
    const current = items.get(s.arrangementId);
    if (current && current.state !== "failed") continue;
    items.set(s.arrangementId, { version: s.version, bytes: s.bytes, pinned, state: "queued", attempts: 0 });
  }
  storageFull = false;
  emit();
  pump();
}

/** Re-queues the given failed sheets (or all failures). */
export function retryFailed(arrangementIds?: string[]) {
  for (const [id, item] of items) {
    if (item.state === "failed" && (!arrangementIds || arrangementIds.includes(id))) {
      items.set(id, { ...item, state: "queued", attempts: 0 });
    }
  }
  storageFull = false;
  emit();
  pump();
}

function pump() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  while (active < CONCURRENCY && !storageFull) {
    const next = [...items].find(([, item]) => item.state === "queued");
    if (!next) return;
    void run(next[0], next[1]);
  }
}

async function run(arrangementId: string, item: Item) {
  active += 1;
  items.set(arrangementId, { ...item, state: "downloading", attempts: item.attempts + 1 });
  emit();
  try {
    await saveSheet(arrangementId, item.version, item.pinned);
    items.delete(arrangementId); // now in the sheet index
  } catch (error) {
    const current = items.get(arrangementId) ?? item;
    if (error instanceof StorageFullError) {
      storageFull = true;
      // Keep what succeeded; everything not yet downloaded waits for Retry.
      for (const [id, other] of items) if (other.state !== "gone") items.set(id, { ...other, state: "failed" });
    } else if (error instanceof SheetGoneError) {
      items.set(arrangementId, { ...current, state: "gone" });
    } else {
      items.set(arrangementId, { ...current, state: current.attempts < 2 ? "queued" : "failed" });
    }
  } finally {
    active -= 1;
    emit();
    pump();
  }
}

if (typeof window !== "undefined") window.addEventListener("online", () => pump());

// ---------------------------------------------------------------------------
// Plans kept offline
// ---------------------------------------------------------------------------

/** A plan's sheets at their current versions (archived ones included: they still open in plans). */
export async function planSheets(db: SetlistDB, planId: string): Promise<SheetRef[]> {
  const rows = await db.plan_items.where("plan_id").equals(planId).toArray();
  const arrangements = await db.arrangements.bulkGet(rows.map((r) => r.arrangement_id));
  return arrangements
    .filter((a) => a !== undefined)
    .map((a) => ({ arrangementId: a.id, version: fileVersion(a), bytes: a.file_size_bytes }));
}

export async function fileIndex(db: SetlistDB): Promise<FileIndex> {
  return new Map((await db.sheet_files.toArray()).map((f) => [f.arrangement_id, f]));
}

/** Asks the browser not to evict our data (spec v2 OFF-10). Called from a tap, as some browsers want. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function keepPlan(planId: string) {
  void requestPersistentStorage();
  const db = localDb();
  await db.kept_plans.put({ plan_id: planId, kept_at: new Date().toISOString() });
  enqueue(missingSheets(await planSheets(db, planId), await fileIndex(db)), false);
}

/** Stops keeping a plan and deletes its sheets unless pinned or needed by another kept plan. */
export async function unkeepPlan(planId: string) {
  const db = localDb();
  await db.kept_plans.delete(planId);
  const ids = (await planSheets(db, planId)).map((s) => s.arrangementId);
  for (const id of ids) items.delete(id);
  emit();
  const removable = removableSheets(ids, await sheetsNeededByKeptPlans(db), await fileIndex(db));
  for (const id of removable) await deleteSheet(id);
}

/** Saves one sheet on its own (song page). */
export async function pinSheet(sheet: SheetRef) {
  void requestPersistentStorage();
  const db = localDb();
  const saved = await db.sheet_files.get(sheet.arrangementId);
  if (saved?.version === sheet.version) await db.sheet_files.update(sheet.arrangementId, { pinned: true });
  else enqueue([sheet], true);
}

/** Removes a sheet saved on its own. It stays if a kept plan needs it (then only the pin goes). */
export async function unpinSheet(arrangementId: string) {
  const db = localDb();
  if ((await sheetsNeededByKeptPlans(db)).has(arrangementId)) {
    await db.sheet_files.update(arrangementId, { pinned: false });
  } else {
    await deleteSheet(arrangementId);
  }
}

async function sheetsNeededByKeptPlans(db: SetlistDB) {
  const kept = await db.kept_plans.toArray();
  const lists = await Promise.all(kept.map((k) => planSheets(db, k.plan_id)));
  return new Set(lists.flat().map((s) => s.arrangementId));
}

/**
 * After each sync: download new or replaced sheets of kept plans, and delete unpinned sheets that no
 * kept plan needs anymore (e.g. a song removed from a kept plan). Kept plans deleted on the server
 * are forgotten.
 */
export async function updateKeptPlans() {
  const db = localDb();
  const kept = await db.kept_plans.toArray();
  const plans = await db.plans.bulkGet(kept.map((k) => k.plan_id));
  for (const [i, k] of kept.entries()) if (!plans[i]) await db.kept_plans.delete(k.plan_id);

  const needed = await sheetsNeededByKeptPlans(db);
  const index = await fileIndex(db);
  for (const [id, file] of index) {
    if (!file.pinned && !needed.has(id) && !items.has(id)) await deleteSheet(id);
  }

  const wanted = (await Promise.all(kept.map((k) => planSheets(db, k.plan_id)))).flat();
  const pinnedOutdated = (await db.arrangements.bulkGet([...index].filter(([, f]) => f.pinned).map(([id]) => id)))
    .filter((a) => a !== undefined)
    .map((a) => ({ arrangementId: a.id, version: fileVersion(a), bytes: a.file_size_bytes }));
  enqueue(missingSheets(wanted, index), false);
  enqueue(missingSheets(pinnedOutdated, index), true);
}

/** Every sheet in the library (active and archived), for "Download the whole library". */
export async function librarySheets(db: SetlistDB): Promise<SheetRef[]> {
  return (await db.arrangements.toArray()).map((a) => ({
    arrangementId: a.id,
    version: fileVersion(a),
    bytes: a.file_size_bytes,
  }));
}

export async function storageEstimate(): Promise<{ quota?: number; usage?: number } | null> {
  try {
    return (await navigator.storage?.estimate?.()) ?? null;
  } catch {
    return null;
  }
}

export async function isStoragePersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
