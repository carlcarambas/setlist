import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Every plan, most recently updated first (spec v2 §4.3: all plans are visible to everyone). */
export async function listPlans(includeArchived: boolean, limit = 100) {
  const supabase = await createClient();
  let query = supabase
    .from("plans")
    .select("id, title, status, updated_at, editor:profiles!plans_updated_by_fkey(display_name), plan_items(count)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!includeArchived) query = query.neq("status", "archived");
  const { data, error } = await query;
  if (error) throw new Error("Could not load plans.");
  return data.map((p) => ({ ...p, songCount: p.plan_items[0]?.count ?? 0 }));
}

export type PlanItemView = {
  id: string;
  arrangementId: string;
  notes: string | null;
  songTitle: string;
  arrangementTitle: string;
  musicalKey: string | null;
  bpm: number | null;
  /** Changes when the PDF is replaced; used to refresh offline copies. */
  fileVersion: string;
  unavailable: boolean;
};

export async function getPlan(id: string) {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("plans")
    .select(
      `id, title, description, status, version, owner_id, created_at, updated_at,
       editor:profiles!plans_updated_by_fkey(display_name),
       plan_items(id, position, notes,
         arrangement:arrangements(id, title, musical_key, bpm, status, updated_at,
           piece:music_pieces(title, status)))`,
    )
    .eq("id", id)
    .order("position", { referencedTable: "plan_items" })
    .maybeSingle();
  if (error) throw new Error("Could not load this plan.");
  if (!plan) return null;

  const { data: canEdit } = await supabase.rpc("can_edit_plan", { p_plan_id: id });

  const items: PlanItemView[] = plan.plan_items.map((item) => ({
    id: item.id,
    arrangementId: item.arrangement?.id ?? "",
    notes: item.notes,
    songTitle: item.arrangement?.piece?.title ?? "Unknown song",
    arrangementTitle: item.arrangement?.title ?? "",
    musicalKey: item.arrangement?.musical_key ?? null,
    bpm: item.arrangement?.bpm ?? null,
    fileVersion: item.arrangement ? String(new Date(item.arrangement.updated_at).getTime()) : "0",
    unavailable: item.arrangement?.status !== "active" || item.arrangement?.piece?.status !== "active",
  }));

  return { ...plan, items, canEdit: Boolean(canEdit) };
}

export async function getPlanActivity(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_activities")
    .select("id, action, metadata, created_at, user:profiles!plan_activities_user_id_fkey(display_name)")
    .eq("plan_id", id)
    .order("created_at", { ascending: false })
    .limit(15);
  return data ?? [];
}

/** Songs with their active sheets, for the plan editor's library panel. */
export async function findArrangementsForPlan(query: string) {
  const supabase = await createClient();
  let request = supabase
    .from("music_pieces")
    .select("id, title, composer, arrangements(id, title, musical_key, bpm, status)")
    .eq("status", "active")
    .eq("arrangements.status", "active")
    .limit(15);
  const q = query.trim();
  request = q
    ? request.ilike("title", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`).order("title")
    : request.order("created_at", { ascending: false });
  const { data, error } = await request;
  if (error) return [];
  return data
    .filter((p) => p.arrangements.length > 0)
    .map((p) => ({
      id: p.id,
      title: p.title,
      composer: p.composer,
      arrangements: p.arrangements.map((a) => ({ id: a.id, title: a.title, musicalKey: a.musical_key, bpm: a.bpm })),
    }));
}
