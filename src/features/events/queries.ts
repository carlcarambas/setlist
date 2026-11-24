import "server-only";
import { getAppSettings } from "@/features/settings/queries";
import { isAdmin, type Member } from "@/lib/auth/member";
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
         plan:plans(id, title, status, updated_at, plan_items(count)))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "event_plans" })
    .maybeSingle();
  if (error) throw new Error("Could not load this event.");
  if (!data) return null;

  const today = await churchToday();
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    eventDate: data.event_date,
    startTime: data.start_time,
    creatorName: data.creator?.display_name ?? "a member",
    // Everyone edits events and attaches plans; only administrators delete (spec v2 §4.4).
    canDelete: isAdmin(member),
    isPast: data.event_date < today,
    plans: data.event_plans
      .filter((ep) => ep.plan)
      .map((ep) => ({
        id: ep.plan!.id,
        title: ep.plan!.title,
        status: ep.plan!.status,
        songCount: ep.plan!.plan_items[0]?.count ?? 0,
      })),
  };
}

/** Plans that can be attached to an event: every plan that isn't archived (spec v2 §4.3). */
export async function listAttachablePlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, title")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data;
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
