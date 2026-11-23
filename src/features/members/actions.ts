"use server";

import { refresh } from "next/cache";
import {
  formError,
  formSuccess,
  keptValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { inviteMemberSchema, memberStatusSchema, profileSchema } from "@/features/auth/schemas";
import { getCurrentMember } from "@/lib/auth/member";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Deactivated accounts are banned in Supabase Auth so their sessions can't be refreshed.
// RLS already blocks their data access immediately (is_active_member()).
const DEACTIVATED_BAN = "876000h"; // ~100 years

async function currentAdmin() {
  const member = await getCurrentMember();
  return member?.status === "active" && member.role === "admin" ? member : null;
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await currentAdmin())) return formError("Only administrators can invite members.", keptValues(formData));

  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { display_name: parsed.data.displayName },
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/accept-invitation`,
  });

  if (error) {
    if (error.code === "email_exists" || error.status === 422) {
      return formError("Someone with that email is already a member or has been invited.", keptValues(formData));
    }
    if (error.status === 429) {
      return formError("Email sending limit reached. Wait a while, or set up custom SMTP (see README).", keptValues(formData));
    }
    console.error("inviteMember failed", { code: error.code, status: error.status });
    return formError("The invitation couldn't be sent. Please try again.", keptValues(formData));
  }

  refresh();
  return formSuccess(`Invitation sent to ${parsed.data.email}.`);
}

export async function setMemberStatus(formData: FormData): Promise<void> {
  if (!(await currentAdmin())) return;

  const parsed = memberStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { userId, status } = parsed.data;

  const admin = createAdminClient();
  const ban = (duration: string) =>
    admin.auth.admin.updateUserById(userId, { ban_duration: duration });

  const { error: banError } = await ban(status === "inactive" ? DEACTIVATED_BAN : "none");
  if (banError) {
    console.error("setMemberStatus: ban update failed", { code: banError.code });
    return;
  }

  // The database function re-checks that the caller is an admin and not changing themselves.
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", { p_user_id: userId, p_status: status });
  if (error) {
    await ban(status === "inactive" ? "none" : DEACTIVATED_BAN); // undo, keep auth and profile in step
    console.error("setMemberStatus: status update failed", { message: error.message });
    return;
  }

  refresh();
}

export async function updateOwnProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (member?.status !== "active") return formError("You need to be signed in.", keptValues(formData));

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", member.id)
    .select("id");
  if (error || !data?.length) return formError("Your profile couldn't be saved. Please try again.", keptValues(formData));

  refresh();
  return formSuccess("Profile saved.");
}
