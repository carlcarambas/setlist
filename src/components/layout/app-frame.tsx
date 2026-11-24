"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MemberMenu } from "@/components/layout/member-menu";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useSelf, useSessionEmail } from "@/features/local-db/hooks";
import { useSyncStatus } from "@/features/local-db/use-live-query";
import { useOnline } from "@/features/offline/use-online";
import { requestSync, startSync } from "@/features/sync/engine";

/**
 * The parts of the app frame that depend on who's using this device. Read from the local
 * database, so the page HTML is the same for everyone and the service worker can cache it
 * (spec v2 §7.4). The server and RLS still enforce every rule.
 */
export function SidebarMember() {
  const self = useSelf();
  const email = useSessionEmail();
  const isAdmin = self?.role === "admin" && !self.is_anonymous && self.status === "active";
  return (
    <>
      <SidebarNav isAdmin={isAdmin} />
      <div className="mt-auto">
        <MemberMenu
          name={self?.display_name ?? null}
          email={email}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}

/** Starts background sync and sends invited or blocked accounts where they belong. */
export function SessionWatcher() {
  const self = useSelf();
  const online = useOnline();
  const pathname = usePathname();
  const { noSession } = useSyncStatus();
  useEffect(() => {
    startSync();
  }, []);
  // The page came from the offline cache but there's no session: get one (the data stays).
  useEffect(() => {
    if (online && noSession) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/welcome?next=${encodeURIComponent(next)}`);
    }
  }, [online, noSession]);
  // Moving between pages (e.g. back from the online-only editor) picks up recent changes.
  useEffect(() => {
    void requestSync();
  }, [pathname]);
  useEffect(() => {
    if (!online || !self) return;
    if (self.status === "invited") window.location.replace("/accept-invitation");
    else if (self.status === "inactive") window.location.replace("/auth/sign-out?reason=inactive");
  }, [online, self]);
  return null;
}
