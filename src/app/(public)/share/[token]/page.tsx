import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PlanSongs } from "@/components/plans/plan-songs";
import { getSharedPlan } from "@/features/sharing/queries";

// Links are private by nature: keep them out of search engines (headers in next.config.ts too).
export const metadata: Metadata = { title: "Shared plan", robots: { index: false, follow: false } };

/**
 * A plan opened through a view-only link (spec §5.4). No sign-in. The token is checked
 * on the server on every request; the page shows only this plan and its sheets.
 */
export default function SharedPlanPage({ params }: PageProps<"/share/[token]">) {
  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="border-b bg-background px-4 py-3 sm:px-6">
        <Brand />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Suspense fallback={<SectionSkeleton />}>
          <SharedPlan params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function SharedPlan({ params }: Pick<PageProps<"/share/[token]">, "params">) {
  const { token } = await params;
  const plan = await getSharedPlan(token);

  if (!plan) {
    return (
      <div className="rounded-xl border bg-background p-6">
        <h1 className="text-xl font-semibold">This link isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired or been turned off by the person who shared it. Ask them for a new link.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 space-y-1">
        <p className="text-sm text-muted-foreground">Shared plan · view only</p>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.items.length} {plan.items.length === 1 ? "song" : "songs"}
        </p>
        {plan.description ? <p className="max-w-prose pt-1 whitespace-pre-line">{plan.description}</p> : null}
      </div>
      <PlanSongs planId="" planTitle={plan.title} items={plan.items} sheetBasePath={`/share/${token}/sheets`} />
    </>
  );
}
