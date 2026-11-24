import Link from "next/link";
import { formatEventDate, formatEventTime } from "@/features/events/schemas";

export type EventListItem = { id: string; title: string; eventDate: string; startTime: string | null; planCount: number };

export function EventDateLine({ eventDate, startTime }: { eventDate: string; startTime: string | null }) {
  const time = formatEventTime(startTime);
  return (
    <>
      <time dateTime={eventDate}>{formatEventDate(eventDate)}</time>
      {time ? ` · ${time}` : null}
    </>
  );
}

export function EventList({ events }: { events: EventListItem[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {events.map((e) => (
        <li key={e.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-accent/50">
          <div className="min-w-0">
            <Link href={`/event?id=${e.id}`} className="font-medium after:absolute after:inset-0">
              {e.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              <EventDateLine eventDate={e.eventDate} startTime={e.startTime} />
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {e.planCount} {e.planCount === 1 ? "plan" : "plans"}
          </span>
        </li>
      ))}
    </ul>
  );
}
