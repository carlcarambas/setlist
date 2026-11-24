import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { ProfileForm } from "@/components/admin/forms";
import { adminNav } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdmin, requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="This device and administration." />
      <Suspense fallback={<SectionSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const member = await requireActiveMember();
  const admin = isAdmin(member);

  return (
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
          {admin ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              {member.email}
            </p>
          ) : null}
          <ProfileForm displayName={member.display_name ?? ""} optional={!admin} />
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
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/sign-in">
                <LogIn className="size-4" aria-hidden />
                Administrator sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
