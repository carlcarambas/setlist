import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "@/features/local-db/db";
import { getDownloads, keepPlan, unkeepPlan, unpinSheet, updateKeptPlans } from "./downloads";

// In Node there's no Cache Storage and no connection, so the queue only records what it would
// download; these tests cover the bookkeeping: what's queued, kept and removed.

const T = "2026-11-24T10:00:00.000Z";
const arrangement = (id: string, bytes = 1000, updated_at = T) => ({
  id, music_piece_id: "p", title: id, musical_key: null, bpm: null, instrument_notes: null,
  original_filename: `${id}.pdf`, file_size_bytes: bytes, status: "active" as const, uploaded_by: "u",
  created_at: T, updated_at,
});
const plan = (id: string) => ({
  id, title: id, description: null, status: "draft" as const, version: 1, owner_id: "u", updated_by: "u",
  created_at: T, updated_at: T,
});
const item = (id: string, planId: string, arr: string, position: number) => ({
  id, plan_id: planId, arrangement_id: arr, position, notes: null, updated_at: T,
});
const saved = (id: string, pinned = false, version = String(Date.parse(T))) => ({
  arrangement_id: id, version, bytes: 1000, saved_at: T, pinned,
});

beforeEach(async () => {
  const db = localDb();
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.arrangements.bulkPut([arrangement("a"), arrangement("b"), arrangement("c")]);
  await db.plans.bulkPut([plan("sunday"), plan("evening")]);
  await db.plan_items.bulkPut([item("1", "sunday", "a", 0), item("2", "sunday", "b", 1), item("3", "evening", "b", 0)]);
});

describe("keeping plans offline", () => {
  it("queues only the sheets not saved yet", async () => {
    await localDb().sheet_files.put(saved("a"));
    await keepPlan("sunday");
    expect(await localDb().kept_plans.get("sunday")).toBeTruthy();
    expect([...getDownloads().items.keys()]).toContain("b");
    expect(getDownloads().items.has("a")).toBe(false);
  });

  it("removing a plan keeps sheets another kept plan or the member still wants", async () => {
    const db = localDb();
    await db.sheet_files.bulkPut([saved("a"), saved("b")]);
    await db.kept_plans.bulkPut([{ plan_id: "sunday", kept_at: T }, { plan_id: "evening", kept_at: T }]);
    await unkeepPlan("sunday");
    expect((await db.sheet_files.toArray()).map((f) => f.arrangement_id)).toEqual(["b"]);
  });

  it("after a sync, drops sheets no kept plan needs and queues replaced ones", async () => {
    const db = localDb();
    await db.kept_plans.put({ plan_id: "evening", kept_at: T });
    await db.sheet_files.bulkPut([saved("a"), saved("b", false, "old"), saved("c", true)]);
    await updateKeptPlans();
    expect((await db.sheet_files.toArray()).map((f) => f.arrangement_id).sort()).toEqual(["b", "c"]);
    expect(getDownloads().items.get("b")?.version).toBe(String(Date.parse(T)));
  });

  it("forgets kept plans deleted on the server", async () => {
    const db = localDb();
    await db.kept_plans.put({ plan_id: "gone", kept_at: T });
    await updateKeptPlans();
    expect(await db.kept_plans.get("gone")).toBeUndefined();
  });

  it("unpinning a sheet a kept plan needs only removes the pin", async () => {
    const db = localDb();
    await db.kept_plans.put({ plan_id: "sunday", kept_at: T });
    await db.sheet_files.bulkPut([saved("a", true), saved("c", true)]);
    await unpinSheet("a");
    await unpinSheet("c");
    expect(await db.sheet_files.get("a")).toMatchObject({ pinned: false });
    expect(await db.sheet_files.get("c")).toBeUndefined();
  });
});
