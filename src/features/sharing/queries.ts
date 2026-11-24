import "server-only";
import { z } from "zod";
import type { PlanItemView } from "@/features/plans/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { memberSearchTerm } from "./schemas";
import { hashLinkToken, isLinkToken } from "./token";

/** The owner's view of who can open a plan. RLS returns nothing to anyone else. */
export async function getPlanSharing(planId: string) {
  const supabase = await createClient();
  const [shares, links] = await Promise.all([
    supabase
      .from("plan_shares")
      .select("id, permission, created_at, member:profiles!plan_shares_user_id_fkey(id, display_name, email)")
      .eq("plan_id", planId)
      .order("created_at"),
    supabase
      .from("plan_links")
      .select("id, expires_at, revoked_at, created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (shares.error || links.error) throw new Error("Could not load sharing settings.");
  return {
    shares: shares.data.map((s) => ({
      id: s.id,
      permission: s.permission,
      userId: s.member?.id ?? "",
      name: s.member?.display_name || s.member?.email || "Member",
      email: s.member?.email ?? "",
    })),
    links: links.data,
  };
}

export type PlanSharing = Awaited<ReturnType<typeof getPlanSharing>>;

/** Active members to share with: by name or email, excluding the owner. */
export async function findShareCandidates(ownerId: string, query: string) {
  const term = memberSearchTerm(query);
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("status", "active")
    .neq("id", ownerId)
    .or(`display_name.ilike.*${term}*,email.ilike.*${term}*`)
    .order("display_name")
    .limit(8);
  if (error) return [];
  return data.map((p) => ({ id: p.id, name: p.display_name || p.email, email: p.email }));
}

/** Plans other members shared with me (SHARE-09). Archived plans are left out. */
export async function listSharedWithMe(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_shares")
    .select(
      `permission, created_at,
       plan:plans!inner(id, title, status, updated_at,
         owner:profiles!plans_owner_id_fkey(display_name, email), plan_items(count))`,
    )
    .eq("user_id", memberId)
    .neq("plan.status", "archived");
  if (error) throw new Error("Could not load shared plans.");
  return data
    .filter((s) => s.plan)
    .map((s) => ({
      id: s.plan.id,
      title: s.plan.title,
      status: s.plan.status,
      updatedAt: s.plan.updated_at,
      permission: s.permission,
      ownerName: s.plan.owner?.display_name || s.plan.owner?.email || "A member",
      songCount: s.plan.plan_items[0]?.count ?? 0,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ---------------------------------------------------------------------------
// Public links. The token is checked, hashed and resolved with the secret key;
// the database functions apply every rule (revoked, expired, archived, owner active).
// ---------------------------------------------------------------------------

const sharedPlanSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  updated_at: z.string(),
  items: z.array(
    z.object({
      id: z.uuid(),
      notes: z.string().nullable(),
      arrangement_id: z.uuid(),
      arrangement_title: z.string(),
      musical_key: z.string().nullable(),
      bpm: z.number().nullable(),
      song_title: z.string(),
      file_version: z.string(),
    }),
  ),
});

export async function getSharedPlan(token: string) {
  if (!isLinkToken(token)) return null;
  const { data, error } = await createAdminClient().rpc("get_shared_plan", { p_token_hash: hashLinkToken(token) });
  if (error) throw new Error("Could not load this shared plan.");
  if (!data) return null;
  const plan = sharedPlanSchema.parse(data);
  const items: PlanItemView[] = plan.items.map((i) => ({
    id: i.id,
    arrangementId: i.arrangement_id,
    notes: i.notes,
    songTitle: i.song_title,
    arrangementTitle: i.arrangement_title,
    musicalKey: i.musical_key,
    bpm: i.bpm,
    fileVersion: i.file_version,
    unavailable: false,
  }));
  return { title: plan.title, description: plan.description, updatedAt: plan.updated_at, items };
}

/** The stored sheet, only if the link is valid and its plan uses this arrangement. */
export async function getSharedSheet(token: string, arrangementId: string) {
  if (!isLinkToken(token)) return null;
  const { data, error } = await createAdminClient()
    .rpc("shared_plan_sheet", { p_token_hash: hashLinkToken(token), p_arrangement_id: arrangementId })
    .maybeSingle();
  if (error || !data) return null;
  return { storagePath: data.storage_path, originalFilename: data.original_filename };
}
