"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/features/auth/form-state";
import { inviteMember, setMemberStatus, updateOwnProfile } from "@/features/members/actions";
import { requestSync } from "@/features/sync/engine";
import { updateAppSettings } from "@/features/settings/actions";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function ProfileForm({ displayName, optional = false }: { displayName: string; optional?: boolean }) {
  const [state, action] = useActionState(updateOwnProfile, initialFormState);
  useEffect(() => {
    if (state.status === "success") void requestSync();
  }, [state]);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <Field
          name="displayName"
          label={optional ? "Device name (optional)" : "Your name"}
          autoComplete={optional ? "off" : "name"}
          maxLength={100}
          defaultValue={state.values?.displayName ?? displayName}
          required={!optional}
          errors={state.fieldErrors?.displayName}
        />
        {/* Level with the input: the label's height plus the gap under it. */}
        <div className="sm:w-28 sm:pt-[1.375rem]">
          <SubmitButton pendingText="Saving…" variant="outline">
            Save
          </SubmitButton>
        </div>
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
  device = false,
}: {
  userId: string;
  name: string;
  nextStatus: "active" | "inactive";
  /** A member device: "Block"/"Unblock" instead of "Deactivate"/"Reactivate". */
  device?: boolean;
}) {
  const label = device
    ? nextStatus === "inactive"
      ? "Block"
      : "Unblock"
    : nextStatus === "inactive"
      ? "Deactivate"
      : "Reactivate";
  const confirmText = device
    ? `Block ${name}? It can no longer view or change anything. (Someone determined can come back by clearing their browser; archived plans can be restored.)`
    : `Deactivate ${name}? They will lose access immediately.`;
  return (
    <form
      action={setMemberStatus}
      onSubmit={(event) => {
        if (nextStatus === "inactive" && !window.confirm(confirmText)) {
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
        <Select name="timezone" defaultValue={state.values?.timezone ?? timezone}>
          <SelectTrigger id="timezone" className="w-full" aria-describedby="timezone-hint" />
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
