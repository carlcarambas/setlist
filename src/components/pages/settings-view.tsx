"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { ProfileForm } from "@/components/admin/forms";
import { adminNav } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { relativeTime } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSelf, useSessionEmail } from "@/features/local-db/hooks";
import { useSyncStatus } from "@/features/local-db/use-live-query";

export function SettingsView() {
  const self = useSelf();
  const email = useSessionEmail();
  const sync = useSyncStatus();
  const admin = self?.role === "admin" && !self.is_anonymous && self.status === "active";

  return (
    <>
      <PageHeader title="Settings" description="This device and administration." />
      {self === undefined ? (
        <LocalSkeleton />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{admin ? "Your profile" : "This device"}</h2>
              </CardTitle>
              {admin ? null : (
                <CardDescription>
                  Optional. The name appears next to plan changes made on this device, e.g. &quot;Choir iPad&quot;.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              {admin && email ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Email: </span>
                  {email}
                </p>
              ) : null}
              <OnlineOnly label="Changing the name needs a connection">
                <ProfileForm displayName={self?.display_name ?? ""} optional={!admin} />
              </OnlineOnly>
              <p className="text-sm text-muted-foreground">
                {sync.lastSyncedAt ? `Last synced ${relativeTime(sync.lastSyncedAt)}.` : "Not synced yet."} Plans, songs
                and events on this device stay available offline.
              </p>
            </CardContent>
          </Card>

          {admin ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Administration</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <ul className="grid gap-1">
                  {adminNav.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link href={href} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-accent">
                        <Icon className="size-4" aria-hidden />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <SignOutButton variant="outline" className="w-full justify-center sm:w-auto" />
                <p className="text-sm text-muted-foreground">After signing out, this device keeps working as a member.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Administrators</h2>
                </CardTitle>
                <CardDescription>
                  Administrators upload and change music and manage settings. Members don&apos;t need to sign in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OnlineOnly label="Signing in needs a connection">
                  <Button asChild variant="outline" className="h-11 gap-2">
                    <Link href="/sign-in">
                      <LogIn className="size-4" aria-hidden />
                      Administrator sign in
                    </Link>
                  </Button>
                </OnlineOnly>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
