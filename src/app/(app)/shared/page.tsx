import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PlanStatusBadge, relativeTime } from "@/components/plans/plan-status";
import { listSharedWithMe } from "@/features/sharing/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Shared with Me" };

export default function SharedPage() {
  return (
    <>
      <PageHeader title="Shared with Me" description="Plans other members have shared with you." />
      <Suspense fallback={<SectionSkeleton />}>
        <SharedList />
      </Suspense>
    </>
  );
}

async function SharedList() {
  const member = await requireActiveMember();
  const plans = await listSharedWithMe(member.id);

  if (plans.length === 0) {
    return (
      <EmptyState icon={Users} title="Nothing shared with you yet">
        When another member shares a plan with you, it appears here.
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="shared-heading">
      <h2 id="shared-heading" className="mb-3 font-semibold">
        Shared plans ({plans.length})
      </h2>
      <ul className="divide-y rounded-lg border">
        {plans.map((p) => (
          <li key={p.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent/50">
            <div className="min-w-0">
              <Link href={`/plans/${p.id}`} className="font-medium after:absolute after:inset-0">
                {p.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                From {p.ownerName} · {p.songCount} {p.songCount === 1 ? "song" : "songs"} · updated {relativeTime(p.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{p.permission === "editor" ? "Can edit" : "Can view"}</span>
              <PlanStatusBadge status={p.status} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
