import type { LocalSheetFile } from "@/features/local-db/db";

/**
 * Pure rules for offline sheets (spec v2 §4.5): whether a plan is available offline, what a
 * download would cost, what can be removed, and whether it fits. No I/O, so they're unit-tested.
 */

export type SheetRef = { arrangementId: string; version: string; bytes: number };
export type FileIndex = Map<string, Pick<LocalSheetFile, "version" | "pinned" | "bytes">>;

/** complete: every sheet saved at its current version. outdated: all saved, some at an older version
 * (they still open). partial: some saved. none: nothing saved (or nothing to save). */
export type OfflineStatus = "complete" | "outdated" | "partial" | "none";

export function offlineStatus(sheets: SheetRef[], files: FileIndex): OfflineStatus {
  const unique = uniqueSheets(sheets);
  if (!unique.length) return "none";
  const saved = unique.filter((s) => files.has(s.arrangementId));
  if (!saved.length) return "none";
  if (saved.length < unique.length) return "partial";
  return saved.every((s) => files.get(s.arrangementId)?.version === s.version) ? "complete" : "outdated";
}

/** Sheets not yet saved at their current version. */
export function missingSheets(sheets: SheetRef[], files: FileIndex): SheetRef[] {
  return uniqueSheets(sheets).filter((s) => files.get(s.arrangementId)?.version !== s.version);
}

export function totalBytes(sheets: SheetRef[]) {
  return sheets.reduce((sum, s) => sum + s.bytes, 0);
}

/**
 * Sheets that can be deleted when a plan stops being kept: not pinned (saved on their own) and not
 * needed by another kept plan.
 */
export function removableSheets(planArrangementIds: string[], neededElsewhere: Set<string>, files: FileIndex) {
  return [...new Set(planArrangementIds)].filter(
    (id) => files.has(id) && !files.get(id)?.pinned && !neededElsewhere.has(id),
  );
}

/** Whether `bytes` fits in the free space the browser reports. Unknown estimates don't block. */
export function fitsInStorage(bytes: number, estimate: { quota?: number; usage?: number } | null) {
  if (!estimate?.quota) return true;
  const free = estimate.quota - (estimate.usage ?? 0);
  // Keep a margin: estimates are rough, and the app itself needs room.
  return bytes <= free * 0.9;
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function uniqueSheets(sheets: SheetRef[]) {
  return [...new Map(sheets.filter((s) => s.arrangementId).map((s) => [s.arrangementId, s])).values()];
}
