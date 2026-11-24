import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteMemberForm, MemberStatusForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdministrators } from "@/features/members/queries";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Administrators" };

const STATUS_LABEL = { active: "Active", invited: "Invited", inactive: "Deactivated" } as const;

export default function AdministratorsPage() {
  return (
    <>
      <PageHeader title="Administrators" description="People who manage the music library and settings. Members don't need accounts." />
      <Suspense fallback={<SectionSkeleton />}>
        <AdministratorsContent />
      </Suspense>
    </>
  );
}

async function AdministratorsContent() {
  const admin = await requireAdmin();
  const members = await listAdministrators();

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Invite an administrator</h2>
            </CardTitle>
            <CardDescription>They&apos;ll get an email with a link to set their password. Administrators can upload and change music, delete plans and events, and manage settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>

        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="mb-3 font-semibold">
            All administrators ({members.length})
          </h2>
          <ul className="divide-y rounded-lg border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.display_name ?? m.email}
                    {m.id === admin.id ? <span className="text-muted-foreground"> (you)</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border px-2 py-0.5">{STATUS_LABEL[m.status]}</span>
                  </p>
                </div>
                {m.id !== admin.id && m.status !== "invited" ? (
                  <MemberStatusForm
                    userId={m.id}
                    name={m.display_name ?? m.email}
                    nextStatus={m.status === "active" ? "inactive" : "active"}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
