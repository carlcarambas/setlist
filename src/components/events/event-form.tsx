"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/features/auth/form-state";
import { createEvent, updateEvent } from "@/features/events/actions";

type EventValues = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
};

export function EventForm({ event, defaultDate }: { event?: EventValues; defaultDate?: string }) {
  const [state, action] = useActionState(event ? updateEvent : createEvent, initialFormState);
  const v = state.values;
  const descriptionError = state.fieldErrors?.description?.[0];

  return (
    <form action={action} className="grid max-w-xl gap-4" noValidate>
      <FormMessage state={state} />
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <Field
        name="title"
        label="Title"
        placeholder="e.g. Sunday Service"
        maxLength={200}
        defaultValue={v?.title ?? event?.title}
        errors={state.fieldErrors?.title}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="eventDate"
          label="Date"
          type="date"
          defaultValue={v?.eventDate ?? event?.eventDate ?? defaultDate}
          errors={state.fieldErrors?.eventDate}
          required
        />
        <Field
          name="startTime"
          label="Start time (optional)"
          type="time"
          defaultValue={v?.startTime ?? event?.startTime?.slice(0, 5) ?? ""}
          errors={state.fieldErrors?.startTime}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={v?.description ?? event?.description ?? ""}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError ? "description-error" : undefined}
        />
        {descriptionError ? (
          <p id="description-error" className="text-sm text-destructive">
            {descriptionError}
          </p>
        ) : null}
      </div>
      <div className="sm:w-40">
        <SubmitButton pendingText="Saving…">{event ? "Save" : "Create event"}</SubmitButton>
      </div>
    </form>
  );
}
