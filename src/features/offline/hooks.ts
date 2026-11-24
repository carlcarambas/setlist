"use client";

import { useSyncExternalStore } from "react";
import { localDb } from "@/features/local-db/db";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import { fileIndex, getDownloads, subscribeDownloads } from "./downloads";

export function useDownloads() {
  return useSyncExternalStore(subscribeDownloads, getDownloads, getDownloads);
}

/** Saved sheets on this device, by arrangement id (live). */
export function useFileIndex() {
  return useLiveQuery(() => fileIndex(localDb()), []);
}

/** Ids of plans this device keeps offline (live). */
export function useKeptPlans() {
  return useLiveQuery(async () => new Set((await localDb().kept_plans.toArray()).map((k) => k.plan_id)), []);
}
