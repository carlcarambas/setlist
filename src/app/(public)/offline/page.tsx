import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Brand } from "@/components/layout/brand";

export const metadata: Metadata = { title: "Needs a connection" };

/**
 * Shown by the service worker for online-only pages (editing, administration) while offline.
 * Static: no data. Everything a member reads works offline from the links below.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-8 bg-muted/40 px-4 py-10">
      <Brand />
      <main className="w-full max-w-md rounded-xl border bg-background p-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <WifiOff className="size-5" aria-hidden />
          This page needs a connection
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Editing and administration need the internet. Everything already on this device still opens:
        </p>
        <ul className="mt-4 grid gap-2">
          {[
            ["/dashboard", "Home"],
            ["/plans", "Plans"],
            ["/library", "Music Library"],
            ["/events", "Events"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="flex min-h-11 items-center rounded-md border px-4 hover:bg-accent">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
