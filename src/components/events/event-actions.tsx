"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/features/auth/form-state";
import { attachPlanToEvent, deleteEvent, detachPlanFromEvent } from "@/features/events/actions";

const selectClass =
  "h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";

function Pending({ idle, busy, icon }: { idle: string; busy: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {pending ? busy : idle}
    </>
  );
}

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${title}"? Its plans are kept; they're only removed from this event.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <Button type="submit" variant="outline" className="h-11 gap-2">
        <Pending idle="Delete" busy="Deleting…" icon={<Trash2 className="size-4" aria-hidden />} />
      </Button>
    </form>
  );
}

/** Removes a plan from an event. Neither record is deleted. */
export function DetachButton({ eventId, planId, label }: { eventId: string; planId: string; label: string }) {
  return (
    <form action={detachPlanFromEvent}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="planId" value={planId} />
      <DetachSubmit label={label} />
    </form>
  );
}

function DetachSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="icon" className="relative z-10 size-11" disabled={pending} aria-label={label}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
    </Button>
  );
}

type Option = { id: string; label: string };

/**
 * Attaches a plan to an event. On an event page the member picks one of their plans;
 * in the plan editor they pick an upcoming event.
 */
export function AttachForm({
  pick,
  fixedId,
  options,
}: {
  pick: "plan" | "event";
  fixedId: string;
  options: Option[];
}) {
  const [state, action] = useActionState(attachPlanToEvent, initialFormState);
  const fieldId = `attach-${pick}`;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name={pick === "plan" ? "eventId" : "planId"} value={fixedId} />
      <Label htmlFor={fieldId}>{pick === "plan" ? "Add a plan" : "Add to an upcoming event"}</Label>
      <div className="flex gap-2">
        <select id={fieldId} name={pick === "plan" ? "planId" : "eventId"} className={selectClass} required defaultValue="">
          <option value="" disabled>
            {pick === "plan" ? "Choose a plan…" : "Choose an event…"}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-11 shrink-0 gap-2">
          <Pending idle="Add" busy="Adding…" icon={<Plus className="size-4" aria-hidden />} />
        </Button>
      </div>
      {state.status === "error" ? <FormMessage state={state} /> : null}
    </form>
  );
}
