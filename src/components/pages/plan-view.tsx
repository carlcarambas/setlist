"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil } from "lucide-react";
import { LocalSkeleton, NotOnDevice, OnlineOnly } from "@/components/local/states";
import { KeepOffline } from "@/components/offline/keep-offline";
import { PlanMenu } from "@/components/plans/plan-actions";
import { PlanSongs } from "@/components/plans/plan-songs";
import { SharePlanButton } from "@/components/plans/share-plan-button";
import { PlanStatusBadge, relativeTime } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/features/events/schemas";
import { localDb } from "@/features/local-db/db";
import { useIsAdmin } from "@/features/local-db/hooks";
import { getPlan, listPlanEvents } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import { useOnline } from "@/features/offline/use-online";
import { fetchPlanActivity } from "@/features/plans/actions";

const ACTIVITY_LABEL: Record<string, string> = {
  plan_created: "created the plan",
  plan_updated: "edited the title or description",
  plan_status_changed: "changed the status",
  plan_duplicated: "created this plan as a copy",
  item_added: "added a song",
  item_removed: "removed a song",
  items_reordered: "reordered the songs",
  item_notes_updated: "edited song notes",
};

export function PlanView() {
  const id = useSearchParams().get("id") ?? "";
  const isAdmin = useIsAdmin();
  const plan = useLiveQuery(() => getPlan(localDb(), id), [id]);
  const events = useLiveQuery(() => listPlanEvents(localDb(), id), [id]) ?? [];

  const back = (
    <Link href="/plans" className="mb-1 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      Plans
    </Link>
  );

  if (plan === undefined) return <LocalSkeleton />;
  if (plan === null) {
    return (
      <>
        {back}
        <NotOnDevice what="plan" backHref="/plans" backLabel="Back to plans" />
      </>
    );
  }

  const archived = plan.status === "archived";
  return (
    <>
      {back}
      <div className="mb-4 flex flex-col gap-3">
        <div className="min-w-0 space-y-2">
          <h1 className="text-[1.75rem] leading-tight font-medium md:text-3xl">{plan.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PlanStatusBadge status={plan.status} />
            <span>
              {plan.items.length} {plan.items.length === 1 ? "song" : "songs"} · updated {relativeTime(plan.updated_at)}
              {plan.editorName ? ` by ${plan.editorName}` : null}
            </span>
          </p>
          {plan.description ? <p className="max-w-prose whitespace-pre-line">{plan.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SharePlanButton planId={plan.id} title={plan.title} />
          <OnlineOnly label="Editing needs a connection">
            {!archived ? (
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link href={`/plans/${plan.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              </Button>
            ) : null}
          </OnlineOnly>
          <PlanMenu planId={plan.id} title={plan.title} archived={archived} isAdmin={isAdmin} />
        </div>
      </div>

      {archived ? (
        <p role="status" className="mb-4 rounded-lg border bg-surface-soft p-3 text-sm">
          <strong>Archived.</strong> This plan is read-only. Restore it to make changes.
        </p>
      ) : null}

      <KeepOffline
        planId={plan.id}
        sheets={plan.items
          .filter((i) => i.arrangementId)
          .map((i) => ({ arrangementId: i.arrangementId, version: i.fileVersion, bytes: i.bytes }))}
      />
      <PlanSongs items={plan.items} />
      {events.length ? (
        <ul aria-label="Events for this plan" className="mt-4 flex flex-wrap gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/event?id=${e.id}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm hover:bg-accent"
              >
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                {e.title} · {formatEventDate(e.event_date)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <PlanActivity planId={plan.id} version={plan.version} />
    </>
  );
}

/** Plan history, fetched live: it isn't synced to devices, so it's hidden offline. */
function PlanActivity({ planId, version }: { planId: string; version: number }) {
  const online = useOnline();
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof fetchPlanActivity>>>([]);
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    fetchPlanActivity(planId)
      .then((rows) => !cancelled && setActivity(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [planId, version, online]);

  if (!online || !activity.length) return null;
  return (
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
  );
}
