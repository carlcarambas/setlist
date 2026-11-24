import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetlistDB } from "@/features/local-db/db";
import { getEvent, getPlan, listEvents, listPlans, searchLibrary } from "@/features/local-db/queries";
import { librarySearchSchema } from "@/features/library/schemas";
import { applyPull, CURSOR_OVERLAP_MS, sinceForPull, type PullDocument } from "./apply";
import { backoffMs } from "./engine";

let db: SetlistDB;
let n = 0;
beforeEach(() => {
  db = new SetlistDB(`test-${n++}`);
});
afterEach(async () => {
  await db.delete();
});

const T0 = "2026-11-24T10:00:00.000Z";
const piece = (id: string, title: string, extra = {}) => ({
  id, title, composer: null, description: null, category: null, tags: [], status: "active",
  created_at: T0, updated_at: T0, ...extra,
});
const arrangement = (id: string, pieceId: string, extra = {}) => ({
  id, music_piece_id: pieceId, title: "Key of G", musical_key: "G", bpm: null, instrument_notes: null,
  original_filename: "a.pdf", file_size_bytes: 100, status: "active", uploaded_by: "admin", created_at: T0,
  updated_at: T0, ...extra,
});
const plan = (id: string, title: string, extra = {}) => ({
  id, title, description: null, status: "draft", version: 1, owner_id: "dev", updated_by: "dev",
  created_at: T0, updated_at: T0, ...extra,
});
const item = (id: string, planId: string, arrId: string, position: number) => ({
  id, plan_id: planId, arrangement_id: arrId, position, notes: null, updated_at: T0,
});

function doc(parts: Partial<PullDocument>): PullDocument {
  return {
    server_time: "2026-11-24T12:00:00.000Z",
    music_pieces: [], arrangements: [], plans: [], plan_items: [], events: [], event_plans: [], profiles: [],
    deleted: [], app_settings: { church_name: "Grace", timezone: "Asia/Manila", updated_at: T0 },
    ...parts,
  };
}

describe("applyPull", () => {
  it("stores a first sync and sets the cursor slightly before the server time", async () => {
    await applyPull(db, doc({ music_pieces: [piece("p1", "Amazing Grace")], plans: [plan("pl1", "Sunday")] }), true);
    expect(await db.music_pieces.count()).toBe(1);
    expect(await db.plans.count()).toBe(1);
    const sync = await db.meta.get("sync");
    expect(sync?.cursor).toBe(
      new Date(Date.parse("2026-11-24T12:00:00.000Z") - CURSOR_OVERLAP_MS).toISOString(),
    );
  });

  it("applies a delta: upserts changes and removes tombstoned rows", async () => {
    await applyPull(db, doc({ plans: [plan("pl1", "Sunday"), plan("pl2", "Evening")] }), true);
    await applyPull(db, doc({ plans: [plan("pl1", "Sunday (edited)")], deleted: [{ table: "plans", id: "pl2" }] }), false);
    expect((await db.plans.get("pl1"))?.title).toBe("Sunday (edited)");
    expect(await db.plans.get("pl2")).toBeUndefined();
  });

  it("a full resync replaces everything, dropping rows whose tombstones expired", async () => {
    await applyPull(db, doc({ plans: [plan("old", "Gone long ago")] }), true);
    await applyPull(db, doc({ plans: [plan("pl1", "Sunday")] }), true);
    expect((await db.plans.toArray()).map((p) => p.id)).toEqual(["pl1"]);
  });

  it("re-applying the same delta changes nothing (overlapping cursors are safe)", async () => {
    const delta = doc({ plans: [plan("pl1", "Sunday")] });
    await applyPull(db, delta, false);
    await applyPull(db, delta, false);
    expect(await db.plans.count()).toBe(1);
  });
});

describe("sinceForPull", () => {
  it("asks for everything on first sync or after 89 days", () => {
    expect(sinceForPull(null)).toBeNull();
    const now = Date.parse("2026-11-24T00:00:00Z");
    expect(sinceForPull("2026-11-23T00:00:00.000Z", now)).toBe("2026-11-23T00:00:00.000Z");
    expect(sinceForPull("2026-08-01T00:00:00.000Z", now)).toBeNull();
  });
});

describe("backoffMs", () => {
  it("doubles from 30 seconds up to 10 minutes", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(10)).toBe(600_000);
  });
});

describe("local queries", () => {
  beforeEach(async () => {
    await applyPull(
      db,
      doc({
        music_pieces: [
          piece("p1", "Amazing Grace", { category: "Hymn", tags: ["easter"] }),
          piece("p2", "How Great Thou Art", { category: "Hymn" }),
          piece("p3", "Old Song", { status: "archived" }),
        ],
        arrangements: [arrangement("a1", "p1"), arrangement("a3", "p3")],
        plans: [plan("pl1", "Sunday", { updated_at: "2026-11-24T11:00:00.000Z" }), plan("pl2", "Archived", { status: "archived" })],
        plan_items: [item("i2", "pl1", "a3", 1), item("i1", "pl1", "a1", 0)],
        events: [
          { id: "e1", title: "Advent", description: null, event_date: "2026-11-29", start_time: "09:00:00", created_by: "dev", updated_at: T0 },
          { id: "e0", title: "Last week", description: null, event_date: "2026-11-15", start_time: null, created_by: "dev", updated_at: T0 },
        ],
        event_plans: [{ id: "ep1", event_id: "e1", plan_id: "pl1", position: 0, created_at: T0 }],
      }),
      true,
    );
  });

  it("searches the library by title, category and tag, hiding archived songs by default", async () => {
    const all = await searchLibrary(db, librarySearchSchema.parse({}));
    expect(all.pieces.map((p) => p.title)).toEqual(["Amazing Grace", "How Great Thou Art"]);
    expect((await searchLibrary(db, librarySearchSchema.parse({ q: "grace" }))).total).toBe(1);
    expect((await searchLibrary(db, librarySearchSchema.parse({ tag: "easter" }))).pieces[0].id).toBe("p1");
    expect((await searchLibrary(db, librarySearchSchema.parse({ archived: "1" }))).total).toBe(3);
  });

  it("returns a plan's songs in order and flags archived ones", async () => {
    const p = await getPlan(db, "pl1");
    expect(p?.items.map((i) => [i.songTitle, i.unavailable])).toEqual([
      ["Amazing Grace", false],
      ["Old Song", true],
    ]);
    expect(await getPlan(db, "missing")).toBeNull();
  });

  it("lists plans newest first, hiding archived unless asked", async () => {
    expect((await listPlans(db, false)).map((p) => [p.id, p.songCount])).toEqual([["pl1", 2]]);
    expect(await listPlans(db, true)).toHaveLength(2);
  });

  it("splits events into upcoming and past around the church's today", async () => {
    expect((await listEvents(db, "2026-11-24", false)).map((e) => e.id)).toEqual(["e1"]);
    expect((await listEvents(db, "2026-11-24", true)).map((e) => e.id)).toEqual(["e0"]);
    const e = await getEvent(db, "e1", "2026-11-24");
    expect(e?.plans.map((p) => [p.title, p.songCount])).toEqual([["Sunday", 2]]);
  });
});
