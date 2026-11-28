import type { Viewport } from "next";
import { Suspense } from "react";
import { SessionWatcher, SidebarMember } from "@/components/layout/app-frame";
import { Brand } from "@/components/layout/brand";
import { MobileTabBar, MobileTabBarLinks } from "@/components/layout/mobile-tab-bar";
import { SidebarNavLinks } from "@/components/layout/sidebar-nav";
import { SyncStatusBar } from "@/components/layout/sync-status";

// The browser bar matches the dark header and navigation.
export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/**
 * Static app frame: nothing here reads the session on the server, so member pages are prerendered,
 * identical for everyone, and cached by the service worker for offline use (spec v2 §4.5, §7.4).
 * Who-is-this-device details come from the local database. The proxy sends visitors without a
 * session to /welcome, server-rendered admin pages check the role themselves, and RLS guards data.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:border focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-surface-dark pt-4 text-white scheme-dark md:flex">
        <div className="px-6">
          <Brand />
        </div>
        <Suspense fallback={<SidebarNavLinks isAdmin={false} />}>
          <SidebarMember />
        </Suspense>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-dark px-4 pt-[env(safe-area-inset-top)] text-white md:hidden">
          <div className="flex min-h-14 items-center">
            <Brand />
          </div>
        </header>

        <SyncStatusBar />
        <main id="main" className="mx-auto w-full max-w-[49rem] flex-1 px-4 pt-6 pb-24 has-[[data-wide]]:max-w-5xl md:px-8 md:pt-12 md:pb-16">
          <Suspense fallback={<ContentSkeleton />}>{children}</Suspense>
        </main>
      </div>

      <Suspense fallback={<MobileTabBarLinks />}>
        <MobileTabBar />
      </Suspense>
      <Suspense>
        <SessionWatcher />
      </Suspense>
    </div>
  );
}
