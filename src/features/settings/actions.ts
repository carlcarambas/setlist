"use server";

import { refresh } from "next/cache";
import {
  formError,
  formSuccess,
  keptValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { appSettingsSchema } from "@/features/auth/schemas";
import { getCurrentMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";

export async function updateAppSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (member?.status !== "active" || member.role !== "admin") {
    return formError("Only administrators can change settings.", keptValues(formData));
  }

  const parsed = appSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ church_name: parsed.data.churchName, timezone: parsed.data.timezone })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return formError("Settings couldn't be saved. Please try again.", keptValues(formData));

  refresh();
  return formSuccess("Settings saved.");
}
