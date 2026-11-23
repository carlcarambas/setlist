import type { z } from "zod";

/** Result returned by every form Server Action. Never contains secrets. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted non-secret values, so fields keep their input after an error. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

const SECRET_FIELDS = new Set(["password", "confirmPassword"]);

/** Non-secret text fields from a submission, echoed back so the form can keep them. */
export function keptValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !SECRET_FIELDS.has(key) && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function validationError(error: z.ZodError, values?: Record<string, string>): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
}

export function formError(message: string, values?: Record<string, string>): FormState {
  return { status: "error", message, values };
}

export function formSuccess(message: string): FormState {
  return { status: "success", message };
}
