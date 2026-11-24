import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ListMusic } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { NewPlanForm } from "@/components/plans/new-plan-form";
import { PlanStatusBadge, relativeTime } from "@/components/plans/plan-status";
import { Card, CardContent } from "@/components/ui/card";
import { listPlans } from "@/features/plans/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage({ searchParams }: PageProps<"/plans">) {
  return (
    <>
      <PageHeader title="Plans" description="Every setlist in the ministry. Anyone can edit them." />
      <Card className="mb-6">
        <CardContent>
          <NewPlanForm />
        </CardContent>
      </Card>
      <Suspense fallback={<SectionSkeleton />}>
        <PlanList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PlanList({ searchParams }: Pick<PageProps<"/plans">, "searchParams">) {
  await requireActiveMember();
  const includeArchived = (await searchParams).archived === "1";
  const plans = await listPlans(includeArchived);

  return (
    <section aria-labelledby="plans-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="plans-heading" className="font-semibold">
          {includeArchived ? "All plans" : "Current plans"} ({plans.length})
        </h2>
        <Link
          href={includeArchived ? "/plans" : "/plans?archived=1"}
          className="min-h-11 content-center text-sm underline underline-offset-4"
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>
      {plans.length === 0 ? (
        <EmptyState icon={ListMusic} title="No plans yet">
          Create a plan above, then add songs from the library.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border">
          {plans.map((p) => (
            <li key={p.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent/50">
              <div className="min-w-0">
                <Link href={`/plans/${p.id}`} className="font-medium after:absolute after:inset-0">
                  {p.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {p.songCount} {p.songCount === 1 ? "song" : "songs"} · updated {relativeTime(p.updated_at)}
                  {p.editor?.display_name ? ` by ${p.editor.display_name}` : null}
                </p>
              </div>
              <PlanStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
