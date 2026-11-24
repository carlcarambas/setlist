import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PlanEditor } from "@/components/plans/plan-editor";
import { getPlan } from "@/features/plans/queries";
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
  await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const plan = await getPlan(id.data);
  if (!plan) notFound();
  if (!plan.canEdit || plan.status === "archived") redirect(`/plans/${plan.id}`);

  return (
    <>
      <Link
        href={`/plans/${plan.id}`}
        className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to plan
      </Link>
      <h1 className="sr-only">Edit plan: {plan.title}</h1>
      <PlanEditor
        key={plan.version}
        plan={{ id: plan.id, title: plan.title, description: plan.description, version: plan.version, status: plan.status }}
        initialItems={plan.items}
      />
    </>
  );
}
