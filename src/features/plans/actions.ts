"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formError, keptValues, validationError, type FormState } from "@/features/auth/form-state";
import { getCurrentMember, isAdmin } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { findArrangementsForPlan, getPlanActivity } from "./queries";
import {
  itemNotesSchema,
  newPlanSchema,
  planDetailsSchema,
  planEditError,
  reorderSchema,
  type PlanEditError,
} from "./schemas";

export type PlanEditResult = { ok: true; version: number } | { ok: false; error: PlanEditError };

async function signedIn() {
  const member = await getCurrentMember();
  return member?.status === "active";
}

function fail(message?: string): PlanEditResult {
  return { ok: false, error: planEditError(message) };
}

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await signedIn())) return formError("Your session has ended. Sign in again.");
  const parsed = newPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, keptValues(formData));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_plan", { p_title: parsed.data.title });
  if (error || !data) return formError("The plan couldn't be created. Please try again.", keptValues(formData));
  redirect(`/plans/${data}/edit`);
}

export async function updatePlanDetails(input: z.input<typeof planDetailsSchema>): Promise<PlanEditResult> {
  if (!(await signedIn())) return fail("not_allowed");
  const parsed = planDetailsSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_plan_details", {
    p_plan_id: parsed.data.planId,
    p_expected_version: parsed.data.expectedVersion,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
  });
  return error || data == null ? fail(error?.message) : { ok: true, version: data };
}

export async function addPlanItem(input: {
  planId: string;
  arrangementId: string;
}): Promise<({ itemId: string } & PlanEditResult) | { ok: false; error: PlanEditError }> {
  if (!(await signedIn())) return fail("not_allowed") as { ok: false; error: PlanEditError };
  const planId = z.uuid().safeParse(input.planId);
  const arrangementId = z.uuid().safeParse(input.arrangementId);
  if (!planId.success || !arrangementId.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_plan_item", {
    p_plan_id: planId.data,
    p_arrangement_id: arrangementId.data,
  });
  if (error || !data) return { ok: false, error: planEditError(error?.message) };
  const result = z.object({ item_id: z.uuid(), version: z.number() }).parse(data);
  return { ok: true, version: result.version, itemId: result.item_id };
}

export async function removePlanItem(input: { itemId: string }): Promise<PlanEditResult> {
  if (!(await signedIn())) return fail("not_allowed");
  const itemId = z.uuid().safeParse(input.itemId);
  if (!itemId.success) return fail("item_not_found");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_plan_item", { p_item_id: itemId.data });
  return error || data == null ? fail(error?.message) : { ok: true, version: data };
}

export async function reorderPlanItems(input: z.input<typeof reorderSchema>): Promise<PlanEditResult> {
  if (!(await signedIn())) return fail("not_allowed");
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_item_set");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reorder_plan_items", {
    p_plan_id: parsed.data.planId,
    p_expected_version: parsed.data.expectedVersion,
    p_item_ids: parsed.data.itemIds,
  });
  return error || data == null ? fail(error?.message) : { ok: true, version: data };
}

export async function updateItemNotes(input: {
  itemId: string;
  expectedVersion: number;
  notes: string;
}): Promise<PlanEditResult> {
  if (!(await signedIn())) return fail("not_allowed");
  const itemId = z.uuid().safeParse(input.itemId);
  const notes = itemNotesSchema.safeParse(input.notes);
  const version = z.number().int().min(1).safeParse(input.expectedVersion);
  if (!itemId.success || !notes.success || !version.success) return fail("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_plan_item_notes", {
    p_item_id: itemId.data,
    p_expected_version: version.data,
    p_notes: notes.data,
  });
  return error || data == null ? fail(error?.message) : { ok: true, version: data };
}

const statusSchema = z.object({ planId: z.uuid(), status: z.enum(["draft", "published", "archived"]) });

export async function setPlanStatus(formData: FormData): Promise<void> {
  if (!(await signedIn())) return;
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("set_plan_status", { p_plan_id: parsed.data.planId, p_status: parsed.data.status });
  refresh();
}

export async function duplicatePlan(formData: FormData): Promise<void> {
  if (!(await signedIn())) return;
  const planId = z.uuid().safeParse(formData.get("planId"));
  if (!planId.success) return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("duplicate_plan", { p_plan_id: planId.data });
  if (data) redirect(`/plans/${data}/edit`);
}

/** Permanent delete: administrators only (spec v2 D4). The database function re-checks. */
export async function deletePlan(formData: FormData): Promise<boolean> {
  if (!isAdmin(await getCurrentMember())) return false;
  const planId = z.uuid().safeParse(formData.get("planId"));
  if (!planId.success) return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_plan", { p_plan_id: planId.data });
  return !error;
}

/** Recent history of a plan; shown only while online (activity isn't synced to devices). */
export async function fetchPlanActivity(planId: string) {
  if (!(await signedIn())) return [];
  const id = z.uuid().safeParse(planId);
  return id.success ? getPlanActivity(id.data) : [];
}

export async function searchSongsForPlan(query: string) {
  if (!(await signedIn())) return [];
  return findArrangementsForPlan(z.string().max(100).catch("").parse(query));
}

/** Draft/published from the editor; returns the new version so later edits don't conflict. */
export async function changePlanStatus(input: { planId: string; status: "draft" | "published" }): Promise<PlanEditResult> {
  if (!(await signedIn())) return fail("not_allowed");
  const parsed = z.object({ planId: z.uuid(), status: z.enum(["draft", "published"]) }).safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_plan_status", { p_plan_id: parsed.data.planId, p_status: parsed.data.status });
  return error || data == null ? fail(error?.message) : { ok: true, version: data };
}
