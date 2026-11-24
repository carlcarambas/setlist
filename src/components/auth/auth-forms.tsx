"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  acceptInvitation,
  requestPasswordReset,
  signIn,
  updatePassword,
} from "@/features/auth/actions";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { Field, FormMessage, SubmitButton } from "./form-parts";
import { TurnstileField } from "./turnstile";

const NOTICES: Record<string, FormState> = {
  inactive: {
    status: "error",
    message: "This device or account has been blocked. Contact a ministry administrator.",
  },
  link: { status: "error", message: "That link is invalid or has expired. Request a new one." },
};

export function SignInForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signIn, initialFormState);
  const notice = NOTICES[params.get("reason") ?? params.get("error") ?? ""];
  const shown = state.status === "idle" && notice ? notice : state;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={shown} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
        errors={state.fieldErrors?.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <TurnstileField resetKey={state} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      <Link href="/reset-password" className="text-center text-sm underline underline-offset-4">
        Forgot your password?
      </Link>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
        errors={state.fieldErrors?.email}
      />
      <TurnstileField resetKey={state} />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      <Link href="/sign-in" className="text-center text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        errors={state.fieldErrors?.password}
      />
      <Field
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Saving…">Save password</SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ email, defaultName }: { email: string; defaultName: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <p className="text-sm text-muted-foreground">
        Joining as <span className="font-medium text-foreground">{email}</span>
      </p>
      <Field
        name="displayName"
        label="Your name"
        autoComplete="name"
        defaultValue={state.values?.displayName ?? defaultName}
        hint="Shown to other members when you share plans."
        required
        errors={state.fieldErrors?.displayName}
      />
      <Field
        name="password"
        label="Choose a password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        errors={state.fieldErrors?.password}
      />
      <Field
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingText="Joining…">Join the ministry</SubmitButton>
    </form>
  );
}
