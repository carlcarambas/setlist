"use client";

import { useSyncExternalStore } from "react";
import { listSavedPlans, type SavedPlan } from "@/features/offline/sheets";

const EMPTY: SavedPlan[] = [];
let snapshot: SavedPlan[] | null = null;
const read = () => (snapshot ??= listSavedPlans());

export function SavedPlansList() {
  const plans = useSyncExternalStore(
    () => () => {},
    read,
    () => EMPTY,
  );

  if (plans.length === 0) {
    return <p className="mt-4 rounded-md border border-dashed p-4 text-center text-sm">No plans are saved on this device yet.</p>;
  }
  return (
    <ul className="mt-4 divide-y rounded-md border">
      {plans.map((p) => (
        <li key={p.id}>
          {/* A full page load, so the service worker can serve the saved copy. */}
          <a href={`/plans/${p.id}`} className="flex min-h-14 flex-col justify-center px-4 py-2 hover:bg-accent">
            <span className="font-medium">{p.title}</span>
            <span className="text-xs text-muted-foreground">
              {p.songs} {p.songs === 1 ? "song" : "songs"} · saved {new Date(p.savedAt).toLocaleDateString("en", { dateStyle: "medium" })}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
