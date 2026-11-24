"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formError, formSuccess, keptValues, validationError, type FormState } from "@/features/auth/form-state";
import { getCurrentMember, isAdmin } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { attachErrorMessage, eventPlanSchema, eventSchema } from "./schemas";

const SIGNED_OUT = "Your session has ended. Sign in again.";

async function activeMember() {
  const member = await getCurrentMember();
  return member?.status === "active" ? member : null;
}

function eventRow(data: z.output<typeof eventSchema>) {
  return { title: data.title, description: data.description, event_date: data.eventDate, start_time: data.startTime };
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await activeMember())) return formError(SIGNED_OUT, keptValues(formData));
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(eventRow(parsed.data)).select("id").single();
  if (error || !data) return formError("The event couldn't be created. Please try again.", keptValues(formData));
  redirect(`/event?id=${data.id}`);
}

export async function updateEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await activeMember())) return formError(SIGNED_OUT, keptValues(formData));
  const eventId = z.uuid().safeParse(formData.get("eventId"));
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!eventId.success) return formError("This event no longer exists.");
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update(eventRow(parsed.data))
    .eq("id", eventId.data)
    .select("id");
  if (error) return formError("The event couldn't be saved. Please try again.", keptValues(formData));
  if (!data.length) return formError("This event no longer exists.", keptValues(formData));
  redirect(`/event?id=${eventId.data}`);
}

/** Administrators only (spec v2 §4.4); RLS refuses everyone else too. */
export async function deleteEvent(formData: FormData): Promise<boolean> {
  if (!isAdmin(await activeMember())) return false;
  const eventId = z.uuid().safeParse(formData.get("eventId"));
  if (!eventId.success) return false;
  const supabase = await createClient();
  // Associations cascade; the plans themselves are untouched.
  const { error } = await supabase.from("events").delete().eq("id", eventId.data);
  return !error;
}

export async function attachPlanToEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await activeMember())) return formError(SIGNED_OUT);
  const parsed = eventPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return formError("Choose a plan and an event.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_plans")
    .insert({ event_id: parsed.data.eventId, plan_id: parsed.data.planId });
  if (error) return formError(attachErrorMessage(error.code));
  refresh();
  return formSuccess("Added.");
}

export async function detachPlanFromEvent(formData: FormData) {
  if (!(await activeMember())) return;
  const parsed = eventPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  // Removes only the association; neither the event nor the plan is deleted.
  await supabase.from("event_plans").delete().eq("event_id", parsed.data.eventId).eq("plan_id", parsed.data.planId);
  refresh();
}
