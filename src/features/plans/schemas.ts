import { z } from "zod";

export const planTitleSchema = z.string().trim().min(1, "Give the plan a title.").max(200, "Use at most 200 characters.");
export const planDescriptionSchema = z.string().trim().max(2000, "Use at most 2000 characters.");
export const itemNotesSchema = z.string().trim().max(500, "Use at most 500 characters.");

export const newPlanSchema = z.object({ title: planTitleSchema });

export const planDetailsSchema = z.object({
  planId: z.uuid(),
  expectedVersion: z.number().int().min(1),
  title: planTitleSchema,
  description: planDescriptionSchema,
});

export const reorderSchema = z.object({
  planId: z.uuid(),
  expectedVersion: z.number().int().min(1),
  itemIds: z.array(z.uuid()).max(500),
});

/** Why an edit failed; the editor shows a matching message. */
export type PlanEditError = "conflict" | "archived" | "not_found" | "not_allowed" | "unavailable" | "invalid" | "error";

/** Maps the database function errors (see the plans migration) to editor outcomes. */
export function planEditError(message: string | undefined): PlanEditError {
  switch (message) {
    case "version_conflict":
      return "conflict";
    case "plan_archived":
      return "archived";
    case "plan_not_found":
    case "item_not_found":
      return "not_found";
    case "not_allowed":
      return "not_allowed";
    case "arrangement_unavailable":
      return "unavailable";
    case "invalid_item_set":
      return "invalid";
    default:
      return "error";
  }
}

export const PLAN_EDIT_MESSAGES: Record<PlanEditError, string> = {
  conflict: "Someone else changed this plan. Reload to see their changes.",
  archived: "This plan is archived. Restore it to make changes.",
  not_found: "This plan or song no longer exists. Reload the page.",
  not_allowed: "You don't have permission to edit this plan.",
  unavailable: "That sheet is archived or no longer available.",
  invalid: "The song list changed. Reload the page and try again.",
  error: "Changes couldn't be saved. Check your connection and try again.",
};
