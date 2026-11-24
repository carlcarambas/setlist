import "server-only";
import { getAppSettings } from "@/features/settings/queries";
import type { Member } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "./schemas";

/** Today in the church's timezone (app_settings.timezone). */
export async function churchToday() {
  const settings = await getAppSettings();
  return todayIn(settings.timezone);
}

export async function listEvents({ past, limit = 100 }: { past: boolean; limit?: number }) {
  const today = await churchToday();
  const supabase = await createClient();
  let query = supabase.from("events").select("id, title, event_date, start_time, event_plans(count)").limit(limit);
  query = past
    ? query.lt("event_date", today).order("event_date", { ascending: false }).order("start_time", { ascending: false, nullsFirst: false })
    : query.gte("event_date", today).order("event_date").order("start_time", { nullsFirst: true });
  const { data, error } = await query;
  if (error) throw new Error("Could not load events.");
  return data.map((e) => ({
    id: e.id,
    title: e.title,
    eventDate: e.event_date,
    startTime: e.start_time,
    planCount: e.event_plans[0]?.count ?? 0,
    isPast: e.event_date < today,
  }));
}

export type EventListItem = Awaited<ReturnType<typeof listEvents>>[number];

export async function getEvent(id: string, member: Member) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `id, title, description, event_date, start_time, created_by, updated_at,
       creator:profiles!events_created_by_fkey(display_name),
       event_plans(id, created_at,
         plan:plans(id, title, status, updated_at, owner_id,
           owner:profiles!plans_owner_id_fkey(display_name), plan_items(count)))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "event_plans" })
    .maybeSingle();
  if (error) throw new Error("Could not load this event.");
  if (!data) return null;

  const editable = await editablePlanIds(member.id);
  const today = await churchToday();
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    eventDate: data.event_date,
    startTime: data.start_time,
    creatorName: data.creator?.display_name ?? "a member",
    canManage: data.created_by === member.id || member.role === "admin",
    isPast: data.event_date < today,
    plans: data.event_plans
      .filter((ep) => ep.plan)
      .map((ep) => ({
        id: ep.plan!.id,
        title: ep.plan!.title,
        status: ep.plan!.status,
        ownerName: ep.plan!.owner_id === member.id ? "you" : (ep.plan!.owner?.display_name ?? "a member"),
        songCount: ep.plan!.plan_items[0]?.count ?? 0,
        canDetach: editable.has(ep.plan!.id),
      })),
  };
}

/** Ids of plans the member owns or edits (who may attach or detach them). */
async function editablePlanIds(memberId: string) {
  const plans = await listAttachablePlans(memberId, true);
  return new Set(plans.map((p) => p.id));
}

/** Plans the member can attach to an event: owned or shared as editor; archived ones only when asked. */
export async function listAttachablePlans(memberId: string, includeArchived = false) {
  const supabase = await createClient();
  const [owned, shared] = await Promise.all([
    supabase.from("plans").select("id, title, status, updated_at").eq("owner_id", memberId).limit(200),
    supabase
      .from("plan_shares")
      .select("plan:plans!inner(id, title, status, updated_at)")
      .eq("user_id", memberId)
      .eq("permission", "editor")
      .limit(200),
  ]);
  const all = [...(owned.data ?? []), ...(shared.data ?? []).map((s) => s.plan)];
  return all
    .filter((p) => includeArchived || p.status !== "archived")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((p) => ({ id: p.id, title: p.title, status: p.status }));
}

/** Events a plan belongs to, soonest first. */
export async function listPlanEvents(planId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_plans")
    .select("event:events!inner(id, title, event_date, start_time)")
    .eq("plan_id", planId);
  if (error) return [];
  return data
    .map((ep) => ({
      id: ep.event.id,
      title: ep.event.title,
      eventDate: ep.event.event_date,
      startTime: ep.event.start_time,
    }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}
