import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { SavedPlansList } from "@/components/offline/saved-plans-list";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker for pages that aren't saved on this device. Static: no data. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-8 bg-muted/40 px-4 py-10">
      <Brand />
      <main className="w-full max-w-md rounded-xl border bg-background p-6">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page isn&apos;t saved on this device. Plans you&apos;ve opened while connected are still available:
        </p>
        <SavedPlansList />
      </main>
    </div>
  );
}
