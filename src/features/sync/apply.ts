import { SYNCED_TABLES, type LocalSettings, type SetlistDB, type SyncedTable } from "@/features/local-db/db";

/** What `pull_changes` returns (see supabase/migrations/20261129000000_sync.sql). */
export type PullDocument = {
  server_time: string;
  deleted: { table: SyncedTable; id: string }[];
  app_settings: LocalSettings | null;
} & Record<SyncedTable, Record<string, unknown>[]>;

/** The next pull asks from slightly before this pull's server time, so rows written by transactions
 * that were still running aren't missed. Upserts make the overlap harmless. */
export const CURSOR_OVERLAP_MS = 2 * 60 * 1000;

/** Tombstones are kept 90 days on the server; a device whose cursor is older does a full resync. */
export const FULL_RESYNC_AFTER_MS = 89 * 24 * 60 * 60 * 1000;

/** The `since` to send: null (everything) on first sync or when tombstones may have expired. */
export function sinceForPull(cursor: string | null, now = Date.now()) {
  if (!cursor) return null;
  return now - new Date(cursor).getTime() > FULL_RESYNC_AFTER_MS ? null : cursor;
}

/**
 * Applies one pull in a single transaction. A full pull (since = null) replaces every table, so rows
 * deleted long ago disappear too; a delta upserts changes and removes tombstoned rows.
 */
export async function applyPull(db: SetlistDB, doc: PullDocument, full: boolean, syncedAt = new Date()) {
  const tables = [...SYNCED_TABLES.map((t) => db.table(t)), db.meta];
  await db.transaction("rw", tables, async () => {
    for (const name of SYNCED_TABLES) {
      const table = db.table(name);
      if (full) await table.clear();
      const rows = doc[name] ?? [];
      if (rows.length) await table.bulkPut(rows);
    }
    if (!full) {
      for (const { table, id } of doc.deleted ?? []) {
        if (SYNCED_TABLES.includes(table)) await db.table(table).delete(id);
      }
    }
    if (doc.app_settings) await db.meta.put({ key: "settings", value: doc.app_settings });
    const cursor = new Date(new Date(doc.server_time).getTime() - CURSOR_OVERLAP_MS).toISOString();
    await db.meta.put({ key: "sync", cursor, lastSyncedAt: syncedAt.toISOString() });
  });
}
