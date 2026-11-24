import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PlanEvents } from "@/components/events/plan-events";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PlanEditor } from "@/components/plans/plan-editor";
import { ShareButton } from "@/components/plans/share-dialog";
import { getPlan } from "@/features/plans/queries";
import { getPlanSharing } from "@/features/sharing/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Edit plan" };

export default function EditPlanPage({ params }: PageProps<"/plans/[id]/edit">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/plans/[id]/edit">, "params">) {
  const member = await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const plan = await getPlan(id.data);
  if (!plan) notFound();
  if (!plan.canEdit || plan.status === "archived") redirect(`/plans/${plan.id}`);
  const sharing = plan.owner_id === member.id ? await getPlanSharing(plan.id) : null;

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/plans/${plan.id}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to plan
        </Link>
        {sharing ? <ShareButton planId={plan.id} planTitle={plan.title} sharing={sharing} /> : null}
      </div>
      <h1 className="sr-only">Edit plan: {plan.title}</h1>
      <PlanEvents planId={plan.id} editable />
      <PlanEditor
        key={plan.version}
        plan={{ id: plan.id, title: plan.title, description: plan.description, version: plan.version, status: plan.status }}
        initialItems={plan.items}
      />
    </>
  );
}
