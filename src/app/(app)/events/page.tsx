import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { EventList } from "@/components/events/event-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SectionSkeleton } from "@/components/layout/section-skeleton";
import { Button } from "@/components/ui/button";
import { listEvents } from "@/features/events/queries";
import { requireActiveMember } from "@/lib/auth/member";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <PageHeader
        title="Events"
        description="Services and gatherings, with the plans for each."
        actions={
          <Button asChild className="h-11 gap-2">
            <Link href="/events/new">
              <Plus className="size-4" aria-hidden />
              New event
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<SectionSkeleton />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Events({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  await requireActiveMember();
  const past = (await searchParams).past === "1";
  const events = await listEvents({ past });

  return (
    <section aria-labelledby="events-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="events-heading" className="font-semibold">
          {past ? "Past events" : "Upcoming events"} ({events.length})
        </h2>
        <Link href={past ? "/events" : "/events?past=1"} className="min-h-11 content-center text-sm underline underline-offset-4">
          {past ? "Show upcoming" : "Show past"}
        </Link>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title={past ? "No past events" : "No upcoming events"}>
          {past ? "Events move here the day after they happen." : "Create an event, then add the plans for it."}
        </EmptyState>
      ) : (
        <EventList events={events} />
      )}
    </section>
  );
}
