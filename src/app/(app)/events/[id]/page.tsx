import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListMusic, Pencil } from "lucide-react";
import { z } from "zod";
import { AttachForm, DeleteEventButton, DetachButton } from "@/components/events/event-actions";
import { EventDateLine } from "@/components/events/event-list";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { PlanStatusBadge } from "@/components/plans/plan-status";
import { Button } from "@/components/ui/button";
import { getEvent, listAttachablePlans } from "@/features/events/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <Event params={params} />
    </Suspense>
  );
}

async function Event({ params }: Pick<PageProps<"/events/[id]">, "params">) {
  const member = await requireActiveMember();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [event, plans] = await Promise.all([getEvent(id.data, member), listAttachablePlans()]);
  if (!event) notFound();

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-muted-foreground">
            <EventDateLine eventDate={event.eventDate} startTime={event.startTime} />
            {event.isPast ? " · past" : null}
          </p>
          <p className="text-sm text-muted-foreground">Created by {event.creatorName}</p>
          {event.description ? <p className="max-w-prose pt-1 whitespace-pre-line">{event.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href={`/events/${event.id}/edit`}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Link>
          </Button>
          {event.canDelete ? <DeleteEventButton eventId={event.id} title={event.title} /> : null}
        </div>
      </div>

      <section aria-labelledby="event-plans-heading" className="space-y-4">
        <h2 id="event-plans-heading" className="font-semibold">
          Plans ({event.plans.length})
        </h2>
        {event.plans.length === 0 ? (
          <EmptyState icon={ListMusic} title="No plans to show">
            {options.length ? (
              "Add a plan below."
            ) : (
              <>
                <Link href="/plans" className="underline underline-offset-4">
                  Create a plan
                </Link>
                , then add it here.
              </>
            )}
          </EmptyState>
        ) : (
          <ul className="divide-y rounded-lg border">
            {event.plans.map((p) => (
              <li key={p.id} className="relative flex items-center justify-between gap-2 p-4 hover:bg-accent/50">
                <div className="min-w-0">
                  <Link href={`/plans/${p.id}`} className="font-medium after:absolute after:inset-0">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {p.songCount} {p.songCount === 1 ? "song" : "songs"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.status !== "draft" ? <PlanStatusBadge status={p.status} /> : null}
                  <DetachButton eventId={event.id} planId={p.id} label={`Remove ${p.title} from this event`} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {options.length ? (
          <div className="max-w-xl">
            <AttachForm pick="plan" fixedId={event.id} options={options} />
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">Removing a plan from an event keeps the plan.</p>
      </section>
    </>
  );
}
