"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ListMusic, Pencil } from "lucide-react";
import { AttachForm, DeleteEventButton, DetachButton } from "@/components/events/event-actions";
import { EventDateLine } from "@/components/events/event-list";
import { EmptyState } from "@/components/layout/empty-state";
import { LocalSkeleton, NotOnDevice, OnlineOnly } from "@/components/local/states";
import { OfflineBadge } from "@/components/offline/offline-badge";
import { PlanStatusBadge } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { localDb } from "@/features/local-db/db";
import { useChurchToday, useIsAdmin } from "@/features/local-db/hooks";
import { getEvent, listAttachablePlans } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";
import { useOnline } from "@/features/offline/use-online";

export function EventView() {
  const id = useSearchParams().get("id") ?? "";
  const today = useChurchToday();
  const isAdmin = useIsAdmin();
  const online = useOnline();
  const event = useLiveQuery(async () => (today ? getEvent(localDb(), id, today) : undefined), [id, today]);
  const plans = useLiveQuery(() => listAttachablePlans(localDb()), []) ?? [];

  if (event === undefined) return <LocalSkeleton />;
  if (event === null) {
    return <NotOnDevice what="event" backHref="/events" backLabel="Back to events" />;
  }

  const attached = new Set(event.plans.map((p) => p.id));
  const options = plans.filter((p) => !attached.has(p.id)).map((p) => ({ id: p.id, label: p.title }));

  return (
    <>
      <Link
        href={event.isPast ? "/events?past=1" : "/events"}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Events
      </Link>
      <div className="mb-8 flex flex-col items-start gap-4 md:mb-12">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[1.75rem] leading-tight font-medium md:text-3xl">{event.title}</h1>
          <p className="text-muted-foreground">
            <EventDateLine eventDate={event.event_date} startTime={event.start_time} />
            {event.isPast ? " · past" : null}
          </p>
          {event.creatorName ? <p className="text-sm text-muted-foreground">Created by {event.creatorName}</p> : null}
          {event.description ? <p className="max-w-prose pt-1 whitespace-pre-line">{event.description}</p> : null}
        </div>
        <OnlineOnly label="Editing needs a connection">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href={`/events/${event.id}/edit`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Link>
            </Button>
            {isAdmin ? <DeleteEventButton eventId={event.id} title={event.title} /> : null}
          </div>
        </OnlineOnly>
      </div>

      <section aria-labelledby="event-plans-heading" className="space-y-4">
        <h2 id="event-plans-heading" className="text-xl font-medium">
          Plans ({event.plans.length})
        </h2>
        {event.plans.length === 0 ? (
          <EmptyState icon={ListMusic} title="No plans to show">
            {options.length ? "Add a plan below." : (
              <>
                <Link href="/plans" className="underline underline-offset-4">
                  Create a plan
                </Link>
                , then add it here.
              </>
            )}
          </EmptyState>
        ) : (
          <ul className="-mx-3 divide-y border-y">
            {event.plans.map((p) => (
              <li key={p.id} className="relative flex items-center justify-between gap-2 px-3 py-4 hover:bg-surface-soft">
                <div className="min-w-0">
                  <Link href={`/plan?id=${p.id}`} className="font-medium after:absolute after:inset-0">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {p.songCount} {p.songCount === 1 ? "song" : "songs"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OfflineBadge status={p.offline} />
                  {p.status !== "draft" ? <PlanStatusBadge status={p.status} /> : null}
                  {online ? (
                    <DetachButton eventId={event.id} planId={p.id} label={`Remove ${p.title} from this event`} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {options.length ? (
          <div className="max-w-xl">
            <OnlineOnly label="Adding plans needs a connection">
              <AttachForm pick="plan" fixedId={event.id} options={options} />
            </OnlineOnly>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">Removing a plan from an event keeps the plan.</p>
      </section>
    </>
  );
}
