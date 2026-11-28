import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteMemberForm, MemberStatusForm } from "@/components/admin/forms";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { SettingsSection } from "@/components/layout/settings-section";
import { listAdministrators, listMemberDevices } from "@/features/members/queries";
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
  const [members, devices] = await Promise.all([listAdministrators(), listMemberDevices()]);

  return (
    <>
      <div className="grid gap-12 md:gap-16">
        <SettingsSection
          title="Invite an administrator"
          description="They'll get an email with a link to set their password. Administrators can upload and change music, delete plans and events, and manage settings."
        >
          <InviteMemberForm />
        </SettingsSection>

        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="mb-3 text-xl font-medium">
            All administrators ({members.length})
          </h2>
          <ul className="-mx-3 divide-y border-y">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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

        <section aria-labelledby="devices-heading">
          <h2 id="devices-heading" className="text-xl font-medium">
            Member devices ({devices.length})
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Devices that changed plans, most recent first. Block one if it&apos;s misusing Setlist; its changes stay
            in each plan&apos;s history, and archived plans can be restored.
          </p>
          {devices.length === 0 ? (
            <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              No member device has changed a plan yet.
            </p>
          ) : (
            <ul className="-mx-3 divide-y border-y">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.display_name ?? "Unnamed device"}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.change_count} {d.change_count === 1 ? "change" : "changes"}
                      {d.last_change_at
                        ? ` · last on ${new Date(d.last_change_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}`
                        : null}
                    </p>
                    {d.status === "inactive" ? (
                      <span className="mt-1 inline-block rounded-full border px-2 py-0.5 text-xs">Blocked</span>
                    ) : null}
                  </div>
                  <MemberStatusForm
                    device
                    userId={d.id}
                    name={d.display_name ?? "this device"}
                    nextStatus={d.status === "inactive" ? "active" : "inactive"}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
