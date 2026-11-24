import Dexie, { type EntityTable } from "dexie";

/**
 * The device's copy of everything a member can read (spec v2 §4.5 OFF-03). Filled by pull sync
 * (features/sync); member pages read only from here, so they work offline. Table names match the
 * server tables so a pull applies generically. No PDFs here: sheets live in Cache Storage.
 */

export type LocalPiece = {
  id: string;
  title: string;
  composer: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type LocalArrangement = {
  id: string;
  music_piece_id: string;
  title: string;
  musical_key: string | null;
  bpm: number | null;
  instrument_notes: string | null;
  original_filename: string;
  file_size_bytes: number;
  status: "active" | "archived";
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type LocalPlan = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  owner_id: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type LocalPlanItem = {
  id: string;
  plan_id: string;
  arrangement_id: string;
  position: number;
  notes: string | null;
  updated_at: string;
};

export type LocalEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  created_by: string;
  updated_at: string;
};

export type LocalEventPlan = { id: string; event_id: string; plan_id: string; position: number; created_at: string };

export type LocalProfile = {
  id: string;
  display_name: string | null;
  role: "member" | "admin";
  status: "invited" | "active" | "inactive";
  is_anonymous: boolean;
  updated_at: string;
};

export type LocalSettings = { church_name: string; timezone: string; updated_at: string };

/** Key-value rows: "sync" (cursor, lastSyncedAt), "settings" (value), "self" (userId). */
export type MetaRow = {
  key: "sync" | "settings" | "self";
  cursor?: string | null;
  lastSyncedAt?: string | null;
  value?: LocalSettings;
  userId?: string;
};

export type SyncedTable =
  | "music_pieces"
  | "arrangements"
  | "plans"
  | "plan_items"
  | "events"
  | "event_plans"
  | "profiles";

export const SYNCED_TABLES: SyncedTable[] = [
  "music_pieces",
  "arrangements",
  "plans",
  "plan_items",
  "events",
  "event_plans",
  "profiles",
];

export class SetlistDB extends Dexie {
  music_pieces!: EntityTable<LocalPiece, "id">;
  arrangements!: EntityTable<LocalArrangement, "id">;
  plans!: EntityTable<LocalPlan, "id">;
  plan_items!: EntityTable<LocalPlanItem, "id">;
  events!: EntityTable<LocalEvent, "id">;
  event_plans!: EntityTable<LocalEventPlan, "id">;
  profiles!: EntityTable<LocalProfile, "id">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = "setlist") {
    super(name);
    this.version(1).stores({
      music_pieces: "id, title, status, category, *tags, created_at",
      arrangements: "id, music_piece_id",
      plans: "id, status, updated_at",
      plan_items: "id, plan_id",
      events: "id, event_date",
      event_plans: "id, event_id, plan_id",
      profiles: "id",
      meta: "key",
    });
  }
}

let instance: SetlistDB | null = null;

/** The browser's database (created on first use). */
export function localDb() {
  instance ??= new SetlistDB();
  return instance;
}
