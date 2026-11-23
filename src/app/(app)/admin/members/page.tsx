import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteMemberForm, MemberStatusForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMembers } from "@/features/members/queries";
import { requireAdmin } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Members" };

const STATUS_LABEL = { active: "Active", invited: "Invited", inactive: "Deactivated" } as const;

export default function MembersPage() {
  return (
    <>
      <PageHeader title="Members" description="Invite people to the ministry and manage access." />
      <Suspense fallback={<SectionSkeleton />}>
        <MembersContent />
      </Suspense>
    </>
  );
}

async function MembersContent() {
  const admin = await requireAdmin();
  const members = await listMembers();

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Invite a member</h2>
            </CardTitle>
            <CardDescription>They&apos;ll get an email with a link to set their password.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>

        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="mb-3 font-semibold">
            All members ({members.length})
          </h2>
          <ul className="divide-y rounded-lg border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.display_name}
                    {m.id === admin.id ? <span className="text-muted-foreground"> (you)</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border px-2 py-0.5">{STATUS_LABEL[m.status]}</span>
                    {m.role === "admin" ? (
                      <span className="rounded-full border px-2 py-0.5">Administrator</span>
                    ) : null}
                  </p>
                </div>
                {m.id !== admin.id && m.status !== "invited" ? (
                  <MemberStatusForm
                    userId={m.id}
                    name={m.display_name}
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
