"use client";

import { localDb } from "@/features/local-db/db";
import { createClient } from "@/lib/supabase/client";
import { applyPull, sinceForPull, type PullDocument } from "./apply";

/**
 * Keeps the device's database in step with the server (spec v2 §4.5 OFF-03/OFF-07). Pulls run on app
 * start, when the browser comes online, when the app becomes visible, after online edits
 * (requestSync), and every 5 minutes; failures retry with backoff. Never runs while offline.
 */

export type SyncStatus = {
  state: "idle" | "syncing" | "error" | "offline";
  lastSyncedAt: string | null;
  /** True until the first sync on this device has finished (nothing to show yet). */
  empty: boolean;
  /** True once a sync attempt on this page load has finished (successfully or not). */
  settled: boolean;
  /** Online but without a session (e.g. it expired or was signed out elsewhere). */
  noSession: boolean;
};

const INTERVAL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 10 * 1000;

let status: SyncStatus = { state: "idle", lastSyncedAt: null, empty: true, settled: false, noSession: false };
const listeners = new Set<() => void>();
let running: Promise<void> | null = null;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastAttempt = 0;
let started = false;

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function subscribeSync(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus() {
  return status;
}

/** Delay before retry number `failures` (1 → 30 s, doubling, at most 10 min). */
export function backoffMs(failures: number) {
  return Math.min(30_000 * 2 ** Math.max(0, failures - 1), 10 * 60 * 1000);
}

async function pull() {
  const db = localDb();
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) {
    setStatus({ noSession: true });
    return;
  }

  const sync = await db.meta.get("sync");
  const since = sinceForPull(sync?.cursor ?? null);
  const { data, error } = await supabase.rpc("pull_changes", { p_since: since ?? undefined });
  if (error || !data) throw new Error(error?.message ?? "No data");
  await applyPull(db, data as unknown as PullDocument, since === null);
  await db.meta.put({ key: "self", userId });
}

/** Runs a pull now (coalesced with one already running). Resolves when it has finished. */
export function requestSync(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus({ state: "offline", settled: true });
    return Promise.resolve();
  }
  if (running) return running;
  lastAttempt = Date.now();
  setStatus({ state: "syncing" });
  running = pull()
    .then(async () => {
      failures = 0;
      const sync = await localDb().meta.get("sync");
      setStatus({
        state: "idle",
        empty: false,
        settled: true,
        lastSyncedAt: sync?.lastSyncedAt ?? null,
      });
    })
    .catch(() => {
      failures += 1;
      setStatus({ state: navigator.onLine ? "error" : "offline", settled: true });
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void requestSync(), backoffMs(failures));
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** A sync unless one ran in the last few seconds (navigation, returning to the app, timer). */
function syncIfStale() {
  if (Date.now() - lastAttempt >= MIN_GAP_MS) void requestSync();
}

/** Starts the triggers once per page load. Safe to call from every page. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  void localDb()
    .meta.get("sync")
    .then((sync) => {
      if (sync?.lastSyncedAt) {
        setStatus({ lastSyncedAt: sync.lastSyncedAt, empty: false });
      }
    })
    .catch(() => undefined);

  window.addEventListener("online", () => void requestSync());
  window.addEventListener("offline", () => setStatus({ state: "offline" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncIfStale();
  });
  setInterval(() => syncIfStale(), INTERVAL_MS);
  void requestSync();
}
