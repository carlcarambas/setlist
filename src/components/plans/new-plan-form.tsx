"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { initialFormState } from "@/features/auth/form-state";
import { createPlan } from "@/features/plans/actions";

export function NewPlanForm() {
  const [state, action] = useActionState(createPlan, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" noValidate>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <Field
        name="title"
        label="New plan"
        placeholder="e.g. Sunday Service, Dec 7"
        maxLength={200}
        defaultValue={state.values?.title}
        errors={state.fieldErrors?.title}
        required
      />
      <div className="sm:w-40">
        <SubmitButton pendingText="Creating…">Create plan</SubmitButton>
      </div>
    </form>
  );
}
