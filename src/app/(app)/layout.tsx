import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { MemberMenu } from "@/components/layout/member-menu";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { requireActiveMember } from "@/lib/auth/member";

// Only active members get past these components; RLS enforces the same rule on the data.
async function ActiveMemberContent({ children }: { children: React.ReactNode }) {
  await requireActiveMember();
  return children;
}

async function MemberSidebar() {
  const member = await requireActiveMember();
  return (
    <>
      <SidebarNav isAdmin={member.role === "admin"} />
      <div className="mt-auto">
        <MemberMenu member={member} />
      </div>
    </>
  );
}

function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar pt-4 md:flex">
        <div className="px-6">
          <Brand />
        </div>
        <Suspense fallback={<SidebarNav isAdmin={false} />}>
          <MemberSidebar />
        </Suspense>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Brand />
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
          <Suspense fallback={<ContentSkeleton />}>
            <ActiveMemberContent>{children}</ActiveMemberContent>
          </Suspense>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
