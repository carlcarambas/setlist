"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { formError, formSuccess, keptValues, validationError, type FormState } from "./form-state";
import {
  acceptInvitationSchema,
  passwordResetRequestSchema,
  signInSchema,
  updatePasswordSchema,
} from "./schemas";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "user_banned") {
      return formError("This account has been deactivated. Contact a ministry administrator.", keptValues(formData));
    }
    // Same message for unknown email and wrong password (no account enumeration).
    return formError("The email or password is incorrect.", keptValues(formData));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.status === "invited") redirect("/accept-invitation");
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return formError("This account has been deactivated. Contact a ministry administrator.", keptValues(formData));
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordResetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/update-password`,
  });
  if (error && error.status === 429) {
    return formError("Too many requests. Please wait a few minutes and try again.", keptValues(formData));
  }

  // Same answer whether or not the address has an account (no account enumeration).
  return formSuccess("If that address belongs to a member, a reset link is on its way. Check your inbox.");
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return formError("Choose a password you haven't used here before.", keptValues(formData));
    if (error.code === "weak_password") return formError("That password is too weak. Try a longer one.", keptValues(formData));
    return formError("Your reset link has expired. Request a new one.", keptValues(formData));
  }

  redirect("/dashboard");
}

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (passwordError) {
    if (passwordError.code === "weak_password") return formError("That password is too weak. Try a longer one.", keptValues(formData));
    return formError("Your invitation link has expired. Ask an administrator to invite you again.", keptValues(formData));
  }

  const { error } = await supabase.rpc("complete_invitation", { p_display_name: parsed.data.displayName });
  if (error) {
    if (error.message.includes("invitation_not_pending")) redirect("/dashboard");
    return formError("We couldn't finish setting up your account. Please try again.", keptValues(formData));
  }

  redirect("/dashboard");
}
