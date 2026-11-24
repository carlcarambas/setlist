import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ProfileForm } from "@/components/admin/forms";
import { adminNav } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/page-header";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your profile and account." />
      <Suspense fallback={<SectionSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const member = await requireActiveMember();

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Profile</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              {member.email}
            </p>
            <ProfileForm displayName={member.display_name} />
          </CardContent>
        </Card>

        {member.role === "admin" ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Administration</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1">
                {adminNav.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-accent"
                    >
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="md:hidden">
          <SignOutButton variant="outline" className="w-full justify-center" />
        </div>
      </div>
    </>
  );
}
