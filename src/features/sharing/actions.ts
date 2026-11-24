"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { findShareCandidates } from "./queries";
import { linkExpiresAt, linkExpirySchema, shareErrorMessage, shareSchema } from "./schemas";
import { generateLinkToken, hashLinkToken } from "./token";

export type ShareResult = { ok: true } | { ok: false; message: string };

async function activeMember() {
  const member = await getCurrentMember();
  return member?.status === "active" ? member : null;
}

const failed = (message?: string): ShareResult => ({ ok: false, message: shareErrorMessage(message) });

/** Grants or changes a member's access (SHARE-01/02). Ownership is checked in the database. */
export async function shareWithMember(input: z.input<typeof shareSchema>): Promise<ShareResult> {
  if (!(await activeMember())) return failed("not_allowed");
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return failed();
  const supabase = await createClient();
  const { error } = await supabase.rpc("share_plan", {
    p_plan_id: parsed.data.planId,
    p_user_id: parsed.data.userId,
    p_permission: parsed.data.permission,
  });
  if (error) return failed(error.message);
  refresh();
  return { ok: true };
}

export async function revokeShare(input: { shareId: string }): Promise<ShareResult> {
  if (!(await activeMember())) return failed("not_allowed");
  const shareId = z.uuid().safeParse(input.shareId);
  if (!shareId.success) return failed("share_not_found");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_plan_share", { p_share_id: shareId.data });
  if (error) return failed(error.message);
  refresh();
  return { ok: true };
}

/**
 * Creates a view-only link (SHARE-04/05/07). Returns its path, containing the raw
 * token: this is the only time it exists outside the owner's clipboard.
 */
export async function createShareLink(input: {
  planId: string;
  expiry: string;
}): Promise<({ ok: true; path: string }) | { ok: false; message: string }> {
  if (!(await activeMember())) return failed("not_allowed") as { ok: false; message: string };
  const parsed = z.object({ planId: z.uuid(), expiry: linkExpirySchema }).safeParse(input);
  if (!parsed.success) return failed() as { ok: false; message: string };

  const token = generateLinkToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_plan_link", {
    p_plan_id: parsed.data.planId,
    p_token_hash: hashLinkToken(token),
    p_expires_at: linkExpiresAt(parsed.data.expiry) ?? undefined,
  });
  if (error) return failed(error.message) as { ok: false; message: string };
  refresh();
  return { ok: true, path: `/share/${token}` };
}

export async function revokeShareLink(input: { linkId: string }): Promise<ShareResult> {
  if (!(await activeMember())) return failed("not_allowed");
  const linkId = z.uuid().safeParse(input.linkId);
  if (!linkId.success) return failed("link_not_found");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_plan_link", { p_link_id: linkId.data });
  if (error) return failed(error.message);
  refresh();
  return { ok: true };
}

export async function searchMembersToShare(query: string) {
  const member = await activeMember();
  if (!member) return [];
  return findShareCandidates(member.id, z.string().max(100).catch("").parse(query));
}
