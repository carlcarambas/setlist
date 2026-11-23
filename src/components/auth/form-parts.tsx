"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/features/auth/form-state";

export function Field({
  name,
  label,
  errors,
  hint,
  ...inputProps
}: ComponentProps<typeof Input> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [errors?.length ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        className="h-11"
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText }: { children: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending} aria-disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}

/** Announces the form result to screen readers; icon + text, not color alone. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return <div role="status" aria-live="polite" />;
  const isError = state.status === "error";
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={
        isError
          ? "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          : "flex items-start gap-2 rounded-md border bg-muted p-3 text-sm"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </div>
  );
}
