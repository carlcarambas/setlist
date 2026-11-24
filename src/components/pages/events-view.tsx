"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { EventList } from "@/components/events/event-list";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { LocalSkeleton, OnlineOnly } from "@/components/local/states";
import { Button } from "@/components/ui/button";
import { localDb } from "@/features/local-db/db";
import { useChurchToday } from "@/features/local-db/hooks";
import { listEvents } from "@/features/local-db/queries";
import { useLiveQuery } from "@/features/local-db/use-live-query";

export function EventsView() {
  const past = useSearchParams().get("past") === "1";
  const today = useChurchToday();
  const events = useLiveQuery(async () => (today ? listEvents(localDb(), today, past) : undefined), [today, past]);

  return (
    <>
      <PageHeader
        title="Events"
        description="Services and gatherings, with the plans for each."
        actions={
          <OnlineOnly>
            <Button asChild className="h-11 gap-2">
              <Link href="/events/new">
                <Plus className="size-4" aria-hidden />
                New event
              </Link>
            </Button>
          </OnlineOnly>
        }
      />
      <section aria-labelledby="events-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="events-heading" className="font-semibold">
            {past ? "Past events" : "Upcoming events"}
            {events ? ` (${events.length})` : null}
          </h2>
          <Link href={past ? "/events" : "/events?past=1"} className="min-h-11 content-center text-sm underline underline-offset-4">
            {past ? "Show upcoming" : "Show past"}
          </Link>
        </div>
        {events === undefined ? (
          <LocalSkeleton />
        ) : events.length === 0 ? (
          <EmptyState icon={CalendarDays} title={past ? "No past events" : "No upcoming events"}>
            {past ? "Events move here the day after they happen." : "Create an event, then add the plans for it."}
          </EmptyState>
        ) : (
          <EventList events={events} />
        )}
      </section>
    </>
  );
}
