import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AttachForm, DetachButton } from "@/components/events/event-actions";
import { listEvents, listPlanEvents } from "@/features/events/queries";
import { formatEventDate } from "@/features/events/schemas";

/** Events a plan belongs to. In the editor, members can also add or remove them. */
export async function PlanEvents({ planId, editable }: { planId: string; editable: boolean }) {
  const [events, upcoming] = await Promise.all([
    listPlanEvents(planId),
    editable ? listEvents({ past: false, limit: 50 }) : Promise.resolve([]),
  ]);
  const linked = new Set(events.map((e) => e.id));
  const options = upcoming
    .filter((e) => !linked.has(e.id))
    .map((e) => ({ id: e.id, label: `${e.title} · ${formatEventDate(e.eventDate)}` }));

  if (!editable && events.length === 0) return null;

  return (
    <section aria-label="Events for this plan" className="mb-6 space-y-3">
      {events.length ? (
        <ul className="flex flex-wrap gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center rounded-full border pl-3 text-sm">
              <CalendarDays className="mr-1.5 size-4 text-muted-foreground" aria-hidden />
              <Link href={`/event?id=${e.id}`} className="min-h-11 content-center pr-3 underline-offset-4 hover:underline">
                {e.title} · {formatEventDate(e.eventDate)}
              </Link>
              {editable ? (
                <DetachButton eventId={e.id} planId={planId} label={`Remove this plan from ${e.title}`} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Not part of any event yet.</p>
      )}
      {editable && options.length ? (
        <div className="max-w-md">
          <AttachForm pick="event" fixedId={planId} options={options} />
        </div>
      ) : null}
    </section>
  );
}
