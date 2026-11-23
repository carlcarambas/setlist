"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/features/auth/form-state";
import { inviteMember, setMemberStatus, updateOwnProfile } from "@/features/members/actions";
import { updateAppSettings } from "@/features/settings/actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateOwnProfile, initialFormState);
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="displayName"
        label="Your name"
        autoComplete="name"
        defaultValue={state.values?.displayName ?? displayName}
        required
        errors={state.fieldErrors?.displayName}
      />
      <div className="sm:w-40">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, action] = useActionState(inviteMember, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="displayName"
          label="Name"
          autoComplete="off"
          defaultValue={state.values?.displayName}
          required
          errors={state.fieldErrors?.displayName}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          defaultValue={state.values?.email}
          required
          errors={state.fieldErrors?.email}
        />
      </div>
      <div className="sm:w-48">
        <SubmitButton pendingText="Sending…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}

function StatusButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="h-11" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function MemberStatusForm({
  userId,
  name,
  nextStatus,
}: {
  userId: string;
  name: string;
  nextStatus: "active" | "inactive";
}) {
  const label = nextStatus === "inactive" ? "Deactivate" : "Reactivate";
  return (
    <form
      action={setMemberStatus}
      onSubmit={(event) => {
        if (nextStatus === "inactive" && !window.confirm(`Deactivate ${name}? They will lose access immediately.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={nextStatus} />
      <StatusButton label={label} />
    </form>
  );
}

export function AppSettingsForm({
  churchName,
  timezone,
  timezones,
}: {
  churchName: string;
  timezone: string;
  timezones: string[];
}) {
  const [state, action] = useActionState(updateAppSettings, initialFormState);
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="churchName"
        label="Ministry name"
        defaultValue={state.values?.churchName ?? churchName}
        required
        errors={state.fieldErrors?.churchName}
      />
      <div className="grid gap-2">
        <Label htmlFor="timezone">Time zone</Label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={state.values?.timezone ?? timezone}
          aria-describedby="timezone-hint"
          className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p id="timezone-hint" className="text-xs text-muted-foreground">
          Used to show event dates and decide what counts as upcoming.
        </p>
        {state.fieldErrors?.timezone ? (
          <p className="text-sm text-destructive">{state.fieldErrors.timezone[0]}</p>
        ) : null}
      </div>
      <div className="sm:w-40">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
