"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { getSyncStatus, subscribeSync } from "@/features/sync/engine";

/**
 * Runs a query against the device's database and re-renders whenever its data changes (e.g. after
 * a sync). `undefined` means "still loading"; queries return `null` for "not found".
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | undefined>(undefined);
  const key = JSON.stringify(deps);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setState({ key, value }),
      error: () => undefined,
    });
    return () => subscription.unsubscribe();
    // The caller's deps decide when the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Never show the previous query's result for new deps.
  return state?.key === key ? state.value : undefined;
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
}
