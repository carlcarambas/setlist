"use client";

import Link from "next/link";
import { ChevronRight, LogIn } from "lucide-react";
import { ProfileForm } from "@/components/admin/forms";
import { adminNav } from "@/components/layout/nav-items";
import { SettingsRow, SettingsSection } from "@/components/layout/settings-section";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { InstallHint } from "@/components/offline/install-hint";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { StoragePanel } from "@/components/offline/storage-panel";
import { relativeTime } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { useSelf, useSessionEmail } from "@/features/local-db/hooks";
import { useSyncStatus } from "@/features/local-db/use-live-query";

export function SettingsView() {
  const self = useSelf();
  const email = useSessionEmail();
  const sync = useSyncStatus();
  const admin = self?.role === "admin" && !self.is_anonymous && self.status === "active";

  return (
    <>
      <h1 className="mb-8 text-[1.75rem] leading-tight font-medium md:mb-12 md:text-3xl">Settings</h1>
      {self === undefined ? (
        <LocalSkeleton />
      ) : (
        <>
          <InstallHint />
          <div className="grid gap-12 md:gap-16 lg:gap-[5.5rem]">
            <SettingsSection
              title={admin ? "Your profile" : "This device"}
              description={
                admin
                  ? undefined
                  : "A name is optional. It appears next to plan changes made on this device, for example \"Choir iPad\"."
              }
            >
              {admin && email ? (
                <dl className="border-t">
                  <SettingsRow label="Email">{email}</SettingsRow>
                </dl>
              ) : null}
              <div>
                <OnlineOnly label="Changing the name needs a connection">
                  <ProfileForm displayName={self?.display_name ?? ""} optional={!admin} />
                </OnlineOnly>
              </div>
              <p className="text-sm text-muted-foreground">
                {sync.lastSyncedAt ? `Last synced ${relativeTime(sync.lastSyncedAt)}.` : "Not synced yet."} Plans, songs
                and events on this device stay available offline.
              </p>
            </SettingsSection>

            <StoragePanel />

            {admin ? (
              <SettingsSection title="Administration">
                <ul className="border-t">
                  {adminNav.map(({ href, label, icon: Icon }) => (
                    <li key={href} className="border-b">
                      <Link href={href} className="flex min-h-14 items-center gap-3 hover:bg-surface-soft">
                        <Icon className="size-5" aria-hidden />
                        <span className="flex-1">{label}</span>
                        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col items-start gap-3">
                  <SignOutButton variant="outline" className="w-full sm:w-auto" />
                  <p className="text-sm text-muted-foreground">After signing out, this device keeps working as a member.</p>
                </div>
              </SettingsSection>
            ) : (
              <SettingsSection
                title="Administrators"
                description="Administrators upload and change music and manage settings. Members don't need to sign in."
              >
                <div>
                  <OnlineOnly label="Signing in needs a connection">
                    <Button asChild variant="outline" className="h-11 w-full gap-2 px-5 sm:w-auto">
                      <Link href="/sign-in">
                        <LogIn className="size-4" aria-hidden />
                        Administrator sign in
                      </Link>
                    </Button>
                  </OnlineOnly>
                </div>
              </SettingsSection>
            )}
          </div>
        </>
      )}
    </>
  );
}
