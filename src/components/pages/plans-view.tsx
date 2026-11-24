"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListMusic } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { OfflineBadge } from "@/components/offline/offline-badge";
import { NewPlanForm } from "@/components/plans/new-plan-form";
import { PlanStatusBadge, relativeTime } from "@/components/plans/plan-status";
import { Card, CardContent } from "@/components/ui/card";
import { localDb } from "@/features/local-db/db";
import { listPlans } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";

export function PlansView() {
  const includeArchived = useSearchParams().get("archived") === "1";
  const plans = useLiveQuery(() => listPlans(localDb(), includeArchived), [includeArchived]);

  return (
    <>
      <PageHeader title="Plans" description="Every setlist in the ministry. Anyone can edit them." />
      <Card className="mb-6">
        <CardContent>
          <OnlineOnly label="Creating a plan needs a connection">
            <NewPlanForm />
          </OnlineOnly>
        </CardContent>
      </Card>
      <section aria-labelledby="plans-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="plans-heading" className="font-semibold">
            {includeArchived ? "All plans" : "Current plans"}
            {plans ? ` (${plans.length})` : null}
          </h2>
          <Link
            href={includeArchived ? "/plans" : "/plans?archived=1"}
            className="min-h-11 content-center text-sm underline underline-offset-4"
          >
            {includeArchived ? "Hide archived" : "Show archived"}
          </Link>
        </div>
        {plans === undefined ? (
          <LocalSkeleton />
        ) : plans.length === 0 ? (
          <EmptyState icon={ListMusic} title="No plans yet">
            Create a plan above, then add songs from the library.
          </EmptyState>
        ) : (
          <ul className="divide-y rounded-lg border">
            {plans.map((p) => (
              <li key={p.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent/50">
                <div className="min-w-0">
                  <Link href={`/plan?id=${p.id}`} className="font-medium after:absolute after:inset-0">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {p.songCount} {p.songCount === 1 ? "song" : "songs"} · updated {relativeTime(p.updated_at)}
                    {p.editorName ? ` by ${p.editorName}` : null}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <OfflineBadge status={p.offline} />
                  <PlanStatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
