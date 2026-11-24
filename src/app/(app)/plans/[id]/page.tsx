import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { z } from "zod";
import { PlanEvents } from "@/components/events/plan-events";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { ArchivePlanButton, DuplicatePlanButton } from "@/components/plans/plan-actions";
import { PlanSongs } from "@/components/plans/plan-songs";
import { PlanStatusBadge, relativeTime } from "@/components/plans/plan-status";
import { ShareButton } from "@/components/plans/share-dialog";
import { Button } from "@/components/ui/button";
import { getPlan, getPlanActivity } from "@/features/plans/queries";
import { getPlanSharing } from "@/features/sharing/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Plan" };

const ACTIVITY_LABEL: Record<string, string> = {
  plan_created: "created the plan",
  plan_updated: "edited the title or description",
  plan_status_changed: "changed the status",
  plan_duplicated: "created this plan as a copy",
  item_added: "added a song",
  item_removed: "removed a song",
  items_reordered: "reordered the songs",
  item_notes_updated: "edited song notes",
  share_granted: "shared the plan with a member",
  share_changed: "changed a member's permission",
  share_revoked: "removed a member's access",
  link_created: "created a view-only link",
  link_revoked: "revoked a view-only link",
};

export default function PlanPage({ params }: PageProps<"/plans/[id]">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Plan params={params} />
    </Suspense>
  );
}

async function Plan({ params }: Pick<PageProps<"/plans/[id]">, "params">) {
  const member = await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [plan, activity] = await Promise.all([getPlan(id.data), getPlanActivity(id.data)]);
  if (!plan) notFound();

  const isOwner = plan.owner_id === member.id;
  const archived = plan.status === "archived";
  const sharing = isOwner ? await getPlanSharing(plan.id) : null;

  return (
    <>
      <Link
        href={isOwner ? "/plans" : "/shared"}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {isOwner ? "My Plans" : "Shared with Me"}
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PlanStatusBadge status={plan.status} />
            <span>
              {plan.items.length} {plan.items.length === 1 ? "song" : "songs"} · updated {relativeTime(plan.updated_at)} by{" "}
              {plan.editor?.display_name ?? "a member"}
            </span>
          </p>
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">
              Shared by {plan.owner?.display_name ?? "a member"} · you can {plan.canEdit ? "edit" : "view"} this plan
            </p>
          ) : null}
          {plan.description ? <p className="max-w-prose pt-1 whitespace-pre-line">{plan.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.canEdit && !archived ? (
            <Button asChild className="h-11 gap-2">
              <Link href={`/plans/${plan.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            </Button>
          ) : null}
          {sharing ? <ShareButton planId={plan.id} planTitle={plan.title} sharing={sharing} /> : null}
          <DuplicatePlanButton planId={plan.id} />
          {isOwner ? <ArchivePlanButton planId={plan.id} archived={archived} /> : null}
        </div>
      </div>

      <PlanEvents planId={plan.id} editable={false} />

      {archived ? (
        <p role="status" className="mb-4 rounded-md border p-3 text-sm">
          <strong>Archived.</strong> This plan is read-only. Restore it to make changes.
        </p>
      ) : null}

      <PlanSongs planId={plan.id} planTitle={plan.title} items={plan.items} />

      {activity.length ? (
        <details className="mt-8">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Recent activity</summary>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {activity.map((a) => (
              <li key={a.id}>
                {a.user?.display_name ?? "A member"} {ACTIVITY_LABEL[a.action] ?? a.action} · {relativeTime(a.created_at)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
